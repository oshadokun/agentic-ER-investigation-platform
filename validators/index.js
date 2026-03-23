'use strict';
/**
 * validators/index.js
 *
 * Dispatches to the appropriate per-document-type validator.
 * Each validator is a pure function:
 *   validate(content: string, documentType: string, context?: object)
 *     => { passed: boolean, failures: string[] }
 *
 * No Claude API calls. No I/O. No side effects.
 */

const investigationReport  = require('./investigation-report');
const outcomeLetter        = require('./outcome-letter');
const invitationLetter     = require('./invitation-letter');
const interviewFramework   = require('./interview-framework');
const investigationPlan    = require('./investigation-plan');
const defaultValidator     = require('./default');

const VALIDATORS = {
  'Investigation Report':  investigationReport,
  'Outcome Letter A':      outcomeLetter,
  'Outcome Letter B':      outcomeLetter,
  'Invitation Letter':     invitationLetter,
  'Interview Framework':   interviewFramework,
  'Investigation Plan':    investigationPlan,
};

/**
 * @param {string} content      - The document text to validate
 * @param {string} documentType - e.g. 'Investigation Report'
 * @param {object} [context]    - Optional: { allegations, case_type, complexity }
 * @returns {{ passed: boolean, failures: string[] }}
 */
function validate(content, documentType, context = {}) {
  const validator = VALIDATORS[documentType] || defaultValidator;
  return validator.validate(content, documentType, context);
}

module.exports = { validate };
