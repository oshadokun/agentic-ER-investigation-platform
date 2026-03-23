'use strict';
/**
 * validators/outcome-letter.js
 *
 * Deterministic structural checks for Outcome Letter A and Outcome Letter B.
 * Pure function — no I/O, no API calls.
 */

function validate(content, documentType, context = {}) {
  const failures = [];

  // 1. Minimum length — outcome letters must be substantive
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount < 80) {
    failures.push(`Document is too short (${wordCount} words). Outcome letters must be substantive.`);
  }

  // 2. Must look like a letter (salutation)
  if (!/dear\s+\[/i.test(content)) {
    failures.push('Missing salutation. Outcome letters must begin with "Dear [PLACEHOLDER_NAME],".');
  }

  // 3. Must have a sign-off
  if (!/yours\s+sincerely|yours\s+faithfully/i.test(content)) {
    failures.push('Missing sign-off. Outcome letters must end with "Yours sincerely" or "Yours faithfully".');
  }

  // 4. Must reference outcome or decision
  if (!/outcome|decision|find|uphold|not\s+uphold|substantiat|case\s+to\s+answer/i.test(content)) {
    failures.push('No outcome or decision language detected. The letter must state the outcome clearly.');
  }

  // 5. Must reference right of appeal (for Outcome Letter A — the primary recipient)
  if (documentType === 'Outcome Letter A') {
    if (!/appeal/i.test(content)) {
      failures.push('Outcome Letter A must reference the right of appeal.');
    }
  }

  // 6. Unfilled template slots
  const unfilledSlots = content.match(/\[INSERT\s+[^\]]+\]/gi) || [];
  for (const slot of unfilledSlots) {
    failures.push(`Unfilled template slot found: ${slot}`);
  }

  return { passed: failures.length === 0, failures };
}

module.exports = { validate };
