'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

// Use a temp DB for every test run — never touches the real data file
const TEST_DB = path.join(os.tmpdir(), `er_test_${Date.now()}.db`);
process.env.DATABASE_PATH       = TEST_DB;
process.env.NAMEMAP_ENCRYPTION_KEY =
  'a'.repeat(64); // 64 hex chars = 32 bytes — valid test key

const { getDb, closeDb }         = require('../lib/db');
const { encrypt, decrypt }       = require('../lib/encryption');
const { initialiseCase }         = require('../agents/casemanagement');
const { logEntry, readLog }      = require('../lib/logger');

let db;

before(() => {
  db = getDb(); // creates tables
});

after(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

// ── Case sequence ─────────────────────────────────────────────────────────────

describe('case_sequence table', () => {
  test('starts empty', async () => {
    const row = await db.get('SELECT * FROM case_sequence WHERE year = 9999');
    assert.equal(row, null);
  });

  test('inserts and reads a sequence row', async () => {
    await db.run('INSERT INTO case_sequence (year, last_number) VALUES (9999, 0)');
    const row = await db.get('SELECT last_number FROM case_sequence WHERE year = 9999');
    assert.equal(row.last_number, 0);
  });

  test('increments atomically via UPDATE', async () => {
    await db.run('UPDATE case_sequence SET last_number = last_number + 1 WHERE year = 9999');
    const row = await db.get('SELECT last_number FROM case_sequence WHERE year = 9999');
    assert.equal(row.last_number, 1);
  });

  test('ON CONFLICT DO NOTHING is idempotent', async () => {
    await db.run(
      'INSERT INTO case_sequence (year, last_number) VALUES (9999, 0) ON CONFLICT(year) DO NOTHING'
    );
    const row = await db.get('SELECT last_number FROM case_sequence WHERE year = 9999');
    assert.equal(row.last_number, 1, 'existing row must not be overwritten');
  });
});

// ── Cases table ───────────────────────────────────────────────────────────────

describe('cases table via initialiseCase()', () => {
  const REF = 'ER-2026-TEST1-GR';

  test('inserts a case and returns a case object', async () => {
    const result = await initialiseCase({
      case_reference:   REF,
      case_type:        'Grievance',
      complexity:       'Medium',
      escalation_level: 'None',
      legal_involved:   false,
    }, db);

    assert.equal(result.case_reference, REF);
    assert.equal(result.status, 'Open');
    assert.equal(result.phase, 1);
    assert.equal(result.legal_involved, false);
    assert.ok(result.target_date, 'target_date should be set');
  });

  test('case can be retrieved from DB', async () => {
    const row = await db.get('SELECT * FROM cases WHERE case_reference = ?', [REF]);
    assert.ok(row, 'row should exist');
    assert.equal(row.case_type, 'Grievance');
    assert.equal(row.legal_involved, 0); // stored as INTEGER
  });

  test('inserting the same case_reference again throws (PRIMARY KEY constraint)', async () => {
    await assert.rejects(
      () => initialiseCase({
        case_reference:   REF,
        case_type:        'Grievance',
        complexity:       'Medium',
        escalation_level: 'None',
        legal_involved:   false,
      }, db),
      /UNIQUE constraint failed|already exists/i
    );
  });
});

// ── Case log ──────────────────────────────────────────────────────────────────

describe('case_log table via logEntry() / readLog()', () => {
  const REF = 'ER-2026-TEST2-GR';

  before(async () => {
    await initialiseCase({
      case_reference:   REF,
      case_type:        'Disciplinary',
      complexity:       'Low',
      escalation_level: 'None',
      legal_involved:   false,
    }, db);
  });

  test('logEntry() writes an entry and returns entry_number 1', async () => {
    const entry = await logEntry(REF, {
      event_type:   'Case opened',
      by:           'Intake Agent',
      details:      'Test log entry',
      status_after: 'Open',
    });
    assert.equal(entry.entry_number, 1);
    assert.equal(entry.event_type, 'Case opened');
  });

  test('second logEntry() returns entry_number 2', async () => {
    const entry = await logEntry(REF, {
      event_type:   'Document generated',
      by:           'Intake Agent',
      details:      'Letters generated',
      status_after: 'In Progress',
    });
    assert.equal(entry.entry_number, 2);
  });

  test('readLog() returns entries in order', async () => {
    const log = await readLog(REF);
    assert.equal(log.length, 2);
    assert.equal(log[0].entry_number, 1);
    assert.equal(log[1].entry_number, 2);
    assert.equal(log[0].by, 'Intake Agent');
  });

  test('readLog() returns empty array for unknown case reference', async () => {
    const log = await readLog('ER-9999-XXXX-XX');
    assert.deepEqual(log, []);
  });
});

// ── NameMap encryption ────────────────────────────────────────────────────────

describe('name_maps table — encryption at rest', () => {
  const REF     = 'ER-2026-TEST3-BH';
  const nameMap = {
    '[COMPLAINANT]':     'Alice Brown',
    '[RESPONDENT]':      'Bob Carter',
    '[REFERRING PARTY]': 'HR Director',
  };

  before(async () => {
    await initialiseCase({
      case_reference:   REF,
      case_type:        'Bullying & Harassment',
      complexity:       'High',
      escalation_level: 'Advisory',
      legal_involved:   false,
    }, db);
  });

  test('encrypted NameMap round-trips correctly', () => {
    const plaintext  = JSON.stringify(nameMap);
    const ciphertext = encrypt(plaintext);
    const recovered  = JSON.parse(decrypt(ciphertext));
    assert.deepEqual(recovered, nameMap);
  });

  test('stored ciphertext is not plaintext JSON', async () => {
    const { encrypted_data, iv, auth_tag } = encrypt(JSON.stringify(nameMap));
    await db.run(
      'INSERT INTO name_maps (case_reference, encrypted_data, iv, auth_tag) VALUES (?, ?, ?, ?)',
      [REF, encrypted_data, iv, auth_tag]
    );
    const row = await db.get(
      'SELECT encrypted_data FROM name_maps WHERE case_reference = ?',
      [REF]
    );
    // The stored value must not contain any real names in plaintext
    assert.ok(!row.encrypted_data.includes('Alice Brown'), 'real name must not appear in stored ciphertext');
    assert.ok(!row.encrypted_data.includes('Bob Carter'),  'real name must not appear in stored ciphertext');
  });

  test('NameMap can be decrypted from stored row', async () => {
    const row = await db.get(
      'SELECT encrypted_data, iv, auth_tag FROM name_maps WHERE case_reference = ?',
      [REF]
    );
    const recovered = JSON.parse(decrypt(row));
    assert.equal(recovered['[COMPLAINANT]'],     'Alice Brown');
    assert.equal(recovered['[RESPONDENT]'],      'Bob Carter');
    assert.equal(recovered['[REFERRING PARTY]'], 'HR Director');
  });

  test('tampered ciphertext fails decryption (auth tag check)', () => {
    const { encrypted_data, iv, auth_tag } = encrypt('{"test":"value"}');
    const tampered = encrypted_data.slice(0, -2) + '00'; // flip last byte
    assert.throws(
      () => decrypt({ encrypted_data: tampered, iv, auth_tag }),
      /unsupported|auth|decipher/i
    );
  });
});

// ── Quality reviews ───────────────────────────────────────────────────────────

describe('quality_reviews table', () => {
  const REF = 'ER-2026-TEST4-WB';

  before(async () => {
    await initialiseCase({
      case_reference:   REF,
      case_type:        'Whistleblowing',
      complexity:       'Very High',
      escalation_level: 'Mandatory',
      legal_involved:   true,
    }, db);
  });

  test('inserts a quality review record', async () => {
    await db.run(
      `INSERT INTO quality_reviews
         (case_reference, document_type, case_type, complexity, overall_score, result, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [REF, 'Investigation Report', 'Whistleblowing', 'Very High', 87, 'PASS', '2026-03-23']
    );
    const row = await db.get(
      'SELECT * FROM quality_reviews WHERE case_reference = ?',
      [REF]
    );
    assert.equal(row.overall_score, 87);
    assert.equal(row.result, 'PASS');
  });

  test('multiple quality reviews for the same case are allowed', async () => {
    await db.run(
      `INSERT INTO quality_reviews
         (case_reference, document_type, case_type, complexity, overall_score, result, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [REF, 'Outcome Letter A', 'Whistleblowing', 'Very High', 72, 'PASS WITH MANDATORY CORRECTIONS', '2026-03-23']
    );
    const rows = await db.all(
      'SELECT * FROM quality_reviews WHERE case_reference = ? ORDER BY id',
      [REF]
    );
    assert.equal(rows.length, 2);
  });
});
