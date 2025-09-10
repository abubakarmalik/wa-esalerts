// server/src/config/helper.js
// OpenWA client helpers + DB glue (bundled Chromium; no executablePath)

const fs = require('fs');
const path = require('path');
const { create, ev } = require('@open-wa/wa-automate');
const { executeQuery, isConnected } = require('./db');
const { execFile } = require('child_process');

// ======== Settings ========
const SESSION_DIR = path.join(process.cwd(), 'wa-openwa-session');
const SESSION_ID = process.env.WA_SESSION_ID || 'openwa-session';
const ACK_SLEEP_MS = 500;
let BROWSER_PID = null; // <— ADD

// ======== Logging & Utils ========
const now = () => new Date().toISOString();
const log = (lvl, msg) => console[lvl](`[${now()}] ${msg}`);
const logInfo = (m) => log('log', `INFO: ${m}`);
const logWarn = (m) => log('warn', `WARN: ${m}`);
const logErr = (m) => log('error', `ERROR: ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
function getBrowserPid() {
  return BROWSER_PID;
} // <— ADD

// ======== Number formatting (Pakistan + general) ========
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
    restartOnCrash: false,
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

  // … your existing create({ … }) call above …

  // Capture Puppeteer Browser PID for safe shutdowns later
  try {
    const browser =
      client.pupBrowser ||
      (typeof client.getPuppeteerBrowser === 'function' &&
        (await client.getPuppeteerBrowser())) ||
      null;

    BROWSER_PID =
      typeof browser?.process === 'function' ? browser.process()?.pid : null;
  } catch {
    BROWSER_PID = null;
  }

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
  // if (!fs.existsSync(filePath)) throw new Error('file does not exist');
  return { mode: 'media', filePath, caption };
}

async function getBroadcastNumbersFromDb(branchCode) {
  if (!isConnected())
    throw new Error('No active database connection. Connect DB first.');

  const sqlText = `
    EXEC dbo.GetStudentContactNumbers @BranchCode = @Branch
  `;
  const result = await executeQuery(sqlText, {
    Branch: String(branchCode ?? 'All'),
  });

  if (!result.success)
    throw new Error(result.message || 'Failed to fetch numbers');

  // If you applied the DISTINCT/LTRIM in the proc, this is already clean:
  return (result.data || [])
    .map((r) => (r.SMSTo || r.fldCell1 || '').trim())
    .filter(Boolean);
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

function taskkillWin(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve();
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => resolve());
  });
}

// Kill any Chromium whose command line contains a unique fragment (e.g., session dir)
function psKillByCommandLineFragment(fragment) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !fragment) return resolve();
    const cmd = [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${fragment.replace(
        /\\/g,
        '\\\\',
      )}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
    ];
    execFile('powershell.exe', cmd, () => resolve());
  });
}

// Graceful + safe hard-close for OpenWA (no wmic, no waClient.kill())
// - Kills by saved PID
// - Also tries live PID from Puppeteer
// - Last resort: PowerShell kill by session folder tag
async function safeCloseOpenWA(client) {
  if (!client) return;

  // DEFAULT session tag = folder name "wa-openwa-session" (unique in command line)
  const sessionTag = path.basename(SESSION_DIR);

  let browser = null;
  let livePid = null;

  // Try to obtain live Puppeteer browser + PID
  try {
    browser =
      client.pupBrowser ||
      (typeof client.getPuppeteerBrowser === 'function' &&
        (await client.getPuppeteerBrowser())) ||
      null;

    livePid =
      typeof browser?.process === 'function' ? browser.process()?.pid : null;
  } catch {
    livePid = null;
  }

  // Windows: hard-kill by PID (saved & live) then by command line tag
  if (process.platform === 'win32') {
    // 1) Kill saved PID if we captured it
    try {
      await taskkillWin(BROWSER_PID);
    } catch {}
    // 2) Kill live PID if different
    try {
      if (livePid && livePid !== BROWSER_PID) {
        await taskkillWin(livePid);
      }
    } catch {}
    // 3) Kill any remaining matching processes by command line (session dir)
    try {
      await psKillByCommandLineFragment(sessionTag);
    } catch {}
    return;
  }

  // Non-Windows: best-effort graceful close
  try {
    await browser?.close?.();
  } catch {}
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
  taskkillWin,
  //
  getBrowserPid, // <— ADD
  psKillByCommandLineFragment, // (optional export)
  safeCloseOpenWA, // <— ADD

  // Broadcast
  prepareBroadcastPayload,
  getBroadcastNumbersFromDb,
  sendBroadcastToOne,
};
