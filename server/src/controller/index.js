const path = require('path');

const {
  initializeConnection,
  executeQuery,
  isConnected,
  closeConnection,
} = require('../config/db');

const {
  fetchTopPending,
  initializeWhatsAppClient,
  sendSingleMessage,
  sleep,
  randInt,
  logInfo,
  logErr,
  logWarn,
  clearWhatsAppSession,
  toChatId,
  formatNumberForWhatsApp,
  markFailed,
} = require('../config/helper');

const {
  prepareBroadcastPayload,
  getBroadcastNumbersFromDb,
  sendBroadcastToOne,
} = require('../config/helper');

/**
 * Database Connection Controller
 * Simplified version for SMS application
 */

// Global control for WhatsApp sender
const senderControl = {
  stopRequested: false,
  isRunning: false,
};

// Hold a single WhatsApp client instance so we can destroy it on hard stop
let waClient = null;

//==================database connection==================
const databaseConnection = async (req, res) => {
  try {
    // If already connected, do not proceed
    if (isConnected()) {
      return res.status(200).json({
        success: true,
        message: 'Database is already connected',
      });
    }
    // Extract database configuration from request body
    const {
      MSSQL_SERVER,
      MSSQL_DB,
      MSSQL_USER,
      MSSQL_PASSWORD,
      MSSQL_PORT,
      MSSQL_ENCRYPT,
      MSSQL_TRUST_CERT,
    } = req.body;

    // Validate required parameters
    if (!MSSQL_SERVER || !MSSQL_DB || !MSSQL_USER || !MSSQL_PASSWORD) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required database parameters: server, database, user, password',
      });
    }

    // Initialize global database connection
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

