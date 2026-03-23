'use strict';
const { test, describe } = require('node:test');
const assert             = require('node:assert/strict');
const { anonymise, anonymiseAllegations } = require('../lib/anonymiser');

describe('anonymise()', () => {
  const base = {
    case_type:           'Grievance',
    allegations:         ['Allegation one', 'Allegation two'],
    complainant_name:    'Alice Brown',
    respondent_name:     'Bob Carter',
    investigating_officer: '',
    deciding_manager:    '',
    hrbp_name:           'Carol Dean',
    organisation_name:   'Acme Ltd',
    referring_party:     'HR Director',
    complainant_role:    'Senior Analyst',
    respondent_role:     'Team Lead',
    incident_period:     'January 2026',
    complexity:          'Medium',
    escalation_required: false,
    legal_involved:      false,
    witnesses: [{ name: 'Eve Foster', role: 'Colleague' }],
  };

  test('returns nameMap and anonymised object', () => {
    const { nameMap, anonymised } = anonymise({ ...base });
    assert.ok(nameMap, 'nameMap returned');
    assert.ok(anonymised, 'anonymised returned');
  });

  test('nameMap contains all real names including referring_party', () => {
    const { nameMap } = anonymise({ ...base });
    assert.equal(nameMap['[COMPLAINANT]'],    'Alice Brown');
    assert.equal(nameMap['[RESPONDENT]'],     'Bob Carter');
    assert.equal(nameMap['[HRBP]'],           'Carol Dean');
    assert.equal(nameMap['[ORGANISATION]'],   'Acme Ltd');
    assert.equal(nameMap['[REFERRING PARTY]'], 'HR Director');
    assert.equal(nameMap['[WITNESS A]'],      'Eve Foster');
  });

  test('referring_party in anonymised output is the placeholder, not the real value', () => {
    const { anonymised } = anonymise({ ...base });
    assert.equal(anonymised.referring_party, '[REFERRING PARTY]',
      'referring_party must use placeholder to prevent PII leaking to the API');
    assert.ok(!JSON.stringify(anonymised).includes('HR Director'),
      'real referring_party value must not appear in anonymised data');
  });

  test('real complainant name does not appear in anonymised output', () => {
    const { anonymised } = anonymise({ ...base });
    assert.ok(!JSON.stringify(anonymised).includes('Alice Brown'));
  });

  test('real respondent name does not appear in anonymised output', () => {
    const { anonymised } = anonymise({ ...base });
    assert.ok(!JSON.stringify(anonymised).includes('Bob Carter'));
  });

  test('real witness name does not appear in anonymised output', () => {
    const { anonymised } = anonymise({ ...base });
    // witness_roles only contains roles, not names
    assert.deepEqual(anonymised.witness_roles, ['Colleague']);
    assert.ok(!JSON.stringify(anonymised).includes('Eve Foster'));
  });

  test('PII_DETECTED thrown if a real name leaks into a field sent to the API', () => {
    // Inject complainant name into a free-text field that ends up in anonymised
    // (this simulates a hypothetical bug where a name slips into allegations before anonymisation)
    const bad = {
      ...base,
      // allegations field is copied as-is into anonymised before anonymiseAllegations() is called
      // so if a name appears there, PII check must catch it
      allegations: ['Alice Brown did something'],
    };
    // anonymise() itself just copies allegations — the PII check checks the entire anonymised JSON
    assert.throws(() => anonymise(bad), /PII_DETECTED/);
  });

  test('anonymised object contains expected safe fields', () => {
    const { anonymised } = anonymise({ ...base });
    assert.equal(anonymised.case_type,     'Grievance');
    assert.equal(anonymised.complainant_role, 'Senior Analyst');
    assert.equal(anonymised.respondent_role,  'Team Lead');
    assert.equal(anonymised.complexity,     'Medium');
    assert.equal(anonymised.witness_count,  1);
    assert.equal(anonymised.allegation_count, 2);
  });

  test('multiple witnesses are mapped to sequential labels', () => {
    const input = {
      ...base,
      witnesses: [
        { name: 'Eve Foster', role: 'Colleague' },
        { name: 'Fred Grant', role: 'Manager' },
      ],
    };
    const { nameMap, anonymised } = anonymise(input);
    assert.equal(nameMap['[WITNESS A]'], 'Eve Foster');
    assert.equal(nameMap['[WITNESS B]'], 'Fred Grant');
    assert.equal(anonymised.witness_count, 2);
    assert.deepEqual(anonymised.witness_roles, ['Colleague', 'Manager']);
  });
});

describe('anonymiseAllegations()', () => {
  test('replaces known names with placeholders', () => {
    const nameMap = {
      '[COMPLAINANT]': 'Alice Brown',
      '[RESPONDENT]':  'Bob Carter',
      '[WITNESS A]':   'Eve Foster',
    };
    const allegations = ['Alice Brown complained that Bob Carter acted badly, witnessed by Eve Foster.'];
    const result = anonymiseAllegations(allegations, nameMap);
    assert.equal(result[0],
      '[COMPLAINANT] complained that [RESPONDENT] acted badly, witnessed by [WITNESS A].'
    );
  });

  test('is case-insensitive', () => {
    const nameMap = { '[COMPLAINANT]': 'alice brown' };
    const result = anonymiseAllegations(['ALICE BROWN raised a complaint.'], nameMap);
    assert.equal(result[0], '[COMPLAINANT] raised a complaint.');
  });

  test('leaves safe text untouched when nameMap is empty', () => {
    const result = anonymiseAllegations(['Generic allegation text.'], {});
    assert.equal(result[0], 'Generic allegation text.');
  });

  test('ignores nameMap entries with short or empty values', () => {
    const nameMap = { '[EMPTY]': '', '[SHORT]': 'AB' };
    const result = anonymiseAllegations(['AB did something.'], nameMap);
    assert.equal(result[0], 'AB did something.'); // 'AB' is ≤ 2 chars — not replaced
  });
});
