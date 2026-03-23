'use strict';
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const SCHEMA_PATH  = path.join(__dirname, 'schema.sql');
const GENESIS_HASH = crypto.createHash('sha256').update('genesis').digest('hex');

/**
 * Canonical hash input for an audit_events row.
 * The separator ('|') and field order must never change once deployed —
 * changing either would break chain verification for existing rows.
 */
function computeRowHash({ prev_hash, id, case_reference, document_id, event_type, details, actor, created_at }) {
  const input = [
    prev_hash          || '',
    String(id),
    case_reference     || '',
    String(document_id || ''),
    event_type         || '',
    details            || '',
    actor              || '',
    created_at         || '',
  ].join('|');
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Applies the base schema DDL to the database.
 * All CREATE TABLE statements use IF NOT EXISTS — safe to run every startup.
 */
function _applySchema(adapter) {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  adapter.exec(schema);
}

/**
 * Adds any columns to audit_events that may be missing (SQLite does not
 * add columns via CREATE TABLE IF NOT EXISTS on pre-existing tables).
 * Each ALTER is guarded by a PRAGMA column check — fully idempotent.
 */
function _addAuditHashColumns(adapter) {
  const cols = adapter._db.prepare('PRAGMA table_info(audit_events)').all();
  const names = new Set(cols.map(c => c.name));

  if (!names.has('prev_hash')) {
    adapter._db.exec('ALTER TABLE audit_events ADD COLUMN prev_hash TEXT');
  }
  if (!names.has('row_hash')) {
    adapter._db.exec('ALTER TABLE audit_events ADD COLUMN row_hash TEXT');
  }
}

/**
 * Backfills prev_hash / row_hash for any audit_events rows that pre-date
 * the hash chain (Phase 3 rows written before Phase 4 was deployed).
 *
 * Backfill rules:
 *  - Order: ascending id (the canonical chain order)
 *  - Genesis: prev_hash for id=1 is SHA-256('genesis')
 *  - If a row already has a non-empty row_hash it is trusted and used as
 *    the prev_hash for the next row (no re-computation for already-hashed rows)
 *  - Only rows with row_hash IS NULL or row_hash = '' are updated
 *
 * This runs on every startup but is a no-op once all rows are hashed.
 */
function _backfillAuditHashes(adapter) {
  const needsWork = adapter._db
    .prepare("SELECT COUNT(*) as n FROM audit_events WHERE row_hash IS NULL OR row_hash = ''")
    .get();
  if (!needsWork || needsWork.n === 0) return;

  // Load all rows in chain order to rebuild prev_hash correctly
  const rows = adapter._db
    .prepare('SELECT * FROM audit_events ORDER BY id ASC')
    .all();

  const updateStmt = adapter._db.prepare(
    'UPDATE audit_events SET prev_hash = ?, row_hash = ? WHERE id = ?'
  );

  const runBackfill = adapter._db.transaction(() => {
    let prev_hash = GENESIS_HASH;

    for (const row of rows) {
      if (row.row_hash && row.row_hash.length === 64) {
        // Already hashed — trust it and advance the chain pointer
        prev_hash = row.row_hash;
        continue;
      }
      const row_hash = computeRowHash({
        prev_hash,
        id:             row.id,
        case_reference: row.case_reference,
        document_id:    row.document_id,
        event_type:     row.event_type,
        details:        row.details,
        actor:          row.actor,
        created_at:     row.created_at,
      });
      updateStmt.run(prev_hash, row_hash, row.id);
      prev_hash = row_hash;
    }
  });

  runBackfill();
  console.log(`  ✓ audit_events: backfilled ${needsWork.n} unhashed row(s) into hash chain`);
}

/**
 * Adds recipient_category column to documents table if missing.
 * Guarded by PRAGMA — fully idempotent.
 */
function _addDocumentsRecipientColumn(adapter) {
  const cols = adapter._db.prepare('PRAGMA table_info(documents)').all();
  const names = new Set(cols.map(c => c.name));
  if (!names.has('recipient_category')) {
    adapter._db.exec('ALTER TABLE documents ADD COLUMN recipient_category TEXT');
  }
}

/**
 * Seeds the default settings rows (idempotent — uses INSERT OR IGNORE).
 * These are the swap point for runtime threshold configuration.
 */
function _seedDefaultSettings(adapter) {
  const defaults = [
    ['notification.upcoming_days', '7'],
    ['notification.overdue_days',  '0'],
  ];
  const stmt = adapter._db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of defaults) {
    stmt.run(key, value);
  }
}

/**
 * Main entry point. Called by getDb() on every startup.
 * Order matters: schema first, then column additions, then backfill, then seeds.
 */
function runMigrations(adapter) {
  _applySchema(adapter);
  _addAuditHashColumns(adapter);
  _addDocumentsRecipientColumn(adapter);
  _backfillAuditHashes(adapter);
  _seedDefaultSettings(adapter);
}

// Export computeRowHash and GENESIS_HASH so lib/audit.js and verify script
// use the same canonical implementation — single source of truth.
module.exports = { runMigrations, computeRowHash, GENESIS_HASH };
