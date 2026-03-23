'use strict';
/**
 * validators/investigation-plan.js
 *
 * Deterministic structural checks for Investigation Plans.
 * Pure function — no I/O, no API calls.
 */

const REQUIRED_SECTIONS = [
  { pattern: /case\s+overview|background/i,    label: 'Case Overview / Background section' },
  { pattern: /scope|objective/i,               label: 'Scope / Objectives section' },
  { pattern: /witness|interview/i,             label: 'Witnesses / Interviews section' },
  { pattern: /evidence/i,                      label: 'Evidence section' },
  { pattern: /timeline|timescale/i,            label: 'Timeline / Timescales section' },
];

function validate(content, documentType, context = {}) {
  const failures = [];

  // 1. Minimum length
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount < 150) {
    failures.push(`Document is too short (${wordCount} words). Investigation plans must be substantive.`);
  }

  // 2. Required sections
  for (const { pattern, label } of REQUIRED_SECTIONS) {
    if (!pattern.test(content)) {
      failures.push(`Missing required section: ${label}`);
    }
  }

  // 3. Unfilled template slots
  const unfilledSlots = content.match(/\[INSERT\s+[^\]]+\]/gi) || [];
  for (const slot of unfilledSlots) {
    failures.push(`Unfilled template slot found: ${slot}`);
  }

  return { passed: failures.length === 0, failures };
}

module.exports = { validate };
