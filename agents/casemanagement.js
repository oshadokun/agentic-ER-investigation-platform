'use strict';
const { getDb }    = require('../lib/db');
const { logEntry } = require('../lib/logger');
require('dotenv').config();

const TARGET_DAYS = { Low: 28, Medium: 42, High: 70, 'Very High': 98 };

function calcTimeline(c) {
  const today        = new Date();
  const daysToTarget = Math.ceil((new Date(c.target_date) - today) / 86400000);
  return {
    days_open:      Math.ceil((today - new Date(c.date_opened)) / 86400000),
    days_to_target: daysToTarget,
    timeline_status: daysToTarget > 7 ? 'On Track' : daysToTarget >= 0 ? 'At Risk' : 'Overdue',
  };
}

function rowToCase(row) {
  return {
    ...row,
    legal_involved: Boolean(row.legal_involved),
    documents:      JSON.parse(row.documents || '[]'),
  };
}

/**
 * Creates a case record in the database.
 * Accepts an optional db parameter so it can be called inside a
 * caller-managed transaction (e.g. from coordinator.js).
 */
async function initialiseCase(input, db) {
  db = db || getDb();

  const openDate   = new Date();
  const targetDate = new Date(openDate);
  targetDate.setDate(targetDate.getDate() + (TARGET_DAYS[input.complexity] || 42));

  const dateOpened = openDate.toISOString().split('T')[0];
  const dateTgt    = targetDate.toISOString().split('T')[0];

  await db.run(
    `INSERT INTO cases
       (case_reference, case_type, complexity, date_opened, target_date,
        phase, status, next_action, escalation_level, legal_involved,
        documents, timeline_status)
     VALUES (?, ?, ?, ?, ?, 1, 'Open', ?, ?, ?, '[]', 'On Track')`,
    [
      input.case_reference,
      input.case_type,
      input.complexity,
      dateOpened,
      dateTgt,
      'Review and approve acknowledgement letters',
      input.escalation_level || 'None',
      input.legal_involved ? 1 : 0,
    ]
  );

  return {
    case_reference:   input.case_reference,
    case_type:        input.case_type,
    complexity:       input.complexity,
    date_opened:      dateOpened,
    target_date:      dateTgt,
    phase:            1,
    status:           'Open',
    next_action:      'Review and approve acknowledgement letters',
    escalation_level: input.escalation_level || 'None',
    legal_involved:   Boolean(input.legal_involved),
    documents:        [],
    timeline_status:  'On Track',
  };
}

async function updateCase(caseReference, updates) {
  const db  = getDb();
  const row = await db.get(
    'SELECT * FROM cases WHERE case_reference = ?',
    [caseReference]
  );
  if (!row) return null;

  const tl   = calcTimeline(row);
  const sets = [];
  const vals = [];

  const allowed = [
    'phase', 'status', 'next_action', 'escalation_level',
    'legal_involved', 'documents', 'timeline_status',
  ];
  for (const key of allowed) {
    if (key in updates) {
      sets.push(`${key} = ?`);
      vals.push(
        key === 'documents'     ? JSON.stringify(updates[key]) :
        key === 'legal_involved' ? (updates[key] ? 1 : 0) :
        updates[key]
      );
    }
  }
  sets.push('timeline_status = ?');
  vals.push(tl.timeline_status);
  sets.push("updated_at = datetime('now')");
  vals.push(caseReference);

  await db.run(
    `UPDATE cases SET ${sets.join(', ')} WHERE case_reference = ?`,
    vals
  );

  const updated = await db.get(
    'SELECT * FROM cases WHERE case_reference = ?',
    [caseReference]
  );
  return { ...rowToCase(updated), ...calcTimeline(updated) };
}

async function getAllCases() {
  const db   = getDb();
  const rows = await db.all('SELECT * FROM cases ORDER BY date_opened DESC');
  return rows.map(r => ({ ...rowToCase(r), ...calcTimeline(r) }));
}

async function logQualityReview(data) {
  const db = getDb();
  await db.run(
    `INSERT INTO quality_reviews
       (case_reference, document_type, case_type, complexity, overall_score, result, date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.case_reference,
      data.document_type,
      data.case_type,
      data.complexity,
      data.overall_score,
      data.result,
      new Date().toISOString().split('T')[0],
    ]
  );
}

async function closeCase(input) {
  const db  = getDb();
  const row = await db.get(
    'SELECT * FROM cases WHERE case_reference = ?',
    [input.case_reference]
  );
  if (!row) return { status: 'ERROR', message: 'Case not found' };

  const durationDays = Math.ceil(
    (new Date(input.closure_date) - new Date(row.date_opened)) / 86400000
  );

  await db.run(
    `UPDATE cases
        SET status = 'Closed', date_closed = ?, outcomes = ?,
            duration_days = ?, updated_at = datetime('now')
      WHERE case_reference = ?`,
    [
      input.closure_date,
      JSON.stringify(input.outcomes || []),
      durationDays,
      input.case_reference,
    ]
  );

  const fs   = require('fs-extra');
  const path = require('path');
  const metricsPath = path.join(
    process.env.CASE_FILES_PATH || './cases',
    input.case_reference, '10_CLOSURE',
    `${input.case_reference}_Case_Metrics.json`
  );
  await fs.ensureDir(path.dirname(metricsPath));
  await fs.writeFile(
    metricsPath,
    JSON.stringify({ ...rowToCase(row), ...input, duration_days: durationDays }, null, 2)
  );

  await logEntry(input.case_reference, {
    event_type:   'Case closed',
    by:           'Case Management Agent',
    details:      `Case closed. Duration: ${durationDays} days.`,
    status_after: 'Closed',
  });

  const updated = await db.get(
    'SELECT * FROM cases WHERE case_reference = ?',
    [input.case_reference]
  );
  return { status: 'CLOSED', case: rowToCase(updated) };
}

module.exports = { initialiseCase, updateCase, getAllCases, logQualityReview, closeCase };
