// server/src/controllers/index.js

const {
  initializeConnection,
  executeQuery,
  isConnected,
  closeConnection,
} = require('../config/db');

const {
  fetchTopPending,
  initializeOpenWAClient,
  sendSingleMessage,
  sleep,
  randInt,
  logInfo,
  logErr,
  logWarn,
  clearWhatsAppSession,
  formatNumberForWhatsApp,
  markFailed,

  // broadcast helpers
  prepareBroadcastPayload,
  getBroadcastNumbersFromDb,
  sendBroadcastToOne,
} = require('../config/helper');

// Global OpenWA client + run control
let waClient = null;
const senderControl = { stopRequested: false, isRunning: false };

//================== Database: connect ==================
const databaseConnection = async (req, res) => {
  try {
    if (isConnected()) {
      return res
        .status(200)
        .json({ success: true, message: 'Database is already connected' });
    }

    const {
      MSSQL_SERVER,
      MSSQL_DB,
      MSSQL_USER,
      MSSQL_PASSWORD,
      MSSQL_PORT,
      MSSQL_ENCRYPT,
      MSSQL_TRUST_CERT,
    } = req.body;

    if (!MSSQL_SERVER || !MSSQL_DB || !MSSQL_USER || !MSSQL_PASSWORD) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required database parameters: server, database, user, password',
      });
    }

    const connectionResult = await initializeConnection({
      server: MSSQL_SERVER,
      database: MSSQL_DB,
      user: MSSQL_USER,
      password: MSSQL_PASSWORD,
      port: MSSQL_PORT,
      encrypt: MSSQL_ENCRYPT,
      trustServerCertificate: MSSQL_TRUST_CERT,
    });

    if (!connectionResult.success) {
      return res.status(500).json(connectionResult);
    }

    res.status(200).json({
      success: true,
      message: 'Database connection established successfully',
      config: connectionResult.config,
    });
  } catch (error) {
    console.error('❌ Database connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
    });
  }
};

//================== Records: list pending ==================
const getAllRecords = async (_req, res) => {
  try {
    if (!isConnected()) {
      return res.status(500).json({
        success: false,
        message:
          'No active database connection. Please establish connection first.',
      });
    }

    const query = `
       SELECT 
        SystemCode, 
        CampusCode, 
        CreationDate, 
        SrNo,
        SMSEventName, 
        SMSTo, 
        SMSBody, 
        SendStatus
      FROM ES_SMS 
      WHERE SendStatus = 0
      ORDER BY CreationDate ASC, SrNo ASC;
    `;
    const result = await executeQuery(query);
    if (!result.success) return res.status(500).json(result);

    res.status(200).json({
      success: true,
      message: 'Successfully fetched records',
      data: result.data,
      count: result.data.length,
    });
  } catch (error) {
    console.error('❌ Get records error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch records',
      error: error.message,
    });
  }
};

