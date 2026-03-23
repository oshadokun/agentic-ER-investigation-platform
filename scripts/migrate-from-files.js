#!/usr/bin/env node
/**
 * migrate-from-files.js
 *
 * One-time migration from the file-based storage format to SQLite.
 * Safe to re-run: rows already in the database are skipped (idempotent).
 * Original files are never modified or deleted.
 *
 * Usage:
 *   node scripts/migrate-from-files.js
 *
 * Exit codes:
 *   0 — migration completed (may include individual item failures)
 *   1 — startup error (encryption key or DB problem)
 */
'use strict';
require('dotenv').config();

const fs   = require('fs-extra');
const path = require('path');

// Validate environment before touching the DB
const { validateKey, encrypt } = require('../lib/encryption');
const { getDb, closeDb }       = require('../lib/db');

try {
  validateKey();
} catch (err) {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
}

const DATA_PATH  = path.resolve(process.env.DATA_PATH   || './data');
const CASES_PATH = path.resolve(process.env.CASE_FILES_PATH || './cases');

// ── helpers ─────────────────────────────────────────────────────────────────

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function isoDate(d) {
  // Normalise whatever date string to YYYY-MM-DD
  if (!d) return new Date().toISOString().split('T')[0];
  const parsed = new Date(d);
  return isNaN(parsed) ? d : parsed.toISOString().split('T')[0];
}

// ── summary accumulator ──────────────────────────────────────────────────────

const summary = {
  case_sequence:   { status: 'skipped', note: 'no file found' },
  cases:           { total: 0, imported: 0, skipped: 0, failed: [] },
  case_logs:       { total: 0, imported: 0, skipped: 0, failed: [] },
  name_maps:       { total: 0, imported: 0, skipped: 0, failed: [] },
  quality_reviews: { total: 0, imported: 0, skipped: 0, failed: [] },
};

// ── migrate case_sequence ────────────────────────────────────────────────────

async function migrateCaseSequence(db) {
  const filePath = path.join(DATA_PATH, 'case_sequence.json');
  if (!fs.existsSync(filePath)) {
    summary.case_sequence = { status: 'skipped', note: 'file not found — nothing to import' };
    return;
  }

  let data;
  try {
    data = readJson(filePath);
  } catch (err) {
    summary.case_sequence = { status: 'failed', note: `JSON parse error: ${err.message}` };
    return;
  }

  const year       = data.year || new Date().getFullYear();
  const lastNumber = data.last || data.last_number || 0;  // handle both field names

  const existing = await db.get(
    'SELECT last_number FROM case_sequence WHERE year = ?',
    [year]
  );
  if (existing) {
    summary.case_sequence = {
      status: 'skipped',
      note:   `year ${year} already in DB with last_number=${existing.last_number}`,
    };
    return;
  }

  await db.run(
    'INSERT INTO case_sequence (year, last_number) VALUES (?, ?)',
    [year, lastNumber]
  );
  summary.case_sequence = { status: 'imported', year, last_number: lastNumber };
}

// ── migrate cases from case_tracker.json ────────────────────────────────────

