'use strict';
const { getDb } = require('./db');

async function logEntry(caseReference, entry) {
  const db = getDb();

  const countRow = await db.get(
    'SELECT COUNT(*) AS cnt FROM case_log WHERE case_reference = ?',
    [caseReference]
  );
  const entryNumber = (countRow ? countRow.cnt : 0) + 1;

  const now = new Date();
  const row = {
    case_reference: caseReference,
    entry_number:   entryNumber,
    date:           now.toISOString().split('T')[0],
    time:           now.toTimeString().split(' ')[0],
    event_type:     entry.event_type   || 'Note',
    actor:          entry.by           || 'System',
    details:        entry.details      || '',
    status_after:   entry.status_after || '',
  };

  await db.run(
    `INSERT INTO case_log
       (case_reference, entry_number, date, time, event_type, actor, details, status_after)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.case_reference, row.entry_number, row.date, row.time,
     row.event_type, row.actor, row.details, row.status_after]
  );

  // Return in the shape callers previously expected
  return {
    entry_number: row.entry_number,
    date:         row.date,
    time:         row.time,
    event_type:   row.event_type,
    by:           row.actor,
    details:      row.details,
    status_after: row.status_after,
  };
}

async function readLog(caseReference) {
  const db = getDb();
  return db.all(
    `SELECT entry_number, date, time, event_type, actor AS by, details, status_after
       FROM case_log
      WHERE case_reference = ?
      ORDER BY entry_number ASC`,
    [caseReference]
  );
}

module.exports = { logEntry, readLog };
