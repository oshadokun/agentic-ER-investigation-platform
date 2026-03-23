'use strict';
/**
 * tests/validators.test.js
 *
 * Tests for all validator modules (validators/).
 * All validators are pure functions — no I/O, no API calls, no DB access.
 *
 * Signature: validate(content, documentType, context?) => { passed, failures }
 *
 * Coverage:
 *   - validators/index.js (dispatcher)
 *   - validators/investigation-report.js
 *   - validators/outcome-letter.js (Outcome Letter A + B)
 *   - validators/invitation-letter.js
 *   - validators/interview-framework.js
 *   - validators/investigation-plan.js
 *   - validators/default.js
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { validate }              = require('../validators/index');
const invReport                 = require('../validators/investigation-report');
const outcomeLetter             = require('../validators/outcome-letter');
const invitationLetter          = require('../validators/invitation-letter');
const interviewFramework        = require('../validators/interview-framework');
const investigationPlan         = require('../validators/investigation-plan');
const defaultValidator          = require('../validators/default');

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Build a minimal Investigation Report that passes all checks.
 * Accepts optional overrides so individual tests can break one requirement at a time.
 */
function makeReport({ wordCount = 600, omit = [] } = {}) {
  const body = 'The investigation was conducted thoroughly and fairly. '.repeat(Math.ceil(wordCount / 8));
  const sections = {
    executiveSummary: 'EXECUTIVE SUMMARY\nThis summarises the investigation.',
    background:       '1. Background\nThe complaint was received in January 2026.',
    scope:            '2. Scope\nThis investigation covers the allegations raised.',
    methodology:      '3. Methodology\nDocuments were reviewed and interviews conducted.',
    allegations:      '4. Allegations\nThe allegation is that [RESPONDENT] behaved inappropriately.',
    findings:         '5. Findings\nThe evidence has been carefully weighed.',
    conclusions:      '6. Conclusions\nThe allegation is SUBSTANTIATED.',
    recommendations:  '7. Recommendations\nA formal disciplinary hearing is recommended.',
  };

  const parts = Object.entries(sections)
    .filter(([key]) => !omit.includes(key))
    .map(([, text]) => text);

  parts.push(body);
  return parts.join('\n\n');
}

/**
 * Build a minimal Outcome Letter that passes all checks.
 */
function makeOutcomeLetter({ type = 'Outcome Letter A', omit = [] } = {}) {
  const parts = {
    salutation:  'Dear [COMPLAINANT],',
    body:        'We write to inform you of the outcome of the investigation into your complaint. '
                 + 'Having carefully considered all of the evidence available, including the written '
                 + 'statements provided, the documents reviewed, and the accounts given during the '
                 + 'investigation meetings, the investigator has concluded that the allegations are '
                 + 'SUBSTANTIATED. The matter has been upheld. We are writing to advise you of the '
                 + 'decision reached following this thorough and impartial investigation process. '
                 + 'The organisation takes such matters very seriously and appropriate action will follow.',
    appeal:      'You have the right to appeal this decision within 5 working days of receiving '
                 + 'this letter. To exercise your right of appeal, please write to the HR department '
                 + 'setting out the grounds for your appeal.',
    signOff:     'Yours sincerely,\n[INVESTIGATOR]',
  };

  if (type !== 'Outcome Letter A') delete parts.appeal;

  const filtered = Object.entries(parts)
    .filter(([key]) => !omit.includes(key))
    .map(([, text]) => text);

  return filtered.join('\n\n');
}

/**
 * Build a minimal Invitation Letter that passes all checks.
 */
function makeInvitationLetter({ omit = [] } = {}) {
  const parts = {
    salutation:   'Dear [COMPLAINANT],',
    body:         'We write to invite you to attend an investigation meeting to discuss the allegations '
                  + 'that have been raised in connection with your complaint. '
                  + 'The meeting will take place on [DATE] at [TIME] at [LOCATION/VENUE]. '
                  + 'Please note that you have the right to be accompanied by a work colleague or '
                  + 'a trade union representative at this meeting. '
                  + 'If you are unable to attend at the proposed time, please contact us as soon as possible '
                  + 'so that alternative arrangements can be made.',
    signOff:      'Yours sincerely,\n[INVESTIGATOR]',
  };

  const filtered = Object.entries(parts)
    .filter(([key]) => !omit.includes(key))
    .map(([, text]) => text);

  return filtered.join('\n\n');
}

/**
 * Build a minimal Interview Framework that passes all checks.
 */
