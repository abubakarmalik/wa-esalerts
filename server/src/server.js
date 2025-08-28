const express = require('express');
const cors = require('cors');
const routes = require('./routes');
require('dotenv').config();
const { loadPersistedConnectionIfAny } = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api', routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  // Try to auto-connect DB using persisted config
  const result = await loadPersistedConnectionIfAny();
  if (result.success) {
    console.log('🔌', result.message);
  } else {
    console.log('ℹ️', result.message);
    if (result.error) console.log('   Reason:', result.error);
  }
});
