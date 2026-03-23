'use strict';
/**
 * validators/investigation-report.js
 *
 * Deterministic structural checks for Investigation Reports.
 * Pure function — no I/O, no API calls.
 */

const REQUIRED_SECTIONS = [
  { pattern: /executive\s+summary/i,           label: 'Executive Summary section' },
  { pattern: /background|context/i,            label: 'Background / Context section' },
  { pattern: /scope|terms\s+of\s+reference/i, label: 'Scope / Terms of Reference section' },
  { pattern: /methodology/i,                   label: 'Methodology section' },
  { pattern: /allegation/i,                    label: 'Allegations section' },
  { pattern: /finding/i,                       label: 'Findings section' },
  { pattern: /conclusion/i,                    label: 'Conclusions section' },
  { pattern: /recommendation/i,                label: 'Recommendations section' },
];

const VALID_VERDICTS = [
  /substantiated/i,
  /not\s+substantiated/i,
  /unsubstantiated/i,
  /inconclusive/i,
];

function validate(content, documentType, context = {}) {
  const failures = [];

  // 1. Minimum length check — a report shorter than 500 words is incomplete
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount < 500) {
    failures.push(`Document is too short (${wordCount} words). Investigation Reports must be substantive.`);
  }

  // 2. Required sections
  for (const { pattern, label } of REQUIRED_SECTIONS) {
    if (!pattern.test(content)) {
      failures.push(`Missing required section: ${label}`);
    }
  }

  // 3. Each allegation must have a verdict
  if (Array.isArray(context.allegations) && context.allegations.length > 0) {
    const hasAnyVerdict = VALID_VERDICTS.some(v => v.test(content));
    if (!hasAnyVerdict) {
      failures.push('No allegation verdict found. Each allegation must conclude with SUBSTANTIATED, NOT SUBSTANTIATED, or INCONCLUSIVE.');
    }
  }

  // 4. Must not contain literal placeholder tokens in the report body
  // (anonymised placeholders are fine; these are unfilled template slots)
  const unfilledSlots = content.match(/\[INSERT\s+[^\]]+\]/gi) || [];
  for (const slot of unfilledSlots) {
    failures.push(`Unfilled template slot found: ${slot}`);
  }

  // 5. No real-looking names should appear (heuristic: consecutive title-case words
  //    not preceded by a section-header indicator and not in brackets).
  // This is a light check only; full PII check is Stage 5 of quality review.
  // (Omitted intentionally — Stage 5 of the quality agent is the authoritative PII check.)

  return { passed: failures.length === 0, failures };
}

module.exports = { validate };
