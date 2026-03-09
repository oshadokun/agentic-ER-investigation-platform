const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

const BASE_PATH = process.env.CASE_FILES_PATH || './cases';

async function logEntry(caseReference, entry) {
  const logPath = path.join(
    BASE_PATH, caseReference, '00_CASE_LOG', `${caseReference}_Case_Log.json`
  );
  await fs.ensureDir(path.dirname(logPath));

  let log = [];
  if (await fs.pathExists(logPath)) {
    log = JSON.parse(await fs.readFile(logPath, 'utf8'));
  }

  log.push({
    entry_number: log.length + 1,
    date:         new Date().toISOString().split('T')[0],
    time:         new Date().toTimeString().split(' ')[0],
    event_type:   entry.event_type   || 'Note',
    by:           entry.by           || 'System',
    details:      entry.details      || '',
    status_after: entry.status_after || '',
  });

  await fs.writeFile(logPath, JSON.stringify(log, null, 2), 'utf8');
  return log[log.length - 1];
}

async function readLog(caseReference) {
  const logPath = path.join(
    BASE_PATH, caseReference, '00_CASE_LOG', `${caseReference}_Case_Log.json`
  );
  if (!(await fs.pathExists(logPath))) return [];
  return JSON.parse(await fs.readFile(logPath, 'utf8'));
}

module.exports = { logEntry, readLog };