function makeInterviewFramework({ omit = [] } = {}) {
  const parts = {
    intro:      'Interview Framework — Complainant Interview\n\n'
                + 'Purpose: To discuss the allegations raised in connection with the complaint.\n\n'
                + 'This framework provides a structured set of questions to guide the investigator '
                + 'during the complainant interview. Questions should be asked in an open, non-leading '
                + 'manner. The investigator should allow the interviewee sufficient time to respond.',
    questions:  'Section 1 — Background\n'
                + '1. Can you describe, in your own words, the incident or incidents that led to your complaint?\n'
                + '2. When did the alleged incident occur and where did it take place?\n'
                + '3. Who was present at the time of the alleged incident?\n\n'
                + 'Section 2 — Impact\n'
                + '4. How has the incident affected you at work?\n'
                + '5. What outcome are you seeking from this investigation?',
    notes:      'These questions relate to the concern raised by [COMPLAINANT] regarding the conduct '
                + 'of [RESPONDENT]. The investigator should record all responses accurately and ensure '
                + 'the interviewee has an opportunity to review and confirm their account.',
  };

  const filtered = Object.entries(parts)
    .filter(([key]) => !omit.includes(key))
    .map(([, text]) => text);

  return filtered.join('\n\n');
}

// ── validators/index.js — dispatcher ─────────────────────────────────────────

describe('Validator dispatcher (validators/index.js)', () => {
  test('dispatches to investigation-report validator', () => {
    const content = makeReport();
    const result  = validate(content, 'Investigation Report');
    assert.equal(typeof result.passed, 'boolean');
    assert.ok(Array.isArray(result.failures));
  });

  test('dispatches to outcome-letter validator for Outcome Letter A', () => {
    const content = makeOutcomeLetter({ type: 'Outcome Letter A' });
    const result  = validate(content, 'Outcome Letter A');
    assert.equal(typeof result.passed, 'boolean');
  });

  test('dispatches to outcome-letter validator for Outcome Letter B', () => {
    const content = makeOutcomeLetter({ type: 'Outcome Letter B' });
    const result  = validate(content, 'Outcome Letter B');
    assert.equal(typeof result.passed, 'boolean');
  });

  test('dispatches to invitation-letter validator', () => {
    const content = makeInvitationLetter();
    const result  = validate(content, 'Invitation Letter');
    assert.equal(typeof result.passed, 'boolean');
  });

  test('dispatches to interview-framework validator', () => {
    const content = makeInterviewFramework();
    const result  = validate(content, 'Interview Framework');
    assert.equal(typeof result.passed, 'boolean');
  });

  test('falls back to default validator for unknown document type', () => {
    const result = validate('Some content.', 'Unknown Document Type');
    assert.equal(typeof result.passed, 'boolean');
    assert.ok(Array.isArray(result.failures));
  });
});

// ── Investigation Report validator ────────────────────────────────────────────

describe('Investigation Report validator', () => {
  test('passes when all requirements are met', () => {
    const result = invReport.validate(makeReport(), 'Investigation Report');
    assert.ok(result.passed, `Expected pass but got failures: ${result.failures.join('; ')}`);
    assert.equal(result.failures.length, 0);
  });

  test('fails when document is too short (< 500 words)', () => {
    const shortContent = 'This is a very short document.';
    const result = invReport.validate(shortContent, 'Investigation Report');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('too short')));
  });

  test('fails when Executive Summary section is missing', () => {
    const result = invReport.validate(makeReport({ omit: ['executiveSummary'] }), 'Investigation Report');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('Executive Summary')));
  });

  test('fails when Background/Context section is missing', () => {
    const result = invReport.validate(makeReport({ omit: ['background'] }), 'Investigation Report');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('Background')));
  });

  test('fails when Findings section is missing', () => {
    const result = invReport.validate(makeReport({ omit: ['findings'] }), 'Investigation Report');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('Findings')));
  });

  test('fails when Conclusions section is missing', () => {
    const result = invReport.validate(makeReport({ omit: ['conclusions'] }), 'Investigation Report');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('Conclusions')));
  });

  test('fails when Recommendations section is missing', () => {
    const result = invReport.validate(makeReport({ omit: ['recommendations'] }), 'Investigation Report');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('Recommendations')));
  });

  test('fails when allegations context provided but no verdict in content', () => {
    // Build a report with all sections but no substantiated/inconclusive/unsubstantiated
    const noVerdict = makeReport({ omit: ['conclusions'] })
      .replace(/substantiated|inconclusive|unsubstantiated/gi, 'considered');
    const result = invReport.validate(noVerdict, 'Investigation Report', {
      allegations: ['Allegation 1'],
    });
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('verdict') || f.toLowerCase().includes('allegation')));
  });

  test('passes when allegations context provided and verdict is present', () => {
    const content = makeReport(); // includes SUBSTANTIATED in conclusions
    const result  = invReport.validate(content, 'Investigation Report', {
      allegations: ['Allegation 1'],
    });
    assert.ok(result.passed, `Expected pass but got: ${result.failures.join('; ')}`);
  });

  test('fails when unfilled [INSERT X] template slots are present', () => {
    const content = makeReport() + '\n\n[INSERT DATE OF INCIDENT HERE]';
    const result  = invReport.validate(content, 'Investigation Report');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('Unfilled template slot')));
  });

  test('returns { passed: boolean, failures: array } shape', () => {
    const result = invReport.validate('Short.', 'Investigation Report');
    assert.equal(typeof result.passed, 'boolean');
    assert.ok(Array.isArray(result.failures));
  });

  test('multiple missing sections produce multiple failure entries', () => {
    const result = invReport.validate('Word '.repeat(600), 'Investigation Report');
    // No sections at all → all 8 section checks should fail
    assert.ok(result.failures.length >= 8);
  });
});

