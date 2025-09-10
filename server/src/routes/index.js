// server/src/routes/index.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controller/index');

// Sanity check to avoid "argument handler must be a function" errors
[
  'databaseConnection',
  'getAllRecords',
  'closeConnectionWithDb',
  'sendWhatsAppMessages',
  'stopMessageSender',
  'broadcastCustomMessage',
].forEach((fn) => {
  if (typeof ctrl[fn] !== 'function') {
    throw new Error(
      `Controller export "${fn}" is missing or not a function. Check controllers/index.js`,
    );
  }
});

// Your existing routes (kept the same URLs you were calling)
router.post('/db/connect', ctrl.databaseConnection);
router.post('/db/close', ctrl.closeConnectionWithDb);
router.get('/records', ctrl.getAllRecords);
router.get('/sender/start', ctrl.sendWhatsAppMessages);
router.post('/sender/stop', ctrl.stopMessageSender);
router.post('/broadcast', ctrl.broadcastCustomMessage);

module.exports = router;
