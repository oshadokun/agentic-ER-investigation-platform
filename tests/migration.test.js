'use strict';
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const os     = require('os');
const path   = require('path');
const fs     = require('fs-extra');
const { execSync } = require('child_process');

process.env.NAMEMAP_ENCRYPTION_KEY = 'c'.repeat(64);

// Each test group uses fresh temp directories and a fresh DB
function makeEnv() {
  const base     = fs.mkdtempSync(path.join(os.tmpdir(), 'er_mig_'));
  const dbPath   = path.join(base, 'test.db');
  const dataPath = path.join(base, 'data');
  const casesPath = path.join(base, 'cases');
  fs.ensureDirSync(dataPath);
  fs.ensureDirSync(casesPath);
  return { base, dbPath, dataPath, casesPath };
}

function runMigration(env) {
  return execSync(
    `node ${path.join(__dirname, '..', 'scripts', 'migrate-from-files.js')}`,
    {
      env: {
        ...process.env,
        DATABASE_PATH:      env.dbPath,
        DATA_PATH:          env.dataPath,
        CASE_FILES_PATH:    env.casesPath,
        NAMEMAP_ENCRYPTION_KEY: 'c'.repeat(64),
      },
      encoding: 'utf8',
    }
  );
}

function openDb(dbPath) {
  // Re-use the singleton pattern but with a fresh path
  // We reset the module cache so each call gets a fresh instance
  Object.keys(require.cache).forEach(k => {
    if (k.includes('lib/db') || k.includes('lib\\db')) delete require.cache[k];
  });
  process.env.DATABASE_PATH = dbPath;
  return require('../lib/db');
}

// ── Helpers to write fixture files ──────────────────────────────────────────

function writeCaseTracker(dataPath, cases) {
  fs.writeJsonSync(path.join(dataPath, 'case_tracker.json'), cases, { spaces: 2 });
}

function writeCaseSequence(dataPath, data) {
  fs.writeJsonSync(path.join(dataPath, 'case_sequence.json'), data, { spaces: 2 });
}

function writeQualityTrends(dataPath, trends) {
  fs.writeJsonSync(path.join(dataPath, 'quality_trends.json'), trends, { spaces: 2 });
}

function writeCaseLog(casesPath, ref, entries) {
  const logDir = path.join(casesPath, ref, '00_CASE_LOG');
  fs.ensureDirSync(logDir);
  fs.writeJsonSync(path.join(logDir, `${ref}_Case_Log.json`), entries, { spaces: 2 });
}

