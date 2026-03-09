const { callClaude }  = require('../lib/anthropic');
const { logEntry }    = require('../lib/logger');
const casemanagement  = require('./casemanagement');

async function reviewDocument(input) {
  const prompt = `
You are the Quality Agent for an ER investigation platform.
Run a complete five-stage quality review following your SKILL file exactly.

Document Type: ${input.document_type}
Case Type: ${input.case_type}
Complexity: ${input.complexity}
Escalation Level: ${input.escalation_level}
Legal Involved: ${input.legal_involved}
Allegations: ${JSON.stringify(input.allegations)}
Protected Characteristics: ${JSON.stringify(input.protected_characteristics || [])}
Whistleblowing: ${input.whistleblowing || false}

Document:
---
${input.document_content}
---

Return the full quality report in the exact format from your SKILL file.
All five stage scores, all mandatory corrections, all advisory improvements, plain English summary.
`;

  const qualityReport = await callClaude('SKILL_quality_agent.md', prompt);

  const passMatch  = qualityReport.match(/OVERALL RESULT:\s*(PASS|FAIL|PASS WITH MANDATORY CORRECTIONS)/i);
  const scoreMatch = qualityReport.match(/OVERALL SCORE:\s*(\d+)/i);
  const result     = passMatch  ? passMatch[1]          : 'UNKNOWN';
  const score      = scoreMatch ? parseInt(scoreMatch[1]) : 0;

  await casemanagement.logQualityReview({
    case_reference: input.case_reference,
    document_type:  input.document_type,
    case_type:      input.case_type,
    complexity:     input.complexity,
    overall_score:  score,
    result
  });

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
    quality_report:  qualityReport,
    requires_action: result !== 'PASS'
  };
}

module.exports = { reviewDocument };