async function migrateCases(db) {
  const filePath = path.join(DATA_PATH, 'case_tracker.json');
  if (!fs.existsSync(filePath)) {
    summary.cases.note = 'case_tracker.json not found — nothing to import';
    return;
  }

  let tracker;
  try {
    tracker = readJson(filePath);
  } catch (err) {
    summary.cases.failed.push({ file: filePath, error: `JSON parse error: ${err.message}` });
    return;
  }

  if (!Array.isArray(tracker)) {
    summary.cases.failed.push({ file: filePath, error: 'Expected an array' });
    return;
  }

  summary.cases.total = tracker.length;

  for (const c of tracker) {
    const ref = c.case_reference;
    if (!ref) {
      summary.cases.failed.push({ ref: '(unknown)', error: 'Missing case_reference field' });
      continue;
    }
    try {
      const existing = await db.get('SELECT 1 FROM cases WHERE case_reference = ?', [ref]);
      if (existing) {
        summary.cases.skipped++;
        continue;
      }

      await db.run(
        `INSERT INTO cases
           (case_reference, case_type, complexity, date_opened, target_date,
            phase, status, next_action, escalation_level, legal_involved,
            documents, timeline_status, date_closed, outcomes, duration_days)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ref,
          c.case_type        || 'Unknown',
          c.complexity       || 'Medium',
          isoDate(c.date_opened),
          isoDate(c.target_date),
          c.phase            || 1,
          c.status           || 'Open',
          c.next_action      || null,
          c.escalation_level || 'None',
          c.legal_involved   ? 1 : 0,
          JSON.stringify(c.documents || []),
          c.timeline_status  || 'On Track',
          c.date_closed      || null,
          c.outcomes         ? JSON.stringify(c.outcomes) : null,
          c.duration_days    || null,
        ]
      );
      summary.cases.imported++;
    } catch (err) {
      summary.cases.failed.push({ ref, error: err.message });
    }
  }
}

// ── migrate quality_reviews from quality_trends.json ────────────────────────

async function migrateQualityReviews(db) {
  const filePath = path.join(DATA_PATH, 'quality_trends.json');
  if (!fs.existsSync(filePath)) {
    summary.quality_reviews.note = 'quality_trends.json not found — nothing to import';
    return;
  }

  let trends;
  try {
    trends = readJson(filePath);
  } catch (err) {
    summary.quality_reviews.failed.push({ file: filePath, error: `JSON parse error: ${err.message}` });
    return;
  }

  if (!Array.isArray(trends)) {
    summary.quality_reviews.failed.push({ file: filePath, error: 'Expected an array' });
    return;
  }

  summary.quality_reviews.total = trends.length;

  for (const t of trends) {
    const ref = t.case_reference;
    if (!ref) {
      summary.quality_reviews.failed.push({ ref: '(unknown)', error: 'Missing case_reference' });
      continue;
    }
    try {
      // Idempotency: skip if a review for the same case+doctype+date already exists
      const existing = await db.get(
        `SELECT 1 FROM quality_reviews
          WHERE case_reference = ? AND document_type = ? AND date = ?`,
        [ref, t.document_type || 'Unknown', isoDate(t.date)]
      );
      if (existing) {
        summary.quality_reviews.skipped++;
        continue;
      }

      await db.run(
        `INSERT INTO quality_reviews
           (case_reference, document_type, case_type, complexity, overall_score, result, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ref,
          t.document_type  || 'Unknown',
          t.case_type      || 'Unknown',
          t.complexity     || 'Medium',
          t.overall_score  ?? 0,
          t.result         || 'UNKNOWN',
          isoDate(t.date),
        ]
      );
      summary.quality_reviews.imported++;
    } catch (err) {
      summary.quality_reviews.failed.push({ ref, error: err.message });
    }
  }
}

// ── migrate per-case logs and NameMaps ──────────────────────────────────────

