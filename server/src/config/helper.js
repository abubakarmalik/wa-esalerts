// server/src/config/helper.js
// OpenWA client helpers + DB glue (bundled Chromium; no executablePath)

const fs = require('fs');
const path = require('path');
const { create, ev } = require('@open-wa/wa-automate');
const { executeQuery, isConnected } = require('./db');

// ======== Settings ========
const SESSION_DIR = path.join(process.cwd(), 'wa-openwa-session'); // persists login
const SESSION_ID = process.env.WA_SESSION_ID || 'openwa-session';
const ACK_SLEEP_MS = 500; // small sleep between status polls

// ======== Logging & Utils ========
const now = () => new Date().toISOString();
const log = (lvl, msg) => console[lvl](`[${now()}] ${msg}`);
const logInfo = (m) => log('log', `INFO: ${m}`);
const logWarn = (m) => log('warn', `WARN: ${m}`);
const logErr = (m) => log('error', `ERROR: ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ======== Number formatting (Pakistan + general) ========
function formatNumberForWhatsApp(rawNumber) {
  let s = String(rawNumber || '').trim();
  if (!s) throw new Error('Phone number cannot be empty');

  // Accept typical formats; then normalize to digits only
  const accepted = [
    /^03\d{9}$/,
    /^923\d{9}$/,
    /^\+923\d{9}$/,
    /^03\d{2}-\d{7}$/,
    /^92-3\d{2}-\d{7}$/,
    /^\+92-3\d{2}-\d{7}$/,
    /^03\d{2}\s\d{7}$/,
    /^92\s3\d{2}\s\d{7}$/,
    /^\+92\s3\d{2}\s\d{7}$/,
  ].some((re) => re.test(s));
  if (!accepted) s = s.replace(/[^\d]/g, '');

  if (s.startsWith('00')) s = s.slice(2); // 0092... -> 92...
  if (s.startsWith('03') && s.length === 11) s = '92' + s.slice(1); // local -> intl

  if (!/^[1-9]\d{9,14}$/.test(s)) {
    throw new Error(`Invalid MSISDN after normalization: "${s}"`);
  }
  return s;
}
const toChatId = (raw) => `${formatNumberForWhatsApp(raw)}@c.us`;

// ======== DB helpers ========
async function fetchTopPending() {
  if (!isConnected())
    throw new Error(
      'No active database connection. Please establish connection first.',
    );
  const q = `
     SELECT TOP(1)
      SystemCode, CampusCode, CreationDate, SrNo,
      SMSEventName, SMSTo, SMSBody, SendStatus
    FROM ES_SMS WITH (READPAST)
    WHERE SendStatus = 0
    ORDER BY CreationDate ASC, SrNo ASC;`;
  const r = await executeQuery(q);
  if (!r.success) throw new Error(r.message || 'Failed to fetch pending');
  return r.data[0] || null;
}
async function markSent(row) {
  if (!isConnected())
    throw new Error(
      'No active database connection. Please establish connection first.',
    );
  const q = `
    UPDATE ES_SMS
    SET SendStatus = 1
    WHERE SystemCode = @systemcode
      AND CampusCode  = @campuscode
      AND CreationDate= @creationdate
      AND SrNo        = @srno;`;
  await executeQuery(q, {
    SystemCode: row.SystemCode,
    CampusCode: row.CampusCode,
    CreationDate: row.CreationDate,
    SrNo: row.SrNo,
  });
}
async function markFailed(row, reason) {
  if (!isConnected())
    throw new Error(
      'No active database connection. Please establish connection first.',
    );
  const msg = (reason || '').toString().slice(0, 500);
  const q = `
    UPDATE ES_SMS
    SET SendStatus = 2
    WHERE SystemCode = @systemcode
      AND CampusCode  = @campuscode
      AND CreationDate= @creationdate
      AND SrNo        = @srno;`;
  await executeQuery(q, {
    SystemCode: row.SystemCode,
    CampusCode: row.CampusCode,
    CreationDate: row.CreationDate,
    SrNo: row.SrNo,
    Msg: msg,
  });
}

// ======== OpenWA client (bundled Chromium) ========
let openwaClient = null;

async function initializeOpenWAClient() {
  if (openwaClient) return openwaClient;

  const client = await create({
    sessionId: SESSION_ID,
    sessionDataPath: SESSION_DIR,

    // CRITICAL: use bundled Chromium
    useChrome: false, // don't force system Chrome/Edge
    headless: false, // show window for QR on first run
    // DO NOT set executablePath

    // Stability & perf
    cacheEnabled: false,
    restartOnCrash: true,
    killProcessOnBrowserClose: false,
    qrTimeout: 0, // wait indefinitely for first-time QR
    authTimeout: 0,

    // Browser flags
    chromiumArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
    ],

    // Console/QR
    disableSpins: true,
    logConsole: true,
    // logQR: true, // enable to print ascii QR in console
  });

  // Some useful events
  ev.on('qr.**', (q) => console.log('[QR EVENT]', q));
  client.onStateChanged((s) => logInfo(`OpenWA state: ${s}`));

  logInfo('OpenWA client initialized');
  openwaClient = client;
  return client;
}

// ======== Send a single message (text or file) ========
async function sendSingleMessage(client, row) {
  const normalized = formatNumberForWhatsApp(row.SMSTo);
  const jid = `${normalized}@c.us`;

  // ✅ open-wa way: verify the account can receive messages
  const status = await client.checkNumberStatus(jid).catch(() => null);
  if (!status || status.canReceiveMessage !== true) {
    throw new Error(
      `Number ${row.SMSTo} is not a WhatsApp account or cannot receive messages`,
    );
  }

  const text = (row.SMSBody || '').toString().trim();
  const filePath = row.FilePath ? String(row.FilePath).trim() : '';

  if (!filePath) {
    await client.sendText(jid, text || '');
  } else {
    const filename = path.basename(filePath);
    await client.sendFile(jid, filePath, filename, text || '');
  }

  // small pause; then mark the row as sent
  await sleep(ACK_SLEEP_MS);
  await markSent(row);
}

// ======== Broadcast helpers (optional) ========
async function prepareBroadcastPayload(body) {
  const type = String(body?.type || '').toLowerCase();
  const text = body?.text || '';
  const filePath = body?.filePath || body?.path || '';
  const caption = body?.caption || '';

  if (!type) throw new Error('type is required');

  if (type === 'text') {
    if (!text) throw new Error('text is required for text broadcasts');
    return { mode: 'text', text };
  }

  if (!filePath) throw new Error('filePath is required for media broadcasts');
  if (!fs.existsSync(filePath)) throw new Error('file does not exist');

  return { mode: 'media', filePath, caption };
}

async function getBroadcastNumbersFromDb() {
  if (!isConnected())
    throw new Error('No active database connection. Connect DB first.');
  const q = 'SELECT SMSTo FROM ES_SMS;';
  const result = await executeQuery(q);
  if (!result.success)
    throw new Error(result.message || 'Failed to fetch numbers');
  return (result.data || []).map((r) => r.SMSTo).filter(Boolean);
}

async function sendBroadcastToOne(client, jid, prepared) {
  if (prepared.mode === 'text') {
    await client.sendText(jid, prepared.text);
    await sleep(ACK_SLEEP_MS);
    return;
  }
  const filename = path.basename(prepared.filePath);
  await client.sendFile(
    jid,
    prepared.filePath,
    filename,
    prepared.caption || '',
  );
  await sleep(ACK_SLEEP_MS);
}

function clearWhatsAppSession() {
  try {
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      logInfo('OpenWA session cleared (folder removed)');
    }
  } catch (e) {
    logWarn(`Failed to clear OpenWA session: ${e.message}`);
  }
}

module.exports = {
  // logs/utils
  now,
  log,
  logInfo,
  logWarn,
  logErr,
  sleep,
  randInt,

  // numbers
  formatNumberForWhatsApp,
  toChatId,

  // DB glue
  fetchTopPending,
  markSent,
  markFailed,

  // OpenWA client
  initializeOpenWAClient,
  sendSingleMessage,
  clearWhatsAppSession,

  // Broadcast
  prepareBroadcastPayload,
  getBroadcastNumbersFromDb,
  sendBroadcastToOne,
};
