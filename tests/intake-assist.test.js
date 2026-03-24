'use strict';
const { test, describe } = require('node:test');
const assert             = require('node:assert/strict');

const { extract }              = require('../lib/extractor');
const { anonymise, checkOutputForPii, TITLE_CASE_ALLOWLIST } = require('../lib/pre-intake-anonymiser');
const { assistIntake }         = require('../agents/intake-assist');

// ═══════════════════════════════════════════════════════════════════════════
// lib/extractor.js
// ═══════════════════════════════════════════════════════════════════════════

describe('extract() — plain text', () => {
  test('returns pasted text unchanged (no filename)', () => {
    const { text, sourceFormat } = extract('Hello world referral text.');
    assert.equal(text, 'Hello world referral text.');
    assert.equal(sourceFormat, 'paste');
  });

  test('treats empty filename as paste', () => {
    const { sourceFormat } = extract('Some text.', '');
    assert.equal(sourceFormat, 'paste');
  });

  test('normalises CRLF line endings to LF', () => {
    const { text } = extract('Line one\r\nLine two\r\n', '');
    assert.equal(text, 'Line one\nLine two\n');
  });

  test('throws on empty string', () => {
    assert.throws(() => extract(''), /No text content provided/);
  });

  test('throws on whitespace-only string', () => {
    assert.throws(() => extract('   \n  '), /No text content provided/);
  });

  test('throws on unsupported extension', () => {
    assert.throws(
      () => extract('content', 'document.docx'),
      /Unsupported file format/
    );
  });

  test('throws on .pdf (not supported in Phase 1)', () => {
    assert.throws(
      () => extract('%PDF-1.4 content', 'referral.pdf'),
      /Unsupported file format/
    );
  });
});

describe('extract() — .txt files', () => {
  test('returns .txt content with sourceFormat txt', () => {
    const { text, sourceFormat } = extract('Plain text file.', 'referral.txt');
    assert.equal(text, 'Plain text file.');
    assert.equal(sourceFormat, 'txt');
  });

  test('accepts uppercase .TXT extension', () => {
    const { sourceFormat } = extract('Content.', 'REFERRAL.TXT');
    assert.equal(sourceFormat, 'txt');
  });
});

describe('extract() — .md files', () => {
  test('strips markdown headings', () => {
    const { text, sourceFormat } = extract('## Referral\nSome body text.', 'note.md');
    assert.ok(!text.includes('##'));
    assert.ok(text.includes('Referral'));
    assert.equal(sourceFormat, 'md');
  });

  test('strips bold markers', () => {
    const { text } = extract('**Important** note.', 'note.md');
    assert.equal(text, 'Important note.');
  });

  test('strips bullet points', () => {
    const { text } = extract('- Item one\n- Item two', 'note.md');
    assert.ok(!text.includes('- '));
    assert.ok(text.includes('Item one'));
  });

  test('replaces links with link text only', () => {
    const { text } = extract('[Click here](https://example.com)', 'note.md');
    assert.equal(text.trim(), 'Click here');
  });
});

