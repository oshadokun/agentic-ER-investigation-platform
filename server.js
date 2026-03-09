const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'ui')));

app.use('/api/cases',     require('./api/cases'));
app.use('/api/documents', require('./api/documents'));
app.use('/api/tracker',   require('./api/tracker'));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'ui', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nER Investigation Platform → http://localhost:${PORT}`);
  console.log(`Model: ${process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'}`);
  console.log(`Case files: ${process.env.CASE_FILES_PATH || './cases'}\n`);
});