async function migrateCaseLogs(db, caseRef) {
  const logPath = path.join(CASES_PATH, caseRef, '00_CASE_LOG', `${caseRef}_Case_Log.json`);
  if (!fs.existsSync(logPath)) return;

  let entries;
  try {
    entries = readJson(logPath);
  } catch (err) {
    summary.case_logs.failed.push({ ref: caseRef, error: `JSON parse error: ${err.message}` });
    return;
  }

  if (!Array.isArray(entries)) {
    summary.case_logs.failed.push({ ref: caseRef, error: 'Expected an array in case log' });
    return;
  }

  summary.case_logs.total += entries.length;

  for (const entry of entries) {
    try {
      const existing = await db.get(
        'SELECT 1 FROM case_log WHERE case_reference = ? AND entry_number = ?',
        [caseRef, entry.entry_number]
      );
      if (existing) {
        summary.case_logs.skipped++;
        continue;
      }

      await db.run(
        `INSERT INTO case_log
           (case_reference, entry_number, date, time, event_type, actor, details, status_after)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseRef,
          entry.entry_number || 1,
          entry.date         || isoDate(null),
          entry.time         || '00:00:00',
          entry.event_type   || 'Note',
          entry.by           || 'System',   // JSON files used 'by'; DB uses 'actor'
          entry.details      || '',
          entry.status_after || '',
        ]
      );
      summary.case_logs.imported++;
    } catch (err) {
      summary.case_logs.failed.push({ ref: caseRef, entry: entry.entry_number, error: err.message });
    }
  }
}

async function migrateNameMap(db, caseRef) {
  const nmPath = path.join(CASES_PATH, caseRef, '00_CASE_LOG', `${caseRef}_NameMap.json`);
  if (!fs.existsSync(nmPath)) return;

  summary.name_maps.total++;

  try {
    const existing = await db.get(
      'SELECT 1 FROM name_maps WHERE case_reference = ?',
      [caseRef]
    );
    if (existing) {
      summary.name_maps.skipped++;
      return;
    }

    const rawJson = fs.readFileSync(nmPath, 'utf8');
    // Validate it parses before encrypting
    JSON.parse(rawJson);

    const { encrypted_data, iv, auth_tag } = encrypt(rawJson);
    await db.run(
      `INSERT INTO name_maps (case_reference, encrypted_data, iv, auth_tag)
       VALUES (?, ?, ?, ?)`,
      [caseRef, encrypted_data, iv, auth_tag]
    );
    summary.name_maps.imported++;
  } catch (err) {
    summary.name_maps.failed.push({ ref: caseRef, error: err.message });
  }
}

// ── discover all case directories ───────────────────────────────────────────

function discoverCaseRefs() {
  if (!fs.existsSync(CASES_PATH)) return [];
  return fs.readdirSync(CASES_PATH).filter(name => {
    const full = path.join(CASES_PATH, name);
    return fs.statSync(full).isDirectory() && /^ER-\d{4}-\d{4}-[A-Z]+$/.test(name);
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n=== ER Investigation Platform — File → Database Migration ===\n');
  console.log(`Data path:  ${DATA_PATH}`);
  console.log(`Cases path: ${CASES_PATH}\n`);

  const db = getDb();

  await migrateCaseSequence(db);
  await migrateCases(db);
  await migrateQualityReviews(db);

  const caseRefs = discoverCaseRefs();
  console.log(`Found ${caseRefs.length} case director${caseRefs.length === 1 ? 'y' : 'ies'} to process.`);

  for (const ref of caseRefs) {
    // Case row must exist before we can insert logs or NameMap (FK constraint)
    const caseExists = await db.get(
      'SELECT 1 FROM cases WHERE case_reference = ?',
      [ref]
    );
    if (!caseExists) {
      // The case was in a case directory but not in case_tracker.json —
      // log it but don't fail the whole migration.
      summary.case_logs.failed.push({ ref, error: 'No cases row found — skipping logs and NameMap for this case' });
      summary.name_maps.failed.push({ ref, error: 'No cases row found — skipping NameMap for this case' });
      continue;
    }
    await migrateCaseLogs(db, ref);
    await migrateNameMap(db, ref);
  }

  closeDb();

  // ── Print summary ──────────────────────────────────────────────────────────
  console.log('\n=== Migration Summary ===\n');

  console.log('Case sequence:');
  console.log(`  Status: ${summary.case_sequence.status}`);
  if (summary.case_sequence.note) console.log(`  Note:   ${summary.case_sequence.note}`);

  console.log('\nCases (from case_tracker.json):');
  console.log(`  Total:    ${summary.cases.total}`);
  console.log(`  Imported: ${summary.cases.imported}`);
  console.log(`  Skipped:  ${summary.cases.skipped}  (already in DB)`);
  if (summary.cases.failed.length) {
    console.log(`  Failed:   ${summary.cases.failed.length}`);
    summary.cases.failed.forEach(f => console.log(`    • ${f.ref}: ${f.error}`));
  }

  console.log('\nCase logs:');
  console.log(`  Total entries: ${summary.case_logs.total}`);
  console.log(`  Imported:      ${summary.case_logs.imported}`);
  console.log(`  Skipped:       ${summary.case_logs.skipped}  (already in DB)`);
  if (summary.case_logs.failed.length) {
    console.log(`  Failed:        ${summary.case_logs.failed.length}`);
    summary.case_logs.failed.forEach(f =>
      console.log(`    • ${f.ref}${f.entry ? ` entry #${f.entry}` : ''}: ${f.error}`)
    );
  }

  console.log('\nName maps:');
  console.log(`  Total:    ${summary.name_maps.total}`);
  console.log(`  Imported: ${summary.name_maps.imported}  (encrypted at rest)`);
  console.log(`  Skipped:  ${summary.name_maps.skipped}  (already in DB)`);
  if (summary.name_maps.failed.length) {
    console.log(`  Failed:   ${summary.name_maps.failed.length}`);
    summary.name_maps.failed.forEach(f => console.log(`    • ${f.ref}: ${f.error}`));
  }

  console.log('\nQuality reviews (from quality_trends.json):');
  console.log(`  Total:    ${summary.quality_reviews.total}`);
  console.log(`  Imported: ${summary.quality_reviews.imported}`);
  console.log(`  Skipped:  ${summary.quality_reviews.skipped}  (already in DB)`);
  if (summary.quality_reviews.failed.length) {
    console.log(`  Failed:   ${summary.quality_reviews.failed.length}`);
    summary.quality_reviews.failed.forEach(f => console.log(`    • ${f.ref}: ${f.error}`));
  }

  const anyFailed =
    summary.cases.failed.length +
    summary.case_logs.failed.length +
    summary.name_maps.failed.length +
    summary.quality_reviews.failed.length;

  console.log(anyFailed > 0
    ? `\n⚠  Migration completed with ${anyFailed} failure(s). Review failures above.`
    : '\n✓  Migration completed successfully. Original files have not been modified.'
  );
  console.log();
}

run().catch(err => {
  console.error('\nUnhandled migration error:', err.message);
  closeDb();
  process.exit(1);
});
