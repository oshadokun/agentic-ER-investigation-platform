'use strict';
/**
 * validators/default.js
 *
 * Fallback validator for document types without a dedicated validator.
 * Applies minimal checks only.
 * Pure function — no I/O, no API calls.
 */

function validate(content, documentType, context = {}) {
  const failures = [];

  // 1. Must not be empty
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount < 20) {
    failures.push(`Document is too short (${wordCount} words). The document appears to be empty or incomplete.`);
  }

  // 2. Unfilled template slots
  const unfilledSlots = content.match(/\[INSERT\s+[^\]]+\]/gi) || [];
  for (const slot of unfilledSlots) {
    failures.push(`Unfilled template slot found: ${slot}`);
  }

  return { passed: failures.length === 0, failures };
}

module.exports = { validate };