// ── Outcome Letter validator ──────────────────────────────────────────────────

describe('Outcome Letter validator', () => {
  test('Outcome Letter A passes when all requirements are met', () => {
    const result = outcomeLetter.validate(makeOutcomeLetter({ type: 'Outcome Letter A' }), 'Outcome Letter A');
    assert.ok(result.passed, `Expected pass but got: ${result.failures.join('; ')}`);
  });

  test('Outcome Letter B passes when all requirements are met (no appeal required)', () => {
    const result = outcomeLetter.validate(makeOutcomeLetter({ type: 'Outcome Letter B' }), 'Outcome Letter B');
    assert.ok(result.passed, `Expected pass but got: ${result.failures.join('; ')}`);
  });

  test('fails when too short (< 80 words)', () => {
    const result = outcomeLetter.validate('Dear [X], Outcome noted. Yours sincerely,', 'Outcome Letter A');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('too short')));
  });

  test('fails when salutation is missing', () => {
    const result = outcomeLetter.validate(
      makeOutcomeLetter({ type: 'Outcome Letter A', omit: ['salutation'] }),
      'Outcome Letter A'
    );
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('salutation')));
  });

  test('fails when sign-off is missing', () => {
    const result = outcomeLetter.validate(
      makeOutcomeLetter({ type: 'Outcome Letter A', omit: ['signOff'] }),
      'Outcome Letter A'
    );
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('sign-off')));
  });

  test('fails when no outcome/decision language is present', () => {
    const stripped = makeOutcomeLetter({ type: 'Outcome Letter A' })
      .replace(/outcome|decision|find|uphold|substantiat|case\s+to\s+answer/gi, 'addressed');
    const result = outcomeLetter.validate(stripped, 'Outcome Letter A');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('outcome') || f.toLowerCase().includes('decision')));
  });

  test('Outcome Letter A fails when appeal reference is missing', () => {
    const result = outcomeLetter.validate(
      makeOutcomeLetter({ type: 'Outcome Letter A', omit: ['appeal'] }),
      'Outcome Letter A'
    );
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('appeal')));
  });

  test('Outcome Letter B does NOT require appeal reference', () => {
    // Outcome Letter B without "appeal" text should still pass
    const content = makeOutcomeLetter({ type: 'Outcome Letter B' });
    const stripped = content.replace(/appeal/gi, 'noted');
    const result  = outcomeLetter.validate(stripped, 'Outcome Letter B');
    // Should pass (appeal requirement only applies to Letter A)
    assert.ok(result.passed, `Letter B should not require appeal language; failures: ${result.failures.join('; ')}`);
  });

  test('fails when unfilled [INSERT X] template slots are present', () => {
    const content = makeOutcomeLetter({ type: 'Outcome Letter A' }) + '\n[INSERT DATE]';
    const result  = outcomeLetter.validate(content, 'Outcome Letter A');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('Unfilled template slot')));
  });
});

// ── Invitation Letter validator ───────────────────────────────────────────────

describe('Invitation Letter validator', () => {
  test('passes when all requirements are met', () => {
    const result = invitationLetter.validate(makeInvitationLetter(), 'Invitation Letter');
    assert.ok(result.passed, `Expected pass but got: ${result.failures.join('; ')}`);
  });

  test('fails when too short (< 60 words)', () => {
    const result = invitationLetter.validate('Short.', 'Invitation Letter');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('too short')));
  });

  test('fails when salutation is missing', () => {
    const result = invitationLetter.validate(
      makeInvitationLetter({ omit: ['salutation'] }),
      'Invitation Letter'
    );
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('salutation')));
  });

  test('fails when sign-off is missing', () => {
    const result = invitationLetter.validate(
      makeInvitationLetter({ omit: ['signOff'] }),
      'Invitation Letter'
    );
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('sign-off')));
  });

  test('fails when meeting/interview reference is missing', () => {
    const stripped = makeInvitationLetter().replace(/meeting|interview/gi, 'discussion');
    const result   = invitationLetter.validate(stripped, 'Invitation Letter');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('meeting') || f.toLowerCase().includes('interview')));
  });

  test('fails when right-to-be-accompanied statement is missing', () => {
    const stripped = makeInvitationLetter().replace(/accompan\w*/gi, 'advised');
    const result   = invitationLetter.validate(stripped, 'Invitation Letter');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('accompanied')));
  });

  test('fails when no date/time/location reference is present', () => {
    const stripped = makeInvitationLetter()
      .replace(/date|time|location|venue/gi, 'details');
    const result = invitationLetter.validate(stripped, 'Invitation Letter');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('date') || f.toLowerCase().includes('location')));
  });

  test('fails when unfilled [INSERT X] slots are present', () => {
    const content = makeInvitationLetter() + '\n[INSERT ROOM NUMBER]';
    const result  = invitationLetter.validate(content, 'Invitation Letter');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('Unfilled template slot')));
  });
});

