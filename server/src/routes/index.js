const express = require('express');
const {
  databaseConnection,
  getAllRecords,
  closeConnectionWithDb,
  sendWhatsAppMessages,
  stopMassageSender,
  broadcastCustomMassage,
} = require('../controller');

const router = express.Router();

// Initialize database connection with user-provided settings
router.post('/database-connection', databaseConnection);

// Get all records from ES_SMS table where SendStatus = 0
router.get('/getrecords', getAllRecords);

//send whatsapp message
router.post('/send-messages', sendWhatsAppMessages);

// Stop WhatsApp sender loop (hard stop)
router.post('/stop-sender', stopMassageSender);

// broadcast custom massage
router.post('/broadcast', broadcastCustomMassage);

// Route to close the database connection
router.post('/close-database-connection', closeConnectionWithDb);

module.exports = router;