// ================== WhatsApp: sender SSE loop (OpenWA) ==================
const sendWhatsAppMessages = async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(500).json({
        success: false,
        message:
          'No active database connection. Please establish connection first.',
      });
    }

    if (senderControl.isRunning) {
      return res
        .status(409)
        .json({ success: false, message: 'Sender is already running' });
    }

    // --- SSE setup ---
    // disable any request/socket timeouts for this SSE
    if (req.socket) {
      req.setTimeout(0);
      req.socket.setTimeout(0);
      req.socket.setKeepAlive(true, 60_000); // 60s TCP keepalive
    }

    // SSE headers (no buffering)
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // for nginx
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const hbIntervalMs = Number(process.env.SSE_HEARTBEAT_MS || 15000);
    const heartbeat =
      hbIntervalMs > 0
        ? setInterval(() => {
            try {
              res.write(': ping\n\n'); // SSE comment line
              if (typeof res.flush === 'function') res.flush();
            } catch {}
          }, hbIntervalMs)
        : null;

    let sseOpen = true;
    req.on('close', () => {
      try {
        if (heartbeat) clearInterval(heartbeat);
      } catch {}
      try {
        sseOpen = false;
        res.end();
      } catch {}
    });

    const sendStatusUpdate = (status, data = {}) => {
      if (!sseOpen) return;
      const update = JSON.stringify({
        timestamp: new Date().toISOString(),
        status,
        ...data,
      });
      try {
        res.write(`data: ${update}\n\n`);
        if (typeof res.flush === 'function') res.flush();
      } catch {}
    };

    // --- init + loop ---
    let client = null;
    let processedCount = 0;
    let errorCount = 0;

    try {
      senderControl.stopRequested = false;
      senderControl.isRunning = true;

      sendStatusUpdate('initializing', {
        message: 'Starting WhatsApp automation (OpenWA + bundled Chromium)...',
      });
      if (!waClient) {
        try {
          waClient = await initializeOpenWAClient();
        } catch (e) {
          throw e;
        }
      }
      client = waClient;
      sendStatusUpdate('connected', { message: 'WhatsApp client ready' });
      logInfo('OpenWA client initialized successfully');

      while (!senderControl.stopRequested) {
        sendStatusUpdate('fetching', {
          message: 'Fetching next pending message...',
        });
        const row = await fetchTopPending();

        if (senderControl.stopRequested) break;

        if (!row) {
          const idleSec = 120; // 2 minutes
          sendStatusUpdate('idle', {
            message:
              'No pending messages. Idling for 2 minutes before rechecking...',
            processedCount,
            errorCount,
            totalProcessed: processedCount + errorCount,
            waitSeconds: idleSec,
          });
          logInfo('No pending rows. Waiting 2 minutes before next check...');
          for (let waited = 0; waited < idleSec * 1000; waited += 1000) {
            if (senderControl.stopRequested) break;
            await sleep(1000);
          }
          continue;
        }

        try {
          sendStatusUpdate('sending', {
            message: `Sending message to ${row.SMSTo}`,
            currentRecord: {
              SrNo: row.SrNo,
              SMSTo: row.SMSTo,
              SMSEventName: row.SMSEventName,
            },
          });

          // Pre-validate number (sendSingleMessage also validates)
          try {
            formatNumberForWhatsApp(row.SMSTo);
          } catch (e) {
            await markFailed(row, e.message);
            throw new Error(
              `Invalid number format -> marked failed: ${e.message}`,
            );
          }

          await sendSingleMessage(client, row);
          processedCount++;

          sendStatusUpdate('sent', {
            message: `Message sent successfully to ${row.SMSTo}`,
            processedCount,
            errorCount,
            currentRecord: {
              SrNo: row.SrNo,
              SMSTo: row.SMSTo,
              SMSEventName: row.SMSEventName,
            },
          });

          const waitSec = randInt(15, 30);
          sendStatusUpdate('waiting', {
            message: `Waiting ${waitSec} seconds before next message...`,
            waitSeconds: waitSec,
          });
          logInfo(`Waiting ${waitSec}s before next message...`);
          for (let i = 0; i < waitSec; i++) {
            if (senderControl.stopRequested) break;
            await sleep(1000);
          }
        } catch (err) {
          errorCount++;
          logErr(`SrNo=${row?.SrNo} failed: ${err.message || err}`);
          await markFailed(row, err.message);

          sendStatusUpdate('error', {
            message: `Failed to send message to ${row?.SMSTo}: ${err.message}`,
            processedCount,
            errorCount,
            currentRecord: row
              ? {
                  SrNo: row.SrNo,
                  SMSTo: row.SMSTo,
                  SMSEventName: row.SMSEventName,
                }
              : undefined,
            error: err.message,
          });

          for (let i = 0; i < 5; i++) {
            if (senderControl.stopRequested) break;
            await sleep(1000);
          }
        }
      }

      sendStatusUpdate('finished', {
        message: senderControl.stopRequested
          ? 'Sender stopped by user'
          : 'WhatsApp message processing completed',
        processedCount,
        errorCount,
        totalProcessed: processedCount + errorCount,
      });
    } catch (error) {
      logErr(`WhatsApp client init/send failed: ${error.message || error}`);
      sendStatusUpdate('failed', {
        message: 'Failed to initialize or send via WhatsApp client',
        error: error.message,
      });
    } finally {
      senderControl.isRunning = false;

      if (senderControl.stopRequested) {
        // ❌ DO NOT kill the client here — let it keep running
        // if (waClient) { await waClient.kill(); waClient = null; }
        try {
          res.end();
        } catch {}
      }
    }
  } catch (error) {
    console.error('❌ Send WhatsApp messages error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to process WhatsApp messages',
        error: error.message,
      });
    } else {
      const update = JSON.stringify({
        timestamp: new Date().toISOString(),
        status: 'error',
        message: 'Failed to process WhatsApp messages',
        error: error.message,
      });
      try {
        res.write(`data: ${update}\n\n`);
      } catch {}
      try {
        res.end();
      } catch {}
    }
  }
};