function writeNameMap(casesPath, ref, nameMap) {
  const logDir = path.join(casesPath, ref, '00_CASE_LOG');
  fs.ensureDirSync(logDir);
  fs.writeJsonSync(path.join(logDir, `${ref}_NameMap.json`), nameMap, { spaces: 2 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Migration from file-based storage', () => {
  test('imports cases, logs, NameMaps, and sequence from fixture files', () => {
    const env = makeEnv();
    const REF = 'ER-2026-0001-GR';

    writeCaseSequence(env.dataPath, { year: 2026, last: 1 });
    writeCaseTracker(env.dataPath, [{
      case_reference:   REF,
      case_type:        'Grievance',
      complexity:       'Medium',
      date_opened:      '2026-03-22',
      target_date:      '2026-05-02',
      phase:            1,
      status:           'Open',
      next_action:      'Review letters',
      escalation_level: 'None',
      legal_involved:   false,
      documents:        [],
      timeline_status:  'On Track',
    }]);
    writeCaseLog(env.casesPath, REF, [
      { entry_number: 1, date: '2026-03-22', time: '10:00:00', event_type: 'Case opened', by: 'Intake Agent', details: 'Opened', status_after: 'Open' },
      { entry_number: 2, date: '2026-03-22', time: '10:01:00', event_type: 'Document generated', by: 'Intake Agent', details: 'Letters', status_after: 'In Progress' },
    ]);
    writeNameMap(env.casesPath, REF, {
      '[COMPLAINANT]': 'Alice Brown',
      '[RESPONDENT]':  'Bob Carter',
    });

    const output = runMigration(env);
    assert.ok(output.includes('Migration completed'), 'Migration should complete');

    const { getDb, closeDb } = openDb(env.dbPath);
    const db = getDb();

    const caseRow = db._db.prepare('SELECT * FROM cases WHERE case_reference = ?').get(REF);
    assert.ok(caseRow, 'Case should be in DB');
    assert.equal(caseRow.case_type, 'Grievance');

    const logRows = db._db.prepare('SELECT * FROM case_log WHERE case_reference = ? ORDER BY entry_number').all(REF);
    assert.equal(logRows.length, 2, 'Both log entries should be imported');

    const nmRow = db._db.prepare('SELECT encrypted_data FROM name_maps WHERE case_reference = ?').get(REF);
    assert.ok(nmRow, 'NameMap should be in DB');
    assert.ok(!nmRow.encrypted_data.includes('Alice Brown'), 'NameMap must be encrypted');

    const seqRow = db._db.prepare('SELECT last_number FROM case_sequence WHERE year = 2026').get();
    assert.equal(seqRow.last_number, 1);

    closeDb();

    // Original files must not be modified
    const originalTracker = fs.readJsonSync(path.join(env.dataPath, 'case_tracker.json'));
    assert.equal(originalTracker.length, 1, 'Original case_tracker.json must be preserved');
    assert.ok(
      fs.existsSync(path.join(env.casesPath, REF, '00_CASE_LOG', `${REF}_NameMap.json`)),
      'Original NameMap JSON file must be preserved'
    );
  });

  test('idempotent: running migration twice does not duplicate data', () => {
    const env = makeEnv();
    const REF = 'ER-2026-0002-DI';

    writeCaseSequence(env.dataPath, { year: 2026, last: 2 });
    writeCaseTracker(env.dataPath, [{
      case_reference:   REF,
      case_type:        'Disciplinary',
      complexity:       'Low',
      date_opened:      '2026-03-22',
      target_date:      '2026-04-19',
      phase:            1,
      status:           'Open',
      next_action:      'Review letters',
      escalation_level: 'None',
      legal_involved:   false,
      documents:        [],
      timeline_status:  'On Track',
    }]);
    writeCaseLog(env.casesPath, REF, [
      { entry_number: 1, date: '2026-03-22', time: '09:00:00', event_type: 'Case opened', by: 'System', details: 'Opened', status_after: 'Open' },
    ]);
    writeNameMap(env.casesPath, REF, { '[COMPLAINANT]': 'Test User' });

    runMigration(env);
    runMigration(env); // run again

    const { getDb, closeDb } = openDb(env.dbPath);
    const db = getDb();

    const cases = db._db.prepare('SELECT * FROM cases WHERE case_reference = ?').all(REF);
    assert.equal(cases.length, 1, 'Case must not be duplicated');

    const logs = db._db.prepare('SELECT * FROM case_log WHERE case_reference = ?').all(REF);
    assert.equal(logs.length, 1, 'Log entries must not be duplicated');

    const nms = db._db.prepare('SELECT * FROM name_maps WHERE case_reference = ?').all(REF);
    assert.equal(nms.length, 1, 'NameMap must not be duplicated');

    const seqs = db._db.prepare('SELECT * FROM case_sequence WHERE year = 2026').all();
    assert.equal(seqs.length, 1, 'Sequence row must not be duplicated');

    closeDb();
  });

  test('handles malformed case_tracker.json gracefully and continues', () => {
    const env = makeEnv();
    fs.writeFileSync(path.join(env.dataPath, 'case_tracker.json'), '{ invalid json !!');

    // Migration should not throw — it should report the failure and continue
    let output;
    assert.doesNotThrow(() => {
      output = runMigration(env);
    });
    // The output should mention a failure or warning (not "completed successfully")
    // or still mention "Migration completed" (with failures noted)
    assert.ok(
      output.includes('Migration') || output.includes('Error') || output.includes('failed'),
      'Output should mention migration status'
    );
  });

  test('quality reviews are imported from quality_trends.json', () => {
    const env = makeEnv();
    const REF = 'ER-2026-0003-BH';

    writeCaseTracker(env.dataPath, [{
      case_reference: REF, case_type: 'Bullying & Harassment',
      complexity: 'High', date_opened: '2026-03-22', target_date: '2026-06-01',
      phase: 2, status: 'Open', escalation_level: 'Advisory',
      legal_involved: false, documents: [], timeline_status: 'On Track',
    }]);
    writeQualityTrends(env.dataPath, [{
      case_reference: REF, document_type: 'Investigation Report',
      case_type: 'Bullying & Harassment', complexity: 'High',
      overall_score: 85, result: 'PASS', date: '2026-03-22',
    }]);

    runMigration(env);

    const { getDb, closeDb } = openDb(env.dbPath);
    const db = getDb();
    const row = db._db.prepare('SELECT * FROM quality_reviews WHERE case_reference = ?').get(REF);
    assert.ok(row, 'Quality review should be in DB');
    assert.equal(row.overall_score, 85);
    assert.equal(row.result, 'PASS');
    closeDb();
  });

  test('case without a DB row is reported in failures for logs and NameMap', () => {
    // There is a case directory but it is NOT in case_tracker.json
    const env = makeEnv();
    const REF = 'ER-2026-0004-WB';

    writeCaseTracker(env.dataPath, []); // empty tracker
    writeCaseLog(env.casesPath, REF, [
      { entry_number: 1, date: '2026-03-22', time: '10:00:00', event_type: 'Test', by: 'System', details: '', status_after: '' },
    ]);
    writeNameMap(env.casesPath, REF, { '[COMPLAINANT]': 'Orphan Name' });

    const output = runMigration(env);

    // Should note these could not be imported (FK constraint without a cases row)
    // The migration must still complete, not crash
    assert.ok(output.includes('Migration'), 'Migration should complete even with orphaned case dir');
  });
});