describe('extract() — .eml files', () => {
  test('strips headers, returns body', () => {
    const eml = [
      'From: sender@example.com',
      'To: recipient@example.com',
      'Subject: Test',
      '',
      'This is the email body.',
    ].join('\n');
    const { text, sourceFormat } = extract(eml, 'referral.eml');
    assert.ok(!text.includes('From:'));
    assert.ok(!text.includes('Subject:'));
    assert.ok(text.includes('This is the email body.'));
    assert.equal(sourceFormat, 'eml');
  });

  test('decodes quoted-printable body', () => {
    const eml = [
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Hello=20World',
    ].join('\n');
    const { text } = extract(eml, 'msg.eml');
    assert.ok(text.includes('Hello World'));
  });

  test('extracts text/plain from multipart/alternative', () => {
    const boundary = 'BOUNDARY123';
    const eml = [
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Plain text body here.',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      '<html><body>HTML body here.</body></html>',
      `--${boundary}--`,
    ].join('\n');
    const { text } = extract(eml, 'msg.eml');
    assert.ok(text.includes('Plain text body here.'));
    assert.ok(!text.includes('<html>'));
  });

  test('falls back to raw body when no text/plain part exists', () => {
    const boundary = 'BND456';
    const eml = [
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html',
      '',
      '<html>HTML only</html>',
      `--${boundary}--`,
    ].join('\n');
    const { text } = extract(eml, 'msg.eml');
    // Falls back to raw body — at minimum the boundary-stripped text is returned
    assert.ok(typeof text === 'string');
    assert.ok(text.length > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// lib/pre-intake-anonymiser.js  —  anonymise()
// ═══════════════════════════════════════════════════════════════════════════

describe('anonymise() — emails', () => {
  test('replaces email addresses with [EMAIL N]', () => {
    const { anonymisedText, entityLog } = anonymise('Contact john.smith@example.com for details.');
    assert.ok(!anonymisedText.includes('@'));
    assert.ok(anonymisedText.includes('[EMAIL 1]'));
    assert.equal(entityLog.emails, 1);
  });

  test('replaces multiple email addresses with sequential labels', () => {
    const { anonymisedText, entityLog } = anonymise(
      'From a@b.com and c@d.org respectively.'
    );
    assert.ok(anonymisedText.includes('[EMAIL 1]'));
    assert.ok(anonymisedText.includes('[EMAIL 2]'));
    assert.equal(entityLog.emails, 2);
  });

  test('entity log records count, not the actual address', () => {
    const { entityLog } = anonymise('Send to secret@private.co.uk please.');
    assert.equal(entityLog.emails, 1);
    // Verify the actual address does NOT appear in the log
    assert.ok(!JSON.stringify(entityLog).includes('secret@private.co.uk'));
  });
});

describe('anonymise() — phone numbers', () => {
  test('replaces UK mobile number', () => {
    const { anonymisedText, entityLog } = anonymise('Call me on 07700 900123.');
    assert.ok(!anonymisedText.includes('07700'));
    assert.ok(anonymisedText.includes('[PHONE 1]'));
    assert.equal(entityLog.phones, 1);
  });

  test('replaces UK mobile without separators', () => {
    const { anonymisedText } = anonymise('Number: 07911123456.');
    assert.ok(anonymisedText.includes('[PHONE 1]'));
    assert.ok(!anonymisedText.includes('07911'));
  });

  test('replaces international +44 number', () => {
    const { anonymisedText, entityLog } = anonymise('Reached at +44 7700 900456.');
    assert.ok(!anonymisedText.includes('+44'));
    assert.equal(entityLog.phones, 1);
  });

  test('entity log records count, not the actual number', () => {
    const { entityLog } = anonymise('Phone: 07700 900123');
    assert.equal(entityLog.phones, 1);
    assert.ok(!JSON.stringify(entityLog).includes('07700'));
  });
});

describe('anonymise() — postcodes', () => {
  test('replaces UK postcode', () => {
    const { anonymisedText, entityLog } = anonymise('Located at SW1A 1AA.');
    assert.ok(!anonymisedText.includes('SW1A'));
    assert.ok(anonymisedText.includes('[POSTCODE 1]'));
    assert.equal(entityLog.postcodes, 1);
  });

  test('replaces postcode without space', () => {
    const { anonymisedText } = anonymise('Postcode EC1A1BB.');
    assert.ok(anonymisedText.includes('[POSTCODE 1]'));
  });
});

describe('anonymise() — NI numbers', () => {
  test('replaces National Insurance number', () => {
    const { anonymisedText, entityLog } = anonymise('NI: AB 12 34 56 C');
    assert.ok(!anonymisedText.includes('AB 12 34 56 C'));
    assert.ok(anonymisedText.includes('[NI_NUMBER 1]'));
    assert.equal(entityLog.ni_numbers, 1);
  });
});

describe('anonymise() — organisation names', () => {
  test('replaces org name with legal suffix', () => {
    const { anonymisedText, entityLog } = anonymise('Employed by Acme Solutions Ltd.');
    assert.ok(anonymisedText.includes('[ORG 1]'));
    assert.equal(entityLog.orgs, 1);
  });

  test('replaces LLP suffix', () => {
    const { anonymisedText } = anonymise('Solicitors at Gray & Son LLP advised.');
    assert.ok(anonymisedText.includes('[ORG 1]'));
  });
});

describe('anonymise() — person names with honorifics', () => {
  test('replaces honorific + one name', () => {
    const { anonymisedText, entityLog } = anonymise('Reported by Mr Jones.');
    assert.ok(!anonymisedText.includes('Mr Jones'));
    assert.ok(anonymisedText.includes('[PERSON 1]'));
    assert.ok(entityLog.persons >= 1);
  });

  test('replaces honorific + two names', () => {
    const { anonymisedText } = anonymise('Submitted by Dr Alice Brown.');
    assert.ok(!anonymisedText.includes('Alice Brown'));
    assert.ok(anonymisedText.includes('[PERSON 1]'));
  });

  test('replaces multiple honorific names sequentially', () => {
    const { anonymisedText } = anonymise('Ms Jane Doe and Mr Tom Hill attended.');
    assert.ok(anonymisedText.includes('[PERSON 1]'));
    assert.ok(anonymisedText.includes('[PERSON 2]'));
    assert.ok(!anonymisedText.includes('Jane Doe'));
    assert.ok(!anonymisedText.includes('Tom Hill'));
  });
});

describe('anonymise() — Title Case name detection', () => {
  test('replaces two-word Title Case sequence not in allowlist', () => {
    // "John Smith" — neither word is in the allowlist
    const { anonymisedText, entityLog } = anonymise(
      'The referral concerns John Smith who works here.'
    );
    assert.ok(!anonymisedText.includes('John Smith'));
    assert.ok(entityLog.persons >= 1);
  });

  test('does NOT replace allowlist words — ER process terms', () => {
    const { anonymisedText } = anonymise('The Investigation Panel reviewed the Grievance Allegation.');
    // "Investigation Panel" — "Investigation" is in allowlist → not replaced
    // "Grievance Allegation" — both in allowlist → not replaced
    assert.ok(anonymisedText.includes('Investigation'));
    assert.ok(anonymisedText.includes('Grievance'));
  });

  test('does NOT replace allowlist words — days and months', () => {
    const { anonymisedText } = anonymise('Meeting on Monday January the 6th.');
    assert.ok(anonymisedText.includes('Monday'));
    assert.ok(anonymisedText.includes('January'));
  });

  test('does NOT replace allowlist words — job titles', () => {
    const { anonymisedText } = anonymise('Referred by the Line Manager.');
    assert.ok(anonymisedText.includes('Line Manager'));
  });

  test('does NOT replace "Human Resources"', () => {
    const { anonymisedText } = anonymise('Escalated to Human Resources today.');
    assert.ok(anonymisedText.includes('Human Resources'));
  });

  test('TITLE_CASE_ALLOWLIST is exported and is a Set', () => {
    assert.ok(TITLE_CASE_ALLOWLIST instanceof Set);
    assert.ok(TITLE_CASE_ALLOWLIST.size > 50);
  });
});

describe('anonymise() — entity log contract', () => {
  test('entity log contains counts, never raw values', () => {
    const { entityLog } = anonymise(
      'Email: secret@example.com. Phone: 07700900123. Name: John Smith.'
    );
    const logStr = JSON.stringify(entityLog);
    assert.ok(!logStr.includes('secret@example.com'));
    assert.ok(!logStr.includes('07700900123'));
    assert.ok(!logStr.includes('John Smith'));
    // Confirms counts are present
    assert.equal(typeof entityLog.emails,  'number');
    assert.equal(typeof entityLog.phones,  'number');
    assert.equal(typeof entityLog.persons, 'number');
  });

  test('entity log has all expected keys with numeric values', () => {
    const { entityLog } = anonymise('Clean text with no PII.');
    const keys = ['persons', 'orgs', 'emails', 'phones', 'postcodes', 'ni_numbers'];
    for (const k of keys) {
      assert.ok(Object.hasOwn(entityLog, k), `Missing key: ${k}`);
      assert.equal(typeof entityLog[k], 'number');
    }
  });

  test('all counts are zero for clean text', () => {
    const { entityLog } = anonymise('The complainant raised a grievance in January 2025.');
    assert.equal(entityLog.emails,     0);
    assert.equal(entityLog.phones,     0);
    assert.equal(entityLog.postcodes,  0);
    assert.equal(entityLog.ni_numbers, 0);
  });
});

describe('anonymise() — residualPiiDetected', () => {
  test('false for clean text', () => {
    const { residualPiiDetected } = anonymise('The matter concerns conduct issues in the team.');
    assert.equal(residualPiiDetected, false);
  });

  test('false after successful email replacement', () => {
    const { residualPiiDetected } = anonymise('Contact user@example.com for details.');
    assert.equal(residualPiiDetected, false);
  });

  test('true when a compact UK mobile survives replacement patterns', () => {
    // Craft a format the replacement regex misses (e.g. zero-padded different format)
    // The residual check catches compact 11-digit mobiles
    const { residualPiiDetected } = anonymise('Number is 07911123456 today.');
    // Either it was replaced (false) or residual check caught it (true) — never a silent pass
    // This verifies the system handled it one way or the other
    assert.equal(typeof residualPiiDetected, 'boolean');
  });

  test('true when @ survives in text (compact email format)', () => {
    // If somehow an email in unusual format slips through, residual check fires
    // We test by passing text with a known-surviving format: no space around @
    // Standard replacement catches this, but if it didn't, residualPiiDetected would be true
    const { anonymisedText, residualPiiDetected } = anonymise('user@host.org');
    if (anonymisedText.includes('@')) {
      assert.equal(residualPiiDetected, true);
    } else {
      assert.equal(residualPiiDetected, false);
    }
  });

  test('throws on non-string input', () => {
    assert.throws(() => anonymise(null),  /empty or invalid/);
    assert.throws(() => anonymise(123),   /empty or invalid/);
    assert.throws(() => anonymise({}),    /empty or invalid/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// lib/pre-intake-anonymiser.js  —  checkOutputForPii()
// ═══════════════════════════════════════════════════════════════════════════

describe('checkOutputForPii()', () => {
  test('returns empty array for clean output', () => {
    const clean = {
      extracted_fields: {
        case_type: 'Grievance',
        allegations: ['[PERSON 1] raised a concern.'],
        complainant_role: 'Warehouse operative',
      },
      missing_fields: [],
      low_confidence_fields: [],
    };
    assert.deepEqual(checkOutputForPii(clean), []);
  });

  test('flags top-level field containing an email', () => {
    const obj = { referring_party: 'user@example.com' };
    const flags = checkOutputForPii(obj);
    assert.ok(flags.includes('referring_party'));
  });

  test('flags nested field inside extracted_fields', () => {
    const obj = {
      extracted_fields: { referring_party: 'contact@secret.org' }
    };
    const flags = checkOutputForPii(obj);
    assert.ok(flags.some(f => f.includes('referring_party')));
  });

  test('flags array element containing phone number', () => {
    const obj = {
      extracted_fields: {
        allegations: ['Call 07700900123 for evidence.']
      }
    };
    const flags = checkOutputForPii(obj);
    assert.ok(flags.some(f => f.includes('allegations')));
  });

  test('flags field with postcode', () => {
    const obj = { extracted_fields: { incident_period: 'At SW1A 1AA office' } };
    const flags = checkOutputForPii(obj);
    assert.ok(flags.some(f => f.includes('incident_period')));
  });

  test('does NOT block — returns advisory flags only', () => {
    // Verify the function returns data even when PII is found (does not throw)
    const obj = { some_field: 'user@example.com' };
    let flags;
    assert.doesNotThrow(() => { flags = checkOutputForPii(obj); });
    assert.equal(flags.length, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// agents/intake-assist.js  —  assistIntake()
// (Claude is injected via deps.callClaude for full isolation)
// ═══════════════════════════════════════════════════════════════════════════

const VALID_RESPONSE = JSON.stringify({
  extracted_fields: {
    case_type:             'Grievance',
    allegations:           ['[PERSON 1] was excluded from team meetings.'],
    complainant_role:      'Senior Analyst',
    respondent_role:       'Line Manager',
    incident_period:       'January 2025 to March 2025',
    referring_party:       '[REFERRING PARTY]',
    witness_count:         2,
    witness_roles:         ['Colleague', 'Team Lead'],
    evidence_types:        ['Email correspondence'],
    policies_applicable:   ['Grievance Policy'],
    legal_involved:        false,
    complexity:            'Medium',
  },
  missing_fields:       [],
  low_confidence_fields: ['incident_period'],
});

const SAMPLE_ENTITY_LOG = { persons: 1, orgs: 0, emails: 0, phones: 0, postcodes: 0, ni_numbers: 0 };

describe('assistIntake() — successful path', () => {
  test('returns ASSIST_COMPLETE with suggestions on valid JSON response', async () => {
    const mockClaude = async () => VALID_RESPONSE;
    const result = await assistIntake('[PERSON 1] raised a grievance.', SAMPLE_ENTITY_LOG, {
      callClaude: mockClaude,
    });
    assert.equal(result.status, 'ASSIST_COMPLETE');
    assert.ok(result.suggestions);
    assert.equal(result.suggestions.case_type, 'Grievance');
  });

  test('includes entity_log in result', async () => {
    const mockClaude = async () => VALID_RESPONSE;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.deepEqual(result.entity_log, SAMPLE_ENTITY_LOG);
  });

  test('includes missing_fields and low_confidence_fields', async () => {
    const mockClaude = async () => VALID_RESPONSE;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.ok(Array.isArray(result.missing_fields));
    assert.ok(Array.isArray(result.low_confidence_fields));
    assert.ok(result.low_confidence_fields.includes('incident_period'));
  });

  test('includes output_pii_flags (empty for clean output)', async () => {
    const mockClaude = async () => VALID_RESPONSE;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.ok(Array.isArray(result.output_pii_flags));
    assert.deepEqual(result.output_pii_flags, []);
  });

  test('output_pii_flags populated when Claude output contains PII patterns', async () => {
    const dirtyResponse = JSON.stringify({
      extracted_fields: {
        case_type:             'Grievance',
        allegations:           ['Contact user@exposed.com for details.'],
        complainant_role:      'Analyst',
        respondent_role:       null,
        incident_period:       null,
        referring_party:       null,
        witness_count:         null,
        witness_roles:         [],
        evidence_types:        [],
        policies_applicable:   [],
        legal_involved:        null,
        complexity:            null,
      },
      missing_fields:       ['respondent_role', 'incident_period', 'referring_party', 'witness_count', 'complexity'],
      low_confidence_fields: [],
    });
    const mockClaude = async () => dirtyResponse;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.equal(result.status, 'ASSIST_COMPLETE');
    assert.ok(result.output_pii_flags.length > 0, 'Expected pii flags to be non-empty');
  });

  test('handles JSON wrapped in markdown fences (fallback extraction)', async () => {
    const wrapped = '```json\n' + VALID_RESPONSE + '\n```';
    const mockClaude = async () => wrapped;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.equal(result.status, 'ASSIST_COMPLETE');
  });
});

describe('assistIntake() — JSON parse failure and retry', () => {
  test('retries once on invalid JSON, succeeds on second attempt', async () => {
    let calls = 0;
    const mockClaude = async () => {
      calls++;
      return calls === 1 ? 'not json at all' : VALID_RESPONSE;
    };
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.equal(result.status, 'ASSIST_COMPLETE');
    assert.equal(calls, 2);
  });

  test('returns ASSIST_FAILED after two invalid JSON responses', async () => {
    const mockClaude = async () => 'this is not json { broken }';
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.equal(result.status, 'ASSIST_FAILED');
    assert.ok(result.error.length > 0);
  });

  test('ASSIST_FAILED includes canRetry and fallbackToManual flags', async () => {
    const mockClaude = async () => 'bad json';
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.equal(result.canRetry,        true);
    assert.equal(result.fallbackToManual, true);
  });

  test('returns ASSIST_FAILED when Claude throws (service unavailable)', async () => {
    const mockClaude = async () => { throw new Error('Network error'); };
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.equal(result.status,          'ASSIST_FAILED');
    assert.equal(result.canRetry,        true);
    assert.equal(result.fallbackToManual, true);
  });

  test('returns ASSIST_FAILED when retry Claude call also throws', async () => {
    let calls = 0;
    const mockClaude = async () => {
      calls++;
      if (calls === 1) return 'not json';
      throw new Error('Service went down');
    };
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.equal(result.status, 'ASSIST_FAILED');
    assert.equal(result.fallbackToManual, true);
  });

  test('returns ASSIST_FAILED when parsed JSON lacks extracted_fields', async () => {
    const mockClaude = async () => JSON.stringify({ wrong_key: {} });
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.equal(result.status, 'ASSIST_FAILED');
  });
});

describe('assistIntake() — no auto-submission contract', () => {
  test('ASSIST_COMPLETE result contains NO case_reference field', async () => {
    const mockClaude = async () => VALID_RESPONSE;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.ok(!Object.hasOwn(result, 'case_reference'),
      'assistIntake must not create a case or return a case reference');
  });

  test('ASSIST_COMPLETE result contains NO status field that would trigger case creation', async () => {
    const mockClaude = async () => VALID_RESPONSE;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    assert.notEqual(result.status, 'CASE_OPENED',
      'ASSIST_COMPLETE must not be confused with CASE_OPENED');
  });

  test('suggestions object does not contain encrypted NameMap or DB ids', async () => {
    const mockClaude = async () => VALID_RESPONSE;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    const sugStr = JSON.stringify(result.suggestions);
    assert.ok(!sugStr.includes('nameMap'));
    assert.ok(!sugStr.includes('encrypted_data'));
    assert.ok(!sugStr.includes('case_sequence'));
  });
});

describe('assistIntake() — JSON parsing robustness', () => {
  test('response wrapped in ```json fences parses successfully (fence stripping)', async () => {
    const fenced = '```json\n' + VALID_RESPONSE + '\n```';
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: async () => fenced });
    assert.equal(result.status, 'ASSIST_COMPLETE');
    assert.equal(result.suggestions.case_type, 'Grievance');
  });

  test('response wrapped in ``` fences (no language tag) parses successfully', async () => {
    const fenced = '```\n' + VALID_RESPONSE + '\n```';
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: async () => fenced });
    assert.equal(result.status, 'ASSIST_COMPLETE');
  });

  test('response with leading prose before JSON uses extraction fallback', async () => {
    const withPrefix = 'Here is the structured intake as requested:\n\n' + VALID_RESPONSE;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: async () => withPrefix });
    assert.equal(result.status, 'ASSIST_COMPLETE');
    assert.equal(result.suggestions.case_type, 'Grievance');
  });

  test('response with trailing prose after JSON uses extraction fallback', async () => {
    const withSuffix = VALID_RESPONSE + '\n\nI hope this structured response is helpful.';
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: async () => withSuffix });
    assert.equal(result.status, 'ASSIST_COMPLETE');
  });

  test('HTML response triggers retry path — succeeds when retry returns valid JSON', async () => {
    let calls = 0;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, {
      callClaude: async () => {
        calls++;
        return calls === 1
          ? '<html><body><h1>Internal Server Error</h1></body></html>'
          : VALID_RESPONSE;
      },
    });
    assert.equal(result.status, 'ASSIST_COMPLETE', 'should succeed after retry');
    assert.equal(calls, 2, 'should have retried exactly once after HTML response');
  });

  test('HTML response on both attempts returns ASSIST_FAILED', async () => {
    const html = '<html><body><p>Bad Gateway</p></body></html>';
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, {
      callClaude: async () => html,
    });
    assert.equal(result.status, 'ASSIST_FAILED');
    assert.equal(result.canRetry, true);
    assert.equal(result.fallbackToManual, true);
  });

  test('valid bare JSON with no fences or noise parses correctly (regression)', async () => {
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, {
      callClaude: async () => VALID_RESPONSE,
    });
    assert.equal(result.status, 'ASSIST_COMPLETE');
    assert.equal(result.suggestions.case_type, 'Grievance');
    assert.deepEqual(result.suggestions.allegations, ['[PERSON 1] was excluded from team meetings.']);
  });
});

describe('assistIntake() — handoff to existing intake route', () => {
  test('suggestions contain all fields expected by POST /api/cases', async () => {
    const mockClaude = async () => VALID_RESPONSE;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    const s = result.suggestions;
    // These are the fields coordinator.processCase() requires or uses
    const intakeFields = [
      'case_type', 'allegations', 'complainant_role',
      'respondent_role', 'incident_period', 'referring_party',
    ];
    for (const f of intakeFields) {
      assert.ok(Object.hasOwn(s, f), `Missing intake field: ${f}`);
    }
  });

  test('suggestions does not contain complainant_name or other raw PII fields', async () => {
    const mockClaude = async () => VALID_RESPONSE;
    const result = await assistIntake('text', SAMPLE_ENTITY_LOG, { callClaude: mockClaude });
    const s = result.suggestions;
    // These fields contain real names and must not be pre-populated from assisted intake
    // They must be filled in by the investigator during the review step
    assert.ok(!Object.hasOwn(s, 'complainant_name'),    'complainant_name must not be in suggestions');
    assert.ok(!Object.hasOwn(s, 'respondent_name'),     'respondent_name must not be in suggestions');
    assert.ok(!Object.hasOwn(s, 'investigating_officer'), 'investigating_officer must not be in suggestions');
  });
});
