// server/src/server.js
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
require('dotenv').config();

const { loadPersistedConnectionIfAny } = require('./config/db');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// API
app.use('/api', routes);

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, async () => {
  console.log(`Server is running on http://127.0.0.1:${PORT}`);

  // Optional: auto-connect DB if a config was persisted previously
  const result = await loadPersistedConnectionIfAny();
  if (result.success) {
    console.log('🔌', result.message);
  } else {
    console.log('ℹ️', result.message);
    if (result.error) console.log('   Reason:', result.error);
  }
});

server.keepAliveTimeout = 0;
server.headersTimeout = 0;
server.requestTimeout = 0;
