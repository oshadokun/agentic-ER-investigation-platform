const fs   = require('fs-extra');
const path = require('path');
const { logEntry } = require('../lib/logger');
require('dotenv').config();

const DATA_PATH    = './data';
const TRACKER_PATH = path.join(DATA_PATH, 'case_tracker.json');
const QUALITY_PATH = path.join(DATA_PATH, 'quality_trends.json');
const TARGET_DAYS  = { Low: 28, Medium: 42, High: 70, 'Very High': 98 };

async function getTracker() {
  await fs.ensureDir(DATA_PATH);
  if (!(await fs.pathExists(TRACKER_PATH))) return [];
  return JSON.parse(await fs.readFile(TRACKER_PATH, 'utf8'));
}

async function saveTracker(t) {
  await fs.writeFile(TRACKER_PATH, JSON.stringify(t, null, 2));
}

function calcTimeline(c) {
  const today        = new Date();
  const daysToTarget = Math.ceil((new Date(c.target_date) - today) / 86400000);
  return {
    days_open:       Math.ceil((today - new Date(c.date_opened)) / 86400000),
    days_to_target:  daysToTarget,
    timeline_status: daysToTarget > 7 ? 'On Track' : daysToTarget >= 0 ? 'At Risk' : 'Overdue'
  };
}

async function initialiseCase(input) {
  const tracker    = await getTracker();
  const openDate   = new Date();
  const targetDate = new Date(openDate);
  targetDate.setDate(targetDate.getDate() + (TARGET_DAYS[input.complexity] || 42));

  const newCase = {
    case_reference:   input.case_reference,
    case_type:        input.case_type,
    complexity:       input.complexity,
    date_opened:      openDate.toISOString().split('T')[0],
    target_date:      targetDate.toISOString().split('T')[0],
    phase:            1,
    status:           'Open',
    next_action:      'Review and approve acknowledgement letters',
    escalation_level: input.escalation_level,
    legal_involved:   input.legal_involved,
    documents:        [],
    timeline_status:  'On Track'
  };

  tracker.push(newCase);
  await saveTracker(tracker);
  return newCase;
}

async function updateCase(caseReference, updates) {
  const tracker = await getTracker();
  const idx     = tracker.findIndex(c => c.case_reference === caseReference);
  if (idx === -1) return null;
  tracker[idx] = { ...tracker[idx], ...updates, ...calcTimeline(tracker[idx]) };
  await saveTracker(tracker);
  return tracker[idx];
}

async function getAllCases() {
  const tracker = await getTracker();
  return tracker.map(c => ({ ...c, ...calcTimeline(c) }));
}

async function logQualityReview(data) {
  await fs.ensureDir(DATA_PATH);
  let trends = [];
  if (await fs.pathExists(QUALITY_PATH)) trends = JSON.parse(await fs.readFile(QUALITY_PATH, 'utf8'));
  trends.push({ ...data, date: new Date().toISOString().split('T')[0] });
  await fs.writeFile(QUALITY_PATH, JSON.stringify(trends, null, 2));
}

async function closeCase(input) {
  const tracker = await getTracker();
  const idx     = tracker.findIndex(c => c.case_reference === input.case_reference);
  if (idx === -1) return { status: 'ERROR', message: 'Case not found' };

  tracker[idx] = {
    ...tracker[idx],
    status:        'Closed',
    date_closed:   input.closure_date,
    outcomes:      input.outcomes,
    duration_days: Math.ceil((new Date(input.closure_date) - new Date(tracker[idx].date_opened)) / 86400000)
  };

  await saveTracker(tracker);

  const metricsPath = path.join(
    process.env.CASE_FILES_PATH || './cases',
    input.case_reference, '10_CLOSURE',
    `${input.case_reference}_Case_Metrics.json`
  );
  await fs.writeFile(metricsPath, JSON.stringify({ ...tracker[idx], ...input }, null, 2));

  await logEntry(input.case_reference, {
    event_type:   'Case closed',
    by:           'Case Management Agent',
    details:      `Case closed. Duration: ${tracker[idx].duration_days} days.`,
    status_after: 'Closed'
  });

  return { status: 'CLOSED', case: tracker[idx] };
}

module.exports = { initialiseCase, updateCase, getAllCases, logQualityReview, closeCase };
