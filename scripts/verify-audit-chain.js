#!/usr/bin/env node
/**
 * scripts/verify-audit-chain.js
 *
 * Verifies the integrity of the audit_events hash chain.
 *
 * Usage:
 *   node scripts/verify-audit-chain.js
 *   npm run verify-audit-chain
 *
 * Exit codes:
 *   0 — chain is intact (all hashes verified)
 *   1 — chain broken (tampered row, deleted row, or hash mismatch)
 *   2 — startup error (DB or key problem)
 */
'use strict';
require('dotenv').config();

const { validateKey }                    = require('../lib/encryption');
const { getDb, closeDb }                 = require('../lib/db');
const { computeRowHash, GENESIS_HASH }   = require('../lib/db/migrations');

try {
  validateKey();
} catch (err) {
  console.error(`FATAL: ${err.message}`);
  process.exit(2);
}

function run() {
  console.log('\n=== ER Investigation Platform — Audit Chain Verification ===\n');

  const db   = getDb();
  const rows = db._db
    .prepare('SELECT * FROM audit_events ORDER BY id ASC')
    .all();

  if (rows.length === 0) {
    console.log('No audit events found. Chain is vacuously valid.\n');
    console.log('✓ PASS — 0 events checked.\n');
    closeDb();
    process.exit(0);
  }

  let prev_hash        = GENESIS_HASH;
  let checkedCount     = 0;
  let brokenAt         = null;
  let lastId           = null;

  for (const row of rows) {
    checkedCount++;

    // Detect gap in id sequence (deleted row)
    if (lastId !== null && row.id !== lastId + 1) {
      brokenAt = {
        id:     row.id,
        reason: `Gap detected — expected id ${lastId + 1}, found id ${row.id}. Row(s) may have been deleted.`,
      };
      break;
    }
    lastId = row.id;

    // Row has no hash (should not happen after startup backfill)
    if (!row.row_hash) {
      brokenAt = {
        id:     row.id,
        reason: 'Row has no row_hash. Backfill may not have run.',
      };
      break;
    }

    // Recompute and compare
    const expected = computeRowHash({
      prev_hash:      prev_hash,
      id:             row.id,
      case_reference: row.case_reference || '',
      document_id:    row.document_id,
      event_type:     row.event_type,
      details:        row.details || '',
      actor:          row.actor   || '',
      created_at:     row.created_at,
    });

    if (row.row_hash !== expected) {
      brokenAt = {
        id:       row.id,
        reason:   `Hash mismatch on row id=${row.id}. Expected ${expected}, got ${row.row_hash}. Row may have been tampered with.`,
      };
      break;
    }

    // Verify the stored prev_hash matches what we expected
    const expectedPrev = prev_hash;
    if (row.prev_hash !== expectedPrev) {
      brokenAt = {
        id:     row.id,
        reason: `prev_hash mismatch on row id=${row.id}. Chain is broken before this row.`,
      };
      break;
    }

    prev_hash = row.row_hash;
  }

  closeDb();

  console.log(`Events checked:   ${checkedCount}`);
  console.log(`Total rows in DB: ${rows.length}`);

  if (brokenAt) {
    console.log(`\nFirst broken link: id=${brokenAt.id}`);
    console.log(`Reason:            ${brokenAt.reason}\n`);
    console.log('✗ FAIL — audit chain integrity check failed.\n');
    process.exit(1);
  }

  console.log('\n✓ PASS — audit chain is intact. All hashes verified.\n');
  process.exit(0);
}

run();
