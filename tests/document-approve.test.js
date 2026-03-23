'use strict';
/**
 * tests/document-approve.test.js
 *
 * Tests for the approveDocument() flow in agents/document.js.
 *
 * Exercises the full code path against a real (temporary) SQLite database
 * and a real (temporary) case files directory. No mocks.
 *
 * Conditions verified:
 *   - DOCUMENT_APPROVED audit event is written to audit_events
 *   - The audit event carries: correct event_type, document_id, actor,
 *     and details containing document_type, format, version
 *   - documents.recipient_category is set correctly:
 *       Outcome Letter A → Complainant
 *       Outcome Letter B → Respondent
 *       Invitation Letter → Participant
 *       Any other type   → Internal
 *   - VALIDATION_OVERRIDE is written instead of DOCUMENT_APPROVED when override=true
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const os   = require('os');
const path = require('path');
const fs   = require('fs-extra');

process.env.NAMEMAP_ENCRYPTION_KEY = 'a'.repeat(64);

// ── Environment setup ─────────────────────────────────────────────────────────

const MODULE_PATTERNS = [
  'lib/db', 'lib\\db',
  'lib/audit', 'lib\\audit',
  'lib/filestore', 'lib\\filestore',
  'lib/logger', 'lib\\logger',
  'lib/merger', 'lib\\merger',
  'lib/converter', 'lib\\converter',
  'lib/converter-docx', 'lib\\converter-docx',
  'lib/converter-pdf', 'lib\\converter-pdf',
  'lib/settings', 'lib\\settings',
  'agents/document', 'agents\\document',
];

function clearCache() {
  Object.keys(require.cache).forEach(k => {
    if (MODULE_PATTERNS.some(p => k.includes(p))) delete require.cache[k];
  });
}

function makeEnv() {
  const base      = fs.mkdtempSync(path.join(os.tmpdir(), 'er_approve_test_'));
  const dbPath    = path.join(base, 'test.db');
  const casesPath = path.join(base, 'cases');
  fs.ensureDirSync(casesPath);

  // Set env vars before any module load
  process.env.DATABASE_PATH   = dbPath;
  process.env.CASE_FILES_PATH = casesPath;

  clearCache();

  const { getDb, closeDb }      = require('../lib/db');
  const { approveDocument }     = require('../agents/document');

  getDb(); // open and apply migrations (creates all tables + recipient_category column)

  return { base, dbPath, casesPath, getDb, closeDb, approveDocument };
}

function cleanup(env) {
  env.closeDb();
  fs.removeSync(env.base);
  clearCache();
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

function insertCase(env, ref) {
  env.getDb()._db.prepare(
    `INSERT INTO cases
       (case_reference, case_type, complexity, date_opened, target_date, status, escalation_level)
     VALUES (?, 'Grievance', 'Medium', date('now'), date('now', '+60 days'), 'Open', 'None')`
  ).run(ref);
}

function insertDocument(env, ref, docType) {
  const result = env.getDb()._db.prepare(
    `INSERT INTO documents (case_reference, document_type, status)
     VALUES (?, ?, 'VALIDATION_PASSED')`
  ).run(ref, docType);
  return result.lastInsertRowid;
}

// Minimal document text — contains "Dear [X]" so name merger finds no unmerged placeholders,
// meaning the function completes without a warning but still exercises every code branch.
const SAMPLE_TEXT = 'A short document for testing the approve flow.';

// Empty nameMap — no names to merge; all placeholders pass through unchanged.
const EMPTY_NAMEMAP = {};

// ── Tests — audit event ───────────────────────────────────────────────────────

describe('approveDocument — DOCUMENT_APPROVED audit event', () => {
  test('writes a DOCUMENT_APPROVED row to audit_events', async () => {
    const env = makeEnv();
    try {
      const REF = 'ER-2026-0200-GR';
      insertCase(env, REF);
      const docId = insertDocument(env, REF, 'Outcome Letter A');

      await env.approveDocument(REF, 'Outcome Letter A', SAMPLE_TEXT, EMPTY_NAMEMAP, docId, false);

      const row = env.getDb()._db
        .prepare("SELECT * FROM audit_events WHERE document_id = ? AND event_type = 'DOCUMENT_APPROVED'")
        .get(docId);

      assert.ok(row, 'DOCUMENT_APPROVED audit event must exist');
    } finally {
      cleanup(env);
    }
  });

  test('audit event has correct event_type, document_id, and actor', async () => {
    const env = makeEnv();
    try {
      const REF = 'ER-2026-0201-GR';
      insertCase(env, REF);
      const docId = insertDocument(env, REF, 'Outcome Letter A');

      await env.approveDocument(REF, 'Outcome Letter A', SAMPLE_TEXT, EMPTY_NAMEMAP, docId, false);

      const row = env.getDb()._db
        .prepare('SELECT * FROM audit_events WHERE document_id = ?')
        .get(docId);

      assert.ok(row, 'Audit event row must exist');
      assert.equal(row.event_type,     'DOCUMENT_APPROVED');
      assert.equal(row.document_id,    docId);
      assert.equal(row.case_reference, REF);
      assert.equal(row.actor,          'consultant');
    } finally {
      cleanup(env);
    }
  });

  test('audit event details contain document_type, format, and version', async () => {
    const env = makeEnv();
    try {
      const REF = 'ER-2026-0202-GR';
      insertCase(env, REF);
      const docId = insertDocument(env, REF, 'Investigation Report');

      await env.approveDocument(REF, 'Investigation Report', SAMPLE_TEXT, EMPTY_NAMEMAP, docId, false);

      const row = env.getDb()._db
        .prepare("SELECT details FROM audit_events WHERE document_id = ? AND event_type = 'DOCUMENT_APPROVED'")
        .get(docId);

      assert.ok(row, 'Audit event must exist');
      const details = JSON.parse(row.details);
      assert.equal(details.document_type, 'Investigation Report', 'details.document_type must be set');
      assert.equal(details.format,        'html,docx,pdf',        'details.format must list all three formats');
      assert.equal(details.version,       'FINAL',                'details.version must be FINAL');
    } finally {
      cleanup(env);
    }
  });

  test('audit event is hash-chained (has non-empty row_hash)', async () => {
    const env = makeEnv();
    try {
      const REF = 'ER-2026-0203-GR';
      insertCase(env, REF);
      const docId = insertDocument(env, REF, 'Outcome Letter B');

      await env.approveDocument(REF, 'Outcome Letter B', SAMPLE_TEXT, EMPTY_NAMEMAP, docId, false);

      const row = env.getDb()._db
        .prepare("SELECT row_hash FROM audit_events WHERE document_id = ?")
        .get(docId);

      assert.ok(row && row.row_hash && row.row_hash.length === 64,
        'Audit event must have a 64-char SHA-256 row_hash from the hash chain');
    } finally {
      cleanup(env);
    }
  });

  test('override=true writes VALIDATION_OVERRIDE instead of DOCUMENT_APPROVED', async () => {
    const env = makeEnv();
    try {
      const REF = 'ER-2026-0204-GR';
      insertCase(env, REF);
      const docId = insertDocument(env, REF, 'Investigation Report');

      await env.approveDocument(REF, 'Investigation Report', SAMPLE_TEXT, EMPTY_NAMEMAP, docId, true);

      const row = env.getDb()._db
        .prepare("SELECT event_type FROM audit_events WHERE document_id = ?")
        .get(docId);

      assert.ok(row, 'Audit event must exist for override');
      assert.equal(row.event_type, 'VALIDATION_OVERRIDE');
    } finally {
      cleanup(env);
    }
  });

  test('no audit event is written when documentId is null', async () => {
    const env = makeEnv();
    try {
      const REF = 'ER-2026-0205-GR';
      insertCase(env, REF);

      // Pass null documentId — the audit branch is skipped
      await env.approveDocument(REF, 'Investigation Report', SAMPLE_TEXT, EMPTY_NAMEMAP, null, false);

      const count = env.getDb()._db
        .prepare("SELECT COUNT(*) as n FROM audit_events WHERE event_type = 'DOCUMENT_APPROVED'")
        .get();

      assert.equal(count.n, 0, 'No audit event should be written when documentId is null');
    } finally {
      cleanup(env);
    }
  });
});

// ── Tests — recipient_category ────────────────────────────────────────────────

describe('approveDocument — recipient_category', () => {
  const CASES = [
    ['Outcome Letter A',    'Complainant'],
    ['Outcome Letter B',    'Respondent'],
    ['Invitation Letter',   'Participant'],
    ['Investigation Report','Internal'],
    ['Investigation Plan',  'Internal'],
    ['Interview Framework', 'Internal'],
  ];

  for (const [docType, expectedCategory] of CASES) {
    test(`${docType} → recipient_category = ${expectedCategory}`, async () => {
      const env = makeEnv();
      try {
        const REF = `ER-2026-0210-GR`;
        insertCase(env, REF);
        const docId = insertDocument(env, REF, docType);

        await env.approveDocument(REF, docType, SAMPLE_TEXT, EMPTY_NAMEMAP, docId, false);

        const row = env.getDb()._db
          .prepare('SELECT recipient_category FROM documents WHERE id = ?')
          .get(docId);

        assert.ok(row, 'documents row must exist after approve');
        assert.equal(row.recipient_category, expectedCategory,
          `${docType} should have recipient_category = ${expectedCategory}, got: ${row.recipient_category}`);
      } finally {
        cleanup(env);
      }
    });
  }

  test('recipient_category column exists on documents table (migration applied)', () => {
    const env = makeEnv();
    try {
      const cols = env.getDb()._db
        .prepare('PRAGMA table_info(documents)')
        .all()
        .map(c => c.name);
      assert.ok(cols.includes('recipient_category'),
        'documents table must have recipient_category column after migration');
    } finally {
      cleanup(env);
    }
  });
});
