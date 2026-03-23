'use strict';
/**
 * validators/interview-framework.js
 *
 * Deterministic structural checks for Interview Frameworks.
 * Pure function — no I/O, no API calls.
 */

function validate(content, documentType, context = {}) {
  const failures = [];

  // 1. Minimum length
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount < 100) {
    failures.push(`Document is too short (${wordCount} words). Interview frameworks must be substantive.`);
  }

  // 2. Must contain questions (indicated by '?' or numbered question lists)
  const questionCount = (content.match(/\?/g) || []).length;
  if (questionCount < 3) {
    failures.push(`Too few questions found (${questionCount}). An interview framework must contain at least 3 questions.`);
  }

  // 3. Must reference the interviewee role or purpose
  if (!/interview|complainant|respondent|witness/i.test(content)) {
    failures.push('No interviewee role reference found. The framework must identify who is being interviewed.');
  }

  // 4. Must reference the allegation or purpose of the interview
  if (!/allegation|purpose|issue|concern|incident/i.test(content)) {
    failures.push('No allegation or purpose reference found. The framework must reference what is being investigated.');
  }

  // 5. Unfilled template slots
  const unfilledSlots = content.match(/\[INSERT\s+[^\]]+\]/gi) || [];
  for (const slot of unfilledSlots) {
    failures.push(`Unfilled template slot found: ${slot}`);
  }

  return { passed: failures.length === 0, failures };
}

module.exports = { validate };
