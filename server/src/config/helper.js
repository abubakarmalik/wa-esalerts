const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageAck } = require('whatsapp-web.js');
const { executeQuery, isConnected } = require('./db');
const { MessageMedia } = require('whatsapp-web.js');
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_PDF_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_VIDEO_BYTES = 6 * 1024 * 1024; // 6 MB

// ================= CONFIG =================
const AUTH_DIR = path.join(__dirname, '..', '.wwebjs_auth');
const CLIENT_ID = 'db-wa-worker';
const ACK_TIMEOUT_MS = 20000;

// ================  Helper functions =====================

const now = () => new Date().toISOString();
const log = (level, msg) => console[level](`[${now()}] ${msg}`);
const logInfo = (m) => log('log', `INFO: ${m}`);
const logWarn = (m) => log('warn', `WARN: ${m}`);
const logErr = (m) => log('error', `ERROR: ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Formats to international digits for Pakistan by default: 0321... -> 92321...
function formatNumberForWhatsApp(rawNumber) {
  let input = String(rawNumber || '').trim();
  if (!input) throw new Error('Phone number cannot be empty');

  // Define valid patterns
  const validPatterns = [
    /^03\d{9}$/, // 03XXXXXXXXX
    /^923\d{9}$/, // 92XXXXXXXXX
    /^\+923\d{9}$/, // +92XXXXXXXXX
    /^03\d{2}-\d{7}$/, // 03XX-XXXXXXX
    /^92-3\d{2}-\d{7}$/, // 92-3XX-XXXXXXX
    /^\+92-3\d{2}-\d{7}$/, // +92-3XX-XXXXXXX
    /^03\d{2}\s\d{7}$/, // 03XX XXXXXXX
    /^92\s3\d{2}\s\d{7}$/, // 92 3XX XXXXXXX
    /^\+92\s3\d{2}\s\d{7}$/, // +92 3XX XXXXXXX
  ];

  // Check if number matches any valid pattern
  const isValidFormat = validPatterns.some((pattern) => pattern.test(input));
  if (!isValidFormat) {
    throw new Error('Invalid phone number format');
  }

  // Remove all non-digits
  input = input.replace(/[^\d]/g, '');

  // Convert 03... to 923...
  if (input.startsWith('03')) {
    input = '92' + input.slice(1);
  }

  // Ensure the final number is in correct format (923XXXXXXXXX)
  if (!input.match(/^923\d{9}$/)) {
    throw new Error('Invalid phone number format');
  }

  return input;
}

function toChatId(rawNumber) {
  const normalized = formatNumberForWhatsApp(rawNumber);

  if (!/^[0-9]{8,15}$/.test(normalized)) {
    throw new Error(
      `Invalid SMSTo "${rawNumber}". Expected international digits like 923001234567.`,
    );
  }

  return `${normalized}@c.us`;
}

function findChromeOnWindows() {
  const cands = [
    path.join(
      process.env['PROGRAMFILES'] || 'C:/Program Files',
      'Google/Chrome/Application/chrome.exe',
    ),
    path.join(
      process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)',
      'Google/Chrome/Application/chrome.exe',
    ),
  ];
  for (const c of cands) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return undefined;
}

function clearWhatsAppSession() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      logInfo('WhatsApp session cleared (LocalAuth data removed)');
    } else {
      logInfo('No WhatsApp session directory to clear');
    }
  } catch (e) {
    logWarn(`Failed to clear WhatsApp session: ${e.message}`);
  }
}

async function fetchTopPending() {
  // Check if database connection is active
  if (!isConnected()) {
    throw new Error(
      'No active database connection. Please establish connection first.',
    );
  }

  const q = `
    SELECT TOP(1)
      SystemCode, CampusCode, CreationDate, SrNo,
      SMSEventName, SMSTo, SMSBody, SendStatus
    FROM ES_SMS WITH (READPAST)
    WHERE SendStatus = 0
    ORDER BY CreationDate ASC, SrNo ASC;`;

  const result = await executeQuery(q);
  if (!result.success) {
    throw new Error(result.message || 'Failed to fetch pending records');
  }
  return result.data[0] || null;
}

async function markSent(row) {
  // Check if database connection is active
  if (!isConnected()) {
    throw new Error(
      'No active database connection. Please establish connection first.',
    );
  }

  const q = `
    UPDATE ES_SMS
    SET SendStatus = 1
    WHERE SystemCode = @systemcode
      AND CampusCode  = @campuscode
      AND CreationDate= @creationdate
      AND SrNo        = @srno;`;

  const result = await executeQuery(q, {
    systemcode: row.SystemCode,
    campuscode: row.CampusCode,
    creationdate: row.CreationDate,
    srno: row.SrNo,
  });

  if (!result.success) {
    throw new Error(result.message || 'Failed to mark record as sent');
  }
  return result;
}

async function markFailed(row) {
  if (!isConnected()) {
    throw new Error(
      'No active database connection. Please establish connection first.',
    );
  }
  const q = `
    UPDATE ES_SMS
    SET SendStatus = 2
    WHERE SystemCode = @systemcode
      AND CampusCode  = @campuscode
      AND CreationDate= @creationdate
      AND SrNo        = @srno;`;
  const result = await executeQuery(q, {
    systemcode: row.SystemCode,
    campuscode: row.CampusCode,
    creationdate: row.CreationDate,
    srno: row.SrNo,
  });
  if (!result.success) {
    throw new Error(result.message || 'Failed to mark record as failed');
  }
  return result;
}

function waitAck(client, messageId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.removeListener('message_ack', onAck);
      reject(new Error('ACK timeout'));
    }, timeoutMs);

    function onAck(m, ack) {
      if (!m?.id || m.id._serialized !== messageId) return;
      if (ack >= MessageAck.ACK_SERVER) {
        clearTimeout(timer);
        client.removeListener('message_ack', onAck);
        resolve(ack);
      }
    }
    client.on('message_ack', onAck);
  });
}

function buildClient() {
  ensureDir(AUTH_DIR);
  const isWin = process.platform === 'win32';
  const chromePath = isWin ? findChromeOnWindows() : undefined;

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: CLIENT_ID, dataPath: AUTH_DIR }),
    puppeteer: {
      headless: false, // show Chrome so you can scan QR first time
      executablePath: chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    },
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    restartOnAuthFail: false,
    webVersionCache: {
      type: 'remote',
      remotePath:
        'https://raw.githubusercontent.com/wwebjs/wwebjs-web/gh-pages/latest.json',
    },
  });

  client.on('qr', (qr) => {
    logInfo('Scan this QR in WhatsApp → Linked devices');
    try {
      qrcode.generate(qr, { small: true });
    } catch {}
  });
  client.on('authenticated', () => logInfo('WhatsApp authenticated'));
  client.on('ready', () => logInfo('WhatsApp ready'));
  client.on('change_state', (s) => logInfo(`WhatsApp state: ${s}`));
  client.on('auth_failure', (m) => logWarn(`auth_failure: ${m}`));
  client.on('disconnected', (r) => logWarn(`disconnected: ${r}`));

  return client;
}

async function initializeWhatsAppClient() {
  const client = buildClient();
  await client.initialize();

  // Wait for client to be ready
  await new Promise((resolve, reject) => {
    const to = setTimeout(
      () => reject(new Error('Timeout waiting for WhatsApp client ready')),
      90000,
    );
    client.once('ready', () => {
      clearTimeout(to);
      resolve();
    });
  });

  // Small guard for post-ready reload
  await sleep(1200);

  return client;
}

async function sendSingleMessage(client, row) {
  const chatId = toChatId(row.SMSTo);
  logInfo(`Sending SrNo=${row.SrNo} to ${row.SMSTo} (jid=${chatId})`);

  // Verify that the number is registered on WhatsApp
  const isRegistered = await client.isRegisteredUser(chatId).catch((e) => {
    throw new Error(
      `Failed to verify WhatsApp registration: ${e?.message || e}`,
    );
  });
  if (!isRegistered) {
    throw new Error(`Number ${row.SMSTo} is not registered on WhatsApp`);
  }

  try {
    const msg = await client.sendMessage(chatId, row.SMSBody || '');
    await waitAck(client, msg.id._serialized, ACK_TIMEOUT_MS).catch(() => null);
    await markSent(row);
    logInfo(`Marked SrNo=${row.SrNo} as sent`);
    return msg;
  } catch (err) {
    // Surface clearer error to logs and caller
    const details = err?.message || String(err);
    throw new Error(`Failed to send to ${row.SMSTo}: ${details}`);
  }
}

function isPathInsideBase(resolvedPath, baseDir) {
  try {
    const base = path.resolve(baseDir);
    const target = path.resolve(resolvedPath);
    const rel = path.relative(base, target);
    return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch {
    return false;
  }
}

function validateLocalFilePath(inputPath, allowBaseDir) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('File path is required');
  }
  const resolved = path.resolve(inputPath);
  // Disallow URLs or protocol-like inputs
  if (/^[a-zA-Z]+:\\/i.test(inputPath) || inputPath.startsWith('file://')) {
    // Windows absolute paths like C:\ are fine; just allow them as resolved
    // but disallow file:// schemes
    if (inputPath.startsWith('file://')) {
      throw new Error('file:// scheme is not allowed');
    }
  }
  if (allowBaseDir) {
    if (!isPathInsideBase(resolved, allowBaseDir)) {
      throw new Error('File path not allowed by base directory policy');
    }
  }
  if (!fs.existsSync(resolved)) throw new Error('File does not exist');
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error('Path is not a file');
  return { resolvedPath: resolved, size: stat.size };
}

function getExtensionLower(filePath) {
  return (path.extname(filePath || '').toLowerCase() || '').replace(/^\./, '');
}

function validateMediaTypeAndSize(filePath, sizeBytes) {
  const ext = getExtensionLower(filePath);
  const imageExts = new Set(['png', 'jpg', 'jpeg']);
  const pdfExts = new Set(['pdf']);
  const videoExts = new Set(['mp4', 'mov', 'mkv', '3gp', 'avi', 'webm']);

  if (imageExts.has(ext)) {
    if (sizeBytes > MAX_IMAGE_BYTES)
      throw new Error('Image exceeds 2 MB limit');
    return { kind: 'image' };
  }
  if (pdfExts.has(ext)) {
    if (sizeBytes > MAX_PDF_BYTES) throw new Error('PDF exceeds 2 MB limit');
    return { kind: 'pdf' };
  }
  if (videoExts.has(ext)) {
    if (sizeBytes > MAX_VIDEO_BYTES)
      throw new Error('Video exceeds 6 MB limit');
    return { kind: 'video' };
  }
  throw new Error('Unsupported file type');
}

async function loadMessageMedia(filePath) {
  // MessageMedia.fromFilePath will read and base64-encode
  return MessageMedia.fromFilePath(filePath);
}

/**
 * Prepare broadcast payload based on req.body
 * Supports:
 * - text
 * - image/pdf/video (with optional caption)
 */
async function prepareBroadcastPayload(body) {
  const allowBaseDir = process.env.ALLOW_MEDIA_BASE || '';
  const type = String(body?.type || '').toLowerCase();
  const text = body?.text || '';
  const caption = body?.caption || '';
  const filePath = body?.filePath || body?.path || '';

  if (!type) throw new Error('type is required');

  if (type === 'text') {
    if (!text || typeof text !== 'string') throw new Error('text is required');
    return { mode: 'text', text };
  }

  // For media types, validate file
  if (!filePath) throw new Error('filePath is required for media messages');
  const { resolvedPath, size } = validateLocalFilePath(filePath, allowBaseDir);
  const mediaInfo = validateMediaTypeAndSize(resolvedPath, size);

  // Ensure requested type matches detected kind
  const kindMap = { image: 'image', pdf: 'pdf', video: 'video' };
  if (kindMap[mediaInfo.kind] !== type) {
    throw new Error(
      `Provided type ${type} does not match file type ${mediaInfo.kind}`,
    );
  }

  const media = await loadMessageMedia(resolvedPath);
  return {
    mode: 'media',
    mediaKind: mediaInfo.kind,
    media,
    caption: caption || '',
  };
}

async function getBroadcastNumbersFromDb() {
  if (!isConnected()) {
    throw new Error('No active database connection. Connect DB first.');
  }
  const q = 'SELECT SMSTo FROM ES_SMS;';
  const result = await executeQuery(q);
  if (!result.success)
    throw new Error(result.message || 'Failed to fetch numbers');
  const numbers = (result.data || []).map((r) => r.SMSTo).filter((v) => !!v);
  return numbers;
}

async function sendBroadcastToOne(client, chatId, prepared) {
  if (prepared.mode === 'text') {
    const msg = await client.sendMessage(chatId, prepared.text);
    await waitAck(client, msg.id._serialized, ACK_TIMEOUT_MS).catch(() => null);
    return msg;
  }
  // media
  const options = prepared.caption ? { caption: prepared.caption } : {};
  const msg = await client.sendMessage(chatId, prepared.media, options);
  await waitAck(client, msg.id._serialized, ACK_TIMEOUT_MS).catch(() => null);
  return msg;
}

module.exports = {
  // Utility functions
  now,
  log,
  logInfo,
  logWarn,
  logErr,
  sleep,
  randInt,
  ensureDir,
  toChatId,
  formatNumberForWhatsApp,
  findChromeOnWindows,

  // Database functions
  fetchTopPending,
  markSent,
  markFailed,

  // WhatsApp functions
  waitAck,
  buildClient,
  initializeWhatsAppClient,
  sendSingleMessage,
  clearWhatsAppSession,

  // Media functions
  prepareBroadcastPayload,
  getBroadcastNumbersFromDb,
  sendBroadcastToOne,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  MAX_VIDEO_BYTES,

  // Constants
  AUTH_DIR,
  CLIENT_ID,
  ACK_TIMEOUT_MS,
};
