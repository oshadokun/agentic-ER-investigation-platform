'use strict';
/**
 * tests/audit-chain.test.js
 *
 * Tests for the SHA-256 hash chain on audit_events.
 * Conditions covered:
 *   - Correct hash computation
 *   - Chain continuity across multiple events
 *   - Detection of a tampered row
 *   - Detection of a deleted row (gap in sequence)
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os   = require('os');
const path = require('path');
const fs   = require('fs-extra');
const crypto = require('crypto');

process.env.NAMEMAP_ENCRYPTION_KEY = 'd'.repeat(64);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDb() {
  const dbPath = path.join(os.tmpdir(), `er_audit_test_${Date.now()}.db`);
  process.env.DATABASE_PATH = dbPath;

  // Clear module cache so we get a fresh DB singleton
  Object.keys(require.cache).forEach(k => {
    if (k.includes('lib/db') || k.includes('lib\\db') ||
        k.includes('lib/audit') || k.includes('lib\\audit')) {
      delete require.cache[k];
    }
  });

  const { getDb, closeDb } = require('../lib/db');
  const { recordAuditEvent } = require('../lib/audit');
  const { computeRowHash, GENESIS_HASH } = require('../lib/db/migrations');

  getDb(); // open and migrate
  return { dbPath, getDb, closeDb, recordAuditEvent, computeRowHash, GENESIS_HASH };
}

function cleanup(env) {
  env.closeDb();
  fs.removeSync(env.dbPath);
  // Clear module cache so next makeDb() gets a fresh singleton
  Object.keys(require.cache).forEach(k => {
    if (k.includes('lib/db') || k.includes('lib\\db') ||
        k.includes('lib/audit') || k.includes('lib\\audit')) {
      delete require.cache[k];
    }
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Audit chain — hash computation', () => {
  test('first row uses genesis hash as prev_hash and computes correct row_hash', async () => {
    const env = makeDb();
    try {
      await env.recordAuditEvent({
        case_reference: 'ER-2026-0001-GR',
        event_type:     'DOCUMENT_APPROVED',
        details:        { doc: 'Test' },
        actor:          'system',
      });

      const row = env.getDb()._db
        .prepare('SELECT * FROM audit_events ORDER BY id ASC LIMIT 1')
        .get();

      assert.ok(row, 'Row should exist');
      assert.equal(row.prev_hash, env.GENESIS_HASH, 'prev_hash should be genesis hash');
      assert.ok(row.row_hash && row.row_hash.length === 64, 'row_hash should be 64 hex chars');

      // Recompute and verify
      const expected = env.computeRowHash({
        prev_hash:      env.GENESIS_HASH,
        id:             row.id,
        case_reference: row.case_reference || '',
        document_id:    row.document_id,
        event_type:     row.event_type,
        details:        row.details || '',
        actor:          row.actor   || '',
        created_at:     row.created_at,
      });
      assert.equal(row.row_hash, expected, 'row_hash should match recomputed value');
    } finally {
      cleanup(env);
    }
  });

  test('genesis hash is SHA-256 of the string "genesis"', () => {
    // Re-require to avoid cache issues with other tests
    const { GENESIS_HASH } = require('../lib/db/migrations');
    const expected = crypto.createHash('sha256').update('genesis').digest('hex');
    assert.equal(GENESIS_HASH, expected);
  });
});

describe('Audit chain — chain continuity', () => {
  test('multiple events form a continuous chain: each prev_hash = previous row_hash', async () => {
    const env = makeDb();
    try {
      const events = [
        { case_reference: 'ER-2026-0010-GR', event_type: 'VALIDATION_FAILED', actor: 'system' },
        { case_reference: 'ER-2026-0010-GR', event_type: 'DOCUMENT_APPROVED', actor: 'consultant' },
        { case_reference: 'ER-2026-0011-DI', event_type: 'QUALITY_PARSE_ERROR', actor: 'system' },
      ];
      for (const e of events) await env.recordAuditEvent(e);

      const rows = env.getDb()._db
        .prepare('SELECT * FROM audit_events ORDER BY id ASC')
        .all()
        .filter(r => r.event_type !== 'DOCUMENT_GENERATED'); // exclude any seeded rows

      assert.ok(rows.length >= 3, 'Should have at least 3 rows');

      // Verify the chain: each row's prev_hash = previous row's row_hash
      let prevHash = env.GENESIS_HASH;
      for (const row of rows) {
        assert.equal(row.prev_hash, prevHash,
          `Row ${row.id}: prev_hash should equal previous row_hash`);
        assert.ok(row.row_hash && row.row_hash.length === 64,
          `Row ${row.id}: row_hash should be 64 chars`);
        prevHash = row.row_hash;
      }
    } finally {
      cleanup(env);
    }
  });
});

describe('Audit chain — tamper detection', () => {
  test('verify-audit-chain detects a tampered row', async () => {
    const env = makeDb();
    try {
      await env.recordAuditEvent({
        case_reference: 'ER-2026-0020-BH',
        event_type:     'DOCUMENT_APPROVED',
        details:        { sensitive: 'original' },
        actor:          'consultant',
      });
      await env.recordAuditEvent({
        case_reference: 'ER-2026-0020-BH',
        event_type:     'VALIDATION_FAILED',
        actor:          'system',
      });

      const rows = env.getDb()._db
        .prepare('SELECT * FROM audit_events ORDER BY id ASC')
        .all();

      // Tamper: change the details field of the first row
      env.getDb()._db
        .prepare("UPDATE audit_events SET details = ? WHERE id = ?")
        .run('{"sensitive":"TAMPERED"}', rows[0].id);

      // Now recompute: the first row's hash will not match
      const row = env.getDb()._db
        .prepare('SELECT * FROM audit_events WHERE id = ?')
        .get(rows[0].id);

      const recomputed = env.computeRowHash({
        prev_hash:      row.prev_hash,
        id:             row.id,
        case_reference: row.case_reference || '',
        document_id:    row.document_id,
        event_type:     row.event_type,
        details:        row.details || '',
        actor:          row.actor   || '',
        created_at:     row.created_at,
      });

      assert.notEqual(recomputed, row.row_hash,
        'Recomputed hash should differ from stored hash after tampering');
    } finally {
      cleanup(env);
    }
  });
});

describe('Audit chain — deleted row detection', () => {
  test('gap in id sequence is detectable by the verifier logic', async () => {
    const env = makeDb();
    try {
      // Insert 3 rows
      await env.recordAuditEvent({ case_reference: 'ER-2026-0030-WB', event_type: 'VALIDATION_FAILED', actor: 'system' });
      await env.recordAuditEvent({ case_reference: 'ER-2026-0030-WB', event_type: 'DOCUMENT_APPROVED', actor: 'consultant' });
      await env.recordAuditEvent({ case_reference: 'ER-2026-0030-WB', event_type: 'QUALITY_FAILED',    actor: 'system' });

      const rows = env.getDb()._db
        .prepare('SELECT id FROM audit_events ORDER BY id ASC')
        .all();

      // Delete the middle row (simulates a deleted audit event)
      const middleId = rows[Math.floor(rows.length / 2)].id;
      env.getDb()._db.prepare('DELETE FROM audit_events WHERE id = ?').run(middleId);

      // Check for gap
      const remaining = env.getDb()._db
        .prepare('SELECT id FROM audit_events ORDER BY id ASC')
        .all();

      let gapDetected = false;
      for (let i = 1; i < remaining.length; i++) {
        if (remaining[i].id !== remaining[i - 1].id + 1) {
          gapDetected = true;
          break;
        }
      }
      assert.ok(gapDetected, 'Gap in id sequence should be detectable after row deletion');
    } finally {
      cleanup(env);
    }
  });
});