//==================get all records==================
const getAllRecords = async (_req, res) => {
  try {
    // Check if database connection is active
    if (!isConnected()) {
      return res.status(500).json({
        success: false,
        message:
          'No active database connection. Please establish connection first.',
      });
    }

    // Execute query using global connection
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

    if (!result.success) {
      return res.status(500).json(result);
    }

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

//========Send whatsapp massages ===============
const sendWhatsAppMessages = async (req, res) => {
  try {
    // Check if database connection is active
    if (!isConnected()) {
      return res.status(500).json({
        success: false,
        message:
          'No active database connection. Please establish connection first.',
      });
    }

    // Prevent multiple concurrent runs
    if (senderControl.isRunning) {
      return res.status(409).json({
        success: false,
        message: 'Sender is already running',
      });
    }

    let client = null;
    let processedCount = 0;
    let errorCount = 0;

    // Set response headers for Server-Sent Events (SSE)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    // Optional heartbeat to keep SSE alive. Disabled by default to avoid empty lines in clients.
    const hbIntervalMs = Number(process.env.SSE_HEARTBEAT_MS || 0);
    const heartbeat =
      hbIntervalMs > 0
        ? setInterval(() => {
            try {
              res.write(': ping\n\n'); // comment line per SSE spec
              if (typeof res.flush === 'function') res.flush();
            } catch {}
          }, hbIntervalMs)
        : null;

    // Clean up if client disconnects early
    req.on('close', () => {
      try {
        if (heartbeat) clearInterval(heartbeat);
      } catch {}
      try {
        sseOpen = false;
        res.end();
      } catch {}
    });

    let sseOpen = true;
    const sendStatusUpdate = (status, data = {}) => {
      if (!sseOpen) return; // avoid writes after client disconnects
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

    try {
      // Reset stop flag and set running state
      senderControl.stopRequested = false;
      senderControl.isRunning = true;
      // Send initial status
      sendStatusUpdate('initializing', {
        message: 'Starting WhatsApp automation...',
      });

      // Initialize WhatsApp client
      sendStatusUpdate('connecting', {
        message: 'Initializing WhatsApp client...',
      });
      logInfo('Initializing WhatsApp client...');
      // Reuse existing client if present, otherwise create and store globally
      if (waClient) {
        client = waClient;
      } else {
        client = await initializeWhatsAppClient();
        waClient = client;
      }
      logInfo('WhatsApp client initialized successfully');
      sendStatusUpdate('connected', { message: 'WhatsApp client ready' });

      // Process messages in a loop until no pending rows
      while (!senderControl.stopRequested) {
        sendStatusUpdate('fetching', {
          message: 'Fetching next pending message...',
        });
        const row = await fetchTopPending();

        if (senderControl.stopRequested) break;

        if (!row) {
          // No pending messages; idle for 5 minutes then check again
          const idleSec = 2 * 60;
          sendStatusUpdate('idle', {
            message:
              'No pending messages. Idling for 2 minutes before rechecking...',
            processedCount,
            errorCount,
            totalProcessed: processedCount + errorCount,
            waitSeconds: idleSec,
          });
          logInfo('No pending rows. Waiting 5 minutes before next check...');
          // Sleep in small chunks so we can stop early
          const chunkMs = 1000;
          const totalMs = idleSec * 1000;
          for (let waited = 0; waited < totalMs; waited += chunkMs) {
            if (senderControl.stopRequested) break;
            await sleep(chunkMs);
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

          // Validate number format and WhatsApp registration before sending
          let chatId;
          try {
            const normalized = formatNumberForWhatsApp(row.SMSTo);
            chatId = `${normalized}@c.us`;
          } catch (e) {
            await markFailed(row);
            throw new Error(
              `Invalid number format -> marked failed: ${e.message}`,
            );
          }

          const isRegistered = await client
            .isRegisteredUser(chatId)
            .catch((e) => {
              throw new Error(
                `Failed to verify registration: ${e.message || e}`,
              );
            });
          if (!isRegistered) {
            await markFailed(row);
            throw new Error(
              'Number is not registered on WhatsApp -> marked failed',
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

          // Wait 15 to 30s after completion (as requested)
          const waitSec = randInt(15, 30);
          sendStatusUpdate('waiting', {
            message: `Waiting ${waitSec} seconds before next message...`,
            waitSeconds: waitSec,
          });
          logInfo(`Waiting ${waitSec}s before next message...`);
          for (let waited = 0; waited < waitSec; waited++) {
            if (senderControl.stopRequested) break;
            await sleep(1000);
          }
        } catch (error) {
          errorCount++;
          logErr(`SrNo=${row.SrNo} failed: ${error.message || error}`);

          sendStatusUpdate('error', {
            message: `Failed to send message to ${row.SMSTo}: ${error.message}`,
            processedCount,
            errorCount,
            currentRecord: {
              SrNo: row.SrNo,
              SMSTo: row.SMSTo,
              SMSEventName: row.SMSEventName,
            },
            error: error.message,
          });

          // Optional: small backoff on error to avoid hammering
          for (let waited = 0; waited < 5; waited++) {
            if (senderControl.stopRequested) break;
            await sleep(1000);
          }
        }
      }

      // Send final completion status
      sendStatusUpdate('finished', {
        message: senderControl.stopRequested
          ? 'Sender stopped by user'
          : 'WhatsApp message processing completed',
        processedCount,
        errorCount,
        totalProcessed: processedCount + errorCount,
      });
    } catch (error) {
      logErr(
        `WhatsApp client initialization failed: ${error.message || error}`,
      );
      sendStatusUpdate('failed', {
        message: 'Failed to initialize WhatsApp client',
        error: error.message,
      });
    } finally {
      // Do not destroy WhatsApp client; keep it running for continuous processing
      // Also keep the loop alive; only clean SSE heartbeat if client disconnected
      // Heartbeat is cleared in the req 'close' handler
      senderControl.isRunning = false;

      // If a hard stop was requested, destroy the client and close SSE
      if (senderControl.stopRequested) {
        try {
          if (waClient) {
            await waClient.destroy();
            waClient = null;
            logInfo('WhatsApp client destroyed due to stop request');
          }
        } catch (e) {
          logWarn(`Error destroying WhatsApp client on stop: ${e.message}`);
        }
        try {
          sseOpen = false;
          if (heartbeat) clearInterval(heartbeat);
        } catch {}
        try {
          res.end();
        } catch {}
      }
    }
  } catch (error) {
    console.error('❌ Send WhatsApp messages error:', error);

    // If headers haven't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to process WhatsApp messages',
        error: error.message,
      });
    } else {
      // Send error status update
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

//===============Stop Massage sender====================

const stopMassageSender = async (_req, res) => {
  senderControl.stopRequested = true;
  return res
    .status(200)
    .json({ success: true, message: 'Hard stop requested' });
};

//=============Broadcast Custom Massage ==================
const broadcastCustomMassage = async (req, res) => {
  // Check if database connection is active
  if (!isConnected()) {
    return res.status(500).json({
      success: false,
      message:
        'No active database connection. Please establish connection first.',
    });
  }

  // Prevent multiple concurrent runs
  if (senderControl.isRunning) {
    return res.status(409).json({
      success: false,
      message: 'Sender is already running',
    });
  }

  try {
    senderControl.stopRequested = false;
    senderControl.isRunning = true;

    // Validate payload
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

    // Fetch numbers
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

    // Normalize and dedupe
    const seen = new Set();
    const recipients = [];
    let skippedInvalid = 0;
    let skippedDuplicate = 0;
    for (const raw of numbers) {
      try {
        const normalized = formatNumberForWhatsApp(raw);
        if (seen.has(normalized)) {
          skippedDuplicate++;
          continue;
        }
        seen.add(normalized);
        const jid = `${normalized}@c.us`;
        recipients.push({ raw, jid });
      } catch (e) {
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

    // Initialize/reuse WhatsApp client
    if (!waClient) {
      try {
        waClient = await initializeWhatsAppClient();
      } catch (e) {
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize WhatsApp client',
          error: e.message,
        });
      }
    }
    const client = waClient;

    // Send one by one
    let sent = 0;
    let failed = 0;

    for (let index = 0; index < recipients.length; index++) {
      const r = recipients[index];

      // Registration check
      const isRegistered = await client
        .isRegisteredUser(r.jid)
        .catch(() => false);
      if (!isRegistered) {
        failed++;
        continue;
      }

      // Attempt send with 1 retry on transient errors
      let ok = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await sendBroadcastToOne(client, r.jid, prepared);
          ok = true;
          break;
        } catch (e) {
          if (attempt === 1) {
            const backoff = randInt(3, 5);
            for (let i = 0; i < backoff; i++) await sleep(1000);
          }
        }
      }

      if (ok) {
        sent++;
      } else {
        failed++;
      }

      // Random delay 15–30s between recipients
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
    // Close WhatsApp browser after task completion
    try {
      if (waClient) {
        await waClient.destroy();
        waClient = null;
        logInfo('WhatsApp client destroyed after broadcast completion');
      }
    } catch (e) {
      logWarn(`Error destroying WhatsApp client after broadcast: ${e.message}`);
    }
  }
};

//========Close Connection with Database ===============
const closeConnectionWithDb = async (_req, res) => {
  try {
    console.log('🔄 Attempting to close database connection...');

    // If sender is running, request stop first
    if (senderControl.isRunning) {
      senderControl.stopRequested = true;
    }

    const result = await closeConnection();

    if (result.success) {
      console.log('✅ Database connection closed successfully');
      // Clear WhatsApp LocalAuth session so next run requires QR scan
      try {
        clearWhatsAppSession();
      } catch {}
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } else {
      console.log('❌ Failed to close database connection:', result.message);
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
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