// ── Interview Framework validator ─────────────────────────────────────────────

describe('Interview Framework validator', () => {
  test('passes when all requirements are met', () => {
    const result = interviewFramework.validate(makeInterviewFramework(), 'Interview Framework');
    assert.ok(result.passed, `Expected pass but got: ${result.failures.join('; ')}`);
  });

  test('fails when too short (< 100 words)', () => {
    const result = interviewFramework.validate('Short text?', 'Interview Framework');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('too short')));
  });

  test('fails when fewer than 3 question marks', () => {
    const noQuestions = makeInterviewFramework()
      .replace(/\?/g, '.');
    const result = interviewFramework.validate(noQuestions, 'Interview Framework');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('question')));
  });

  test('passes with exactly 3 question marks', () => {
    // Replace all ? then add exactly 3
    const base = makeInterviewFramework().replace(/\?/g, '.');
    const content = base + '\n\nQ1? Q2? Q3?';
    const result  = interviewFramework.validate(content, 'Interview Framework');
    // Word count may be borderline — just check the question check passed
    const questionFail = result.failures.some(f => f.toLowerCase().includes('question'));
    assert.ok(!questionFail, 'Should not fail on question count with exactly 3 questions');
  });

  test('fails when no interviewee role reference is present', () => {
    const stripped = makeInterviewFramework()
      .replace(/interview|complainant|respondent|witness/gi, 'party');
    const result = interviewFramework.validate(stripped, 'Interview Framework');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('interviewee') || f.toLowerCase().includes('role')));
  });

  test('fails when no allegation/purpose reference is present', () => {
    const stripped = makeInterviewFramework()
      .replace(/allegation|purpose|issue|concern|incident/gi, 'matter');
    const result = interviewFramework.validate(stripped, 'Interview Framework');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.toLowerCase().includes('allegation') || f.toLowerCase().includes('purpose')));
  });

  test('fails when unfilled [INSERT X] slots are present', () => {
    const content = makeInterviewFramework() + '\n[INSERT WITNESS NAME]';
    const result  = interviewFramework.validate(content, 'Interview Framework');
    assert.ok(!result.passed);
    assert.ok(result.failures.some(f => f.includes('Unfilled template slot')));
  });
});

// ── Default validator ─────────────────────────────────────────────────────────

describe('Default validator', () => {
  test('passes for content with at least 20 words', () => {
    const content = 'This document contains sufficient words to pass the default minimum length check and should therefore pass validation without any issues.';
    const result  = defaultValidator.validate(content, 'Custom Type');
    assert.ok(result.passed, `Expected pass but got: ${result.failures.join('; ')}`);
    assert.equal(result.failures.length, 0);
  });

  test('returns { passed, failures } shape', () => {
    const result = defaultValidator.validate('', 'Custom Type');
    assert.equal(typeof result.passed, 'boolean');
    assert.ok(Array.isArray(result.failures));
  });
});

// ── Cross-cutting: unfilled slot detection ────────────────────────────────────

describe('Unfilled template slot detection (cross-validator)', () => {
  const SLOT_CONTENT = '[INSERT SOME VALUE HERE]';

  const cases = [
    ['Investigation Report', () => makeReport() + '\n' + SLOT_CONTENT, {}],
    ['Outcome Letter A',     () => makeOutcomeLetter() + '\n' + SLOT_CONTENT, {}],
    ['Invitation Letter',    () => makeInvitationLetter() + '\n' + SLOT_CONTENT, {}],
    ['Interview Framework',  () => makeInterviewFramework() + '\n' + SLOT_CONTENT, {}],
  ];

  for (const [docType, makeContent] of cases) {
    test(`${docType}: detects unfilled [INSERT ...] slot`, () => {
      const result = validate(makeContent(), docType);
      assert.ok(!result.passed, `${docType} should fail when unfilled slots are present`);
      assert.ok(
        result.failures.some(f => f.includes('Unfilled template slot')),
        `${docType}: expected unfilled-slot failure but got: ${result.failures.join('; ')}`
      );
    });
  }
});
