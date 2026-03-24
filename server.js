'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

// ── Startup validation ──────────────────────────────────────────────────────
// Both checks run before the HTTP server starts. A failure here is fatal:
// it means either the encryption key is missing/malformed, or the database
// cannot be opened. Either condition makes the app unsafe to run.

const { validateKey } = require('./lib/encryption');
const { getDb }       = require('./lib/db');

try {
  validateKey();
  console.log('✓ Encryption key validated');
} catch (err) {
  console.error(`\nFATAL: ${err.message}`);
  console.error('Set NAMEMAP_ENCRYPTION_KEY to a 64-character hex string (32 bytes).');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

try {
  getDb(); // opens DB file and runs schema migrations
  console.log('✓ Database ready');
} catch (err) {
  console.error(`\nFATAL: Failed to open database: ${err.message}`);
  process.exit(1);
}

// ── HTTP server ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'ui')));

app.use('/api/cases',            require('./api/cases'));
app.use('/api/documents',        require('./api/documents'));
app.use('/api/tracker',          require('./api/tracker'));
app.use('/api/policy-templates', require('./api/policy-templates'));
app.use('/api/notifications',    require('./api/notifications'));
app.use('/api/jobs',             require('./api/jobs'));
app.use('/api/intake-assist',    require('./api/intake-assist'));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'ui', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nER Investigation Platform → http://localhost:${PORT}`);
  console.log(`Model:      ${process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'}`);
  console.log(`Case files: ${process.env.CASE_FILES_PATH || './cases'}`);
  console.log(`Database:   ${process.env.DATABASE_PATH   || './data/er_platform.db'}\n`);
});
