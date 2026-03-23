#!/usr/bin/env node
/**
 * scripts/seed-policy-templates.js
 *
 * Seeds example policy templates into the database.
 * Idempotent: skips templates that already exist (same name + version).
 *
 * Usage:
 *   node scripts/seed-policy-templates.js
 */
'use strict';
require('dotenv').config();

const { validateKey }    = require('../lib/encryption');
const { getDb, closeDb } = require('../lib/db');

try {
  validateKey();
} catch (err) {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
}

const TEMPLATES = [
  {
    name:           'Grievance Procedure',
    version:        '1.0',
    document_types: ['Investigation Report', 'Outcome Letter A', 'Outcome Letter B', 'Investigation Plan'],
    content: `GRIEVANCE PROCEDURE STANDARDS

1. The investigator must remain impartial throughout and have had no prior involvement in the grievance.
2. Both the complainant and respondent must be given a fair opportunity to present their case.
3. The investigation must be completed within 28 days of the formal grievance being raised, unless an extension is agreed.
4. All parties must be informed of the outcome in writing.
5. The right of appeal must be communicated to the complainant in the outcome letter.
6. All investigation documents are confidential and must not be shared with third parties without authorisation.`,
    active: 1,
  },
  {
    name:           'Disciplinary Procedure',
    version:        '1.0',
    document_types: ['Investigation Report', 'Outcome Letter A', 'Outcome Letter B', 'Invitation Letter'],
    content: `DISCIPLINARY PROCEDURE STANDARDS

1. The investigator must establish whether there is a case to answer before disciplinary action is taken.
2. The employee must receive written notice of the allegations at least 48 hours before any investigatory meeting.
3. The employee has the right to be accompanied by a trade union representative or workplace colleague.
4. Allegations must be assessed against the balance of probabilities.
5. Any sanction must be proportionate to the misconduct and consistent with previous cases.
6. The employee has the right to appeal any disciplinary outcome.`,
    active: 1,
  },
  {
    name:           'Bullying and Harassment Policy',
    version:        '1.0',
    document_types: ['Investigation Report', 'Outcome Letter A', 'Outcome Letter B'],
    content: `BULLYING AND HARASSMENT POLICY STANDARDS

1. Bullying is defined as persistent, unwanted behaviour that undermines, humiliates, denigrates, or injures the recipient.
2. Harassment is unwanted conduct related to a protected characteristic that has the purpose or effect of violating dignity or creating a hostile environment.
3. The investigation must assess the impact on the complainant, not only the intent of the respondent.
4. Protected characteristics under the Equality Act 2010 must be considered where relevant.
5. Interim protective measures should be considered where the complainant and respondent work in proximity.
6. Both parties must be treated with dignity and respect throughout the process.`,
    active: 1,
  },
];

async function run() {
  console.log('\n=== ER Investigation Platform — Policy Template Seeding ===\n');

  const db = getDb();
  let inserted = 0;
  let skipped  = 0;

  for (const t of TEMPLATES) {
    const existing = await db.get(
      'SELECT id FROM policy_templates WHERE name = ? AND version = ?',
      [t.name, t.version]
    );

    if (existing) {
      console.log(`  SKIP  ${t.name} v${t.version} (already exists as id=${existing.id})`);
      skipped++;
      continue;
    }

    const result = await db.run(
      `INSERT INTO policy_templates (name, version, document_types, content, active)
       VALUES (?, ?, ?, ?, ?)`,
      [t.name, t.version, JSON.stringify(t.document_types), t.content, t.active]
    );
    console.log(`  OK    ${t.name} v${t.version} → id=${result.lastInsertRowid}`);
    inserted++;
  }

  closeDb();
  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped.\n`);
}

run().catch(err => {
  console.error('\nUnhandled error:', err.message);
  closeDb();
  process.exit(1);
});