//=============== WhatsApp sender: stop ====================
const stopMassageSender = async (_req, res) => {
  senderControl.stopRequested = true;
  return res
    .status(200)
    .json({ success: true, message: 'Hard stop requested' });
};

//============= Broadcast custom message ==================
const broadcastCustomMassage = async (req, res) => {
  if (!isConnected()) {
    return res.status(500).json({
      success: false,
      message:
        'No active database connection. Please establish connection first.',
    });
  }
  if (senderControl.isRunning) {
    return res
      .status(409)
      .json({ success: false, message: 'Sender is already running' });
  }

  try {
    senderControl.stopRequested = false;
    senderControl.isRunning = true;

    let prepared;
    try {
      prepared = await prepareBroadcastPayload(req.body || {});
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: e.message,
      });
    }

    let numbers;
    try {
      numbers = await getBroadcastNumbersFromDb();
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch numbers',
        error: e.message,
      });
    }

    const seen = new Set();
    const recipients = [];
    let skippedInvalid = 0,
      skippedDuplicate = 0;
    for (const raw of numbers) {
      try {
        const normalized = formatNumberForWhatsApp(raw);
        if (seen.has(normalized)) {
          skippedDuplicate++;
          continue;
        }
        seen.add(normalized);
        recipients.push(`${normalized}@c.us`);
      } catch {
        skippedInvalid++;
      }
    }

    if (recipients.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No valid recipients found',
        sent: 0,
        failed: 0,
        total: 0,
        skippedInvalid,
        skippedDuplicate,
      });
    }

    if (!waClient) {
      try {
        waClient = await initializeOpenWAClient();
      } catch (e) {
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize WhatsApp client',
          error: e.message,
        });
      }
    }
    const client = waClient;

    let sent = 0,
      failed = 0;
    for (const jid of recipients) {
      try {
        await sendBroadcastToOne(client, jid, prepared);
        sent++;
      } catch {
        failed++;
      }
      const waitSec = randInt(15, 30);
      for (let i = 0; i < waitSec; i++) await sleep(1000);
    }

    return res.status(200).json({
      success: true,
      message: 'Broadcast complete',
      sent,
      failed,
      total: recipients.length,
      skippedInvalid,
      skippedDuplicate,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Broadcast failed',
      error: error.message,
    });
  } finally {
    senderControl.isRunning = false;
    // Optional: close after broadcast to free resources
    try {
      if (waClient) {
        await waClient.kill();
        waClient = null;
        logInfo('OpenWA client destroyed after broadcast completion');
      }
    } catch (e) {
      logWarn(`Error destroying OpenWA client after broadcast: ${e.message}`);
    }
  }
};

//======== Database: close ==================
const closeConnectionWithDb = async (_req, res) => {
  try {
    console.log('🔄 Attempting to close database connection...');
    if (senderControl.isRunning) senderControl.stopRequested = true;

    const result = await closeConnection();
    if (result.success) {
      try {
        clearWhatsAppSession();
      } catch {}
      res.status(200).json({ success: true, message: result.message });
    } else {
      res
        .status(500)
        .json({ success: false, message: result.message, error: result.error });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to close database connection',
      error: error.message,
    });
  }
};

module.exports = {
  databaseConnection,
  getAllRecords,
  closeConnectionWithDb,
  sendWhatsAppMessages,
  stopMassageSender,
  broadcastCustomMassage,
};
