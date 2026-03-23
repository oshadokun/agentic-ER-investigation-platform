'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

const TEST_DB = path.join(os.tmpdir(), `er_txn_test_${Date.now()}.db`);
process.env.DATABASE_PATH          = TEST_DB;
process.env.NAMEMAP_ENCRYPTION_KEY = 'b'.repeat(64);

const { getDb, closeDb } = require('../lib/db');
const { encrypt }        = require('../lib/encryption');
const { initialiseCase } = require('../agents/casemanagement');

let db;

before(() => { db = getDb(); });
after(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Transaction rollback', () => {
  test('rolled-back case insert leaves cases table unchanged', async () => {
    const REF = 'ER-2026-TXN1-GR';

    await assert.rejects(async () => {
      await db.transaction(async (dbTx) => {
        await dbTx.run(
          `INSERT INTO cases
             (case_reference, case_type, complexity, date_opened, target_date,
              phase, status, next_action, escalation_level, legal_involved,
              documents, timeline_status)
           VALUES (?, 'Grievance', 'Medium', '2026-03-23', '2026-05-04',
                   1, 'Open', 'Test', 'None', 0, '[]', 'On Track')`,
          [REF]
        );
        // Force rollback
        throw new Error('Simulated failure mid-transaction');
      });
    }, /Simulated failure/);

    const row = await db.get('SELECT 1 FROM cases WHERE case_reference = ?', [REF]);
    assert.equal(row, null, 'Case must not exist after rollback');
  });

  test('rolled-back sequence increment leaves sequence unchanged', async () => {
    const YEAR = 8888;

    await db.run(
      'INSERT INTO case_sequence (year, last_number) VALUES (?, 0) ON CONFLICT(year) DO NOTHING',
      [YEAR]
    );

    await assert.rejects(async () => {
      await db.transaction(async (dbTx) => {
        await dbTx.run(
          'UPDATE case_sequence SET last_number = last_number + 1 WHERE year = ?',
          [YEAR]
        );
        throw new Error('Rollback this increment');
      });
    }, /Rollback this increment/);

    const row = await db.get('SELECT last_number FROM case_sequence WHERE year = ?', [YEAR]);
    assert.equal(row.last_number, 0, 'Sequence must be unchanged after rollback');
  });

  test('rolled-back NameMap insert leaves name_maps table unchanged', async () => {
    // Create the parent case first (outside any transaction)
    const REF = 'ER-2026-TXN2-DI';
    await initialiseCase({
      case_reference:   REF,
      case_type:        'Disciplinary',
      complexity:       'Low',
      escalation_level: 'None',
      legal_involved:   false,
    }, db);

    const { encrypted_data, iv, auth_tag } = encrypt('{"[COMPLAINANT]":"Test Name"}');

    await assert.rejects(async () => {
      await db.transaction(async (dbTx) => {
        await dbTx.run(
          'INSERT INTO name_maps (case_reference, encrypted_data, iv, auth_tag) VALUES (?, ?, ?, ?)',
          [REF, encrypted_data, iv, auth_tag]
        );
        throw new Error('Rollback NameMap insert');
      });
    }, /Rollback NameMap insert/);

    const row = await db.get('SELECT 1 FROM name_maps WHERE case_reference = ?', [REF]);
    assert.equal(row, null, 'NameMap must not exist after rollback');
  });

  test('successful transaction commits all changes atomically', async () => {
    const YEAR = 7777;
    const REF  = 'ER-2026-TXN3-AC';

    const result = await db.transaction(async (dbTx) => {
      await dbTx.run(
        'INSERT INTO case_sequence (year, last_number) VALUES (?, 0) ON CONFLICT(year) DO NOTHING',
        [YEAR]
      );
      await dbTx.run(
        'UPDATE case_sequence SET last_number = last_number + 1 WHERE year = ?',
        [YEAR]
      );
      const seqRow = await dbTx.get('SELECT last_number FROM case_sequence WHERE year = ?', [YEAR]);

      await initialiseCase({
        case_reference:   REF,
        case_type:        'Absence & Capability',
        complexity:       'Low',
        escalation_level: 'None',
        legal_involved:   false,
      }, dbTx);

      return seqRow.last_number;
    });

    assert.equal(result, 1);

    const seqRow  = await db.get('SELECT last_number FROM case_sequence WHERE year = ?', [YEAR]);
    const caseRow = await db.get('SELECT case_reference FROM cases WHERE case_reference = ?', [REF]);
    assert.equal(seqRow.last_number, 1,   'Sequence should be committed');
    assert.equal(caseRow.case_reference, REF, 'Case should be committed');
  });
});

describe('Foreign key enforcement', () => {
  test('inserting a case_log entry for a non-existent case is rejected', async () => {
    await assert.rejects(async () => {
      await db.run(
        `INSERT INTO case_log
           (case_reference, entry_number, date, time, event_type, actor, details, status_after)
         VALUES ('ER-9999-FAKE-XX', 1, '2026-01-01', '00:00:00', 'Test', 'System', 'Test', 'Open')`,
        []
      );
    }, /FOREIGN KEY constraint failed/i);
  });

  test('inserting a name_map entry for a non-existent case is rejected', async () => {
    const { encrypted_data, iv, auth_tag } = encrypt('{}');
    await assert.rejects(async () => {
      await db.run(
        'INSERT INTO name_maps (case_reference, encrypted_data, iv, auth_tag) VALUES (?, ?, ?, ?)',
        ['ER-9999-FAKE-XX', encrypted_data, iv, auth_tag]
      );
    }, /FOREIGN KEY constraint failed/i);
  });
});
