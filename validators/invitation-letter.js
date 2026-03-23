'use strict';
/**
 * validators/invitation-letter.js
 *
 * Deterministic structural checks for Invitation Letters.
 * Pure function — no I/O, no API calls.
 */

function validate(content, documentType, context = {}) {
  const failures = [];

  // 1. Minimum length
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount < 60) {
    failures.push(`Document is too short (${wordCount} words). Invitation letters must be substantive.`);
  }

  // 2. Must be a letter — check for salutation with a placeholder name
  if (!/dear\s+\[/i.test(content)) {
    failures.push('Missing salutation. Invitation letters must begin with "Dear [PLACEHOLDER_NAME],".');
  }

  // 3. Must have a sign-off
  if (!/yours\s+sincerely|yours\s+faithfully/i.test(content)) {
    failures.push('Missing sign-off. Invitation letters must end with "Yours sincerely" or "Yours faithfully".');
  }

  // 4. Must reference a meeting or interview
  if (!/meeting|interview/i.test(content)) {
    failures.push('No meeting/interview reference found. Invitation letters must state the purpose of the meeting.');
  }

  // 5. Must reference the right to be accompanied
  if (!/accompan/i.test(content)) {
    failures.push('Missing right-to-be-accompanied statement. This is a legal requirement.');
  }

  // 6. Must include date/time/location placeholders (or actual values)
  if (!/date|time|location|venue/i.test(content)) {
    failures.push('No date, time, or location reference found. Invitation letters must include meeting logistics.');
  }

  // 7. Unfilled template slots
  const unfilledSlots = content.match(/\[INSERT\s+[^\]]+\]/gi) || [];
  for (const slot of unfilledSlots) {
    failures.push(`Unfilled template slot found: ${slot}`);
  }

  return { passed: failures.length === 0, failures };
}

module.exports = { validate };
