'use strict';
/**
 * agents/quality.js
 *
 * Quality Agent — runs a structured 5-stage quality review via Claude.
 * The skill file instructs Claude to return ONLY valid JSON.
 * Invalid JSON from the quality agent is a hard failure (QUALITY_PARSE_ERROR).
 */

const { callClaude }       = require('../lib/anthropic');
const { logEntry }         = require('../lib/logger');
const { getDb }            = require('../lib/db');
const { recordAuditEvent } = require('../lib/audit');
const casemanagement       = require('./casemanagement');

/**
 * Reviews a document using the Quality Agent skill.
 *
 * @param {object} input
 * @param {string} input.case_reference
 * @param {string} input.document_type
 * @param {string} input.case_type
 * @param {string} input.complexity
 * @param {string} input.escalation_level
 * @param {boolean} input.legal_involved
 * @param {string[]} input.allegations
 * @param {string} input.document_content
 * @param {number} [input.document_id]   - DB id of the documents row (optional)
 * @param {string[]} [input.protected_characteristics]
 * @param {boolean} [input.whistleblowing]
 *
 * @returns {Promise<{
 *   case_reference: string,
 *   document_type: string,
 *   overall_result: string,
 *   overall_score: number,
 *   quality_json: object,
 *   requires_action: boolean
 * }>}
 *
 * @throws {Error} if the quality agent returns invalid JSON (QUALITY_PARSE_ERROR)
 */
async function reviewDocument(input) {
  const prompt = `
You are the Quality Agent for an ER investigation platform.
Run a complete five-stage quality review following your SKILL file exactly.

Document Type: ${input.document_type}
Case Type: ${input.case_type}
Complexity: ${input.complexity}
Escalation Level: ${input.escalation_level}
Legal Involved: ${input.legal_involved}
Allegations: ${JSON.stringify(input.allegations || [])}
Protected Characteristics: ${JSON.stringify(input.protected_characteristics || [])}
Whistleblowing: ${input.whistleblowing || false}

Document:
---
${input.document_content}
---

IMPORTANT: Your entire response must be a single valid JSON object as specified in your SKILL file.
No preamble. No explanation. No markdown. Just the JSON object.
`;

  const rawResponse = await callClaude('SKILL_quality_agent.md', prompt);

  // Hard failure if Claude does not return valid JSON
  let qualityJson;
  try {
    qualityJson = JSON.parse(rawResponse);
  } catch (parseErr) {
    // Record the parse error in audit_events before throwing
    await _recordAuditEvent({
      case_reference: input.case_reference,
      document_id:    input.document_id || null,
      event_type:     'QUALITY_PARSE_ERROR',
      details:        { document_type: input.document_type, raw_length: rawResponse.length },
      actor:          'system',
    });
    await logEntry(input.case_reference, {
      event_type:   'Quality review error',
      by:           'Quality Agent',
      details:      `${input.document_type}: QUALITY_PARSE_ERROR — quality agent returned non-JSON`,
      status_after: 'Error'
    });
    throw new Error(`QUALITY_PARSE_ERROR: Quality agent returned invalid JSON for ${input.document_type}. Review cannot proceed.`);
  }

  const result = qualityJson.overall_result || 'UNKNOWN';
  const score  = typeof qualityJson.overall_score === 'number' ? qualityJson.overall_score : 0;

  // Log to quality_reviews table (for trend tracking)
  await casemanagement.logQualityReview({
    case_reference: input.case_reference,
    document_type:  input.document_type,
    case_type:      input.case_type,
    complexity:     input.complexity,
    overall_score:  score,
    result,
  });

  // Record in audit_events for quality failures
  if (result === 'FAIL' || result === 'AUTOMATIC_FAIL') {
    await _recordAuditEvent({
      case_reference: input.case_reference,
      document_id:    input.document_id || null,
      event_type:     'QUALITY_FAILED',
      details:        {
        document_type:         input.document_type,
        overall_result:        result,
        overall_score:         score,
        mandatory_corrections: (qualityJson.mandatory_corrections || []).length,
      },
      actor: 'system',
    });
  }

  // Update documents row if document_id provided
  if (input.document_id) {
    const db = getDb();
    await db.run(
      `UPDATE documents
          SET quality_score = ?, quality_result = ?, quality_json = ?, updated_at = datetime('now')
        WHERE id = ?`,
      [score, result, JSON.stringify(qualityJson), input.document_id]
    );
  }

  await logEntry(input.case_reference, {
    event_type:   'Quality review',
    by:           'Quality Agent',
    details:      `${input.document_type}: ${result} (Score: ${score}/100)`,
    status_after: result === 'PASS' ? 'Report Review' : 'Corrections Required'
  });

  return {
    case_reference:  input.case_reference,
    document_type:   input.document_type,
    overall_result:  result,
    overall_score:   score,
    quality_json:    qualityJson,
    requires_action: result !== 'PASS',
  };
}

module.exports = { reviewDocument };
