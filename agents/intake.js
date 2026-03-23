'use strict';
const { callClaude }    = require('../lib/anthropic');
const { createCaseStructure, buildFileName, saveDocument } = require('../lib/filestore');
const { logEntry }      = require('../lib/logger');
const { convertToHtml } = require('../lib/converter');
require('dotenv').config();

/**
 * Creates the on-disk folder structure for the case and generates
 * acknowledgement letters via Claude.
 *
 * caseReference is assigned upstream by coordinator.js inside the
 * DB transaction, so this function only handles file I/O and the
 * Claude API call.
 */
async function openCase(caseReference, input) {
  await createCaseStructure(caseReference, input.case_type);

  await logEntry(caseReference, {
    event_type:   'Case opened',
    by:           'Intake Agent',
    details:      `Type: ${input.case_type}. Complexity: ${input.complexity}. ` +
                  `Escalation: ${input.escalation_level}. ` +
                  `Referring party: ${input.referring_party}. ` +
                  `Allegations: ${input.allegation_count}. ` +
                  `Legal: ${input.legal_involved ? 'Yes' : 'No'}.`,
    status_after: 'Open',
  });

  const prompt = `
You are the Intake Agent for an ER investigation platform.
A new case has been opened:

Case Reference: ${caseReference}
Case Type: ${input.case_type}
Complexity: ${input.complexity}
Escalation Level: ${input.escalation_level}
Referring Party Role: ${input.referring_party}
Complainant Role: ${input.complainant_role}
Respondent Role: ${input.respondent_role}
Allegation Count: ${input.allegation_count}
Legal Involved: ${input.legal_involved}
Case Open Date: ${input.case_open_date}

Following your SKILL file, produce three letters:
1. Acknowledgement to referring party
2. Acknowledgement to complainant (or note if not applicable)
3. Notification to respondent (flag: requires consultant timing confirmation before sending)

Use placeholders — no real names. Apply all case type special rules.
Label each: === LETTER 1 ===, === LETTER 2 ===, === LETTER 3 ===
`;

  const letters  = await callClaude('SKILL_intake_agent.md', prompt);
  const fileName = buildFileName(caseReference, 'Acknowledgement_Letters_DRAFT', { version: 'v1', ext: 'html' });
  await saveDocument(
    caseReference, '01_INTAKE', fileName,
    convertToHtml(letters, `Acknowledgement Letters — ${caseReference}`)
  );

  await logEntry(caseReference, {
    event_type:   'Document generated',
    by:           'Intake Agent',
    details:      `Acknowledgement drafts saved: 01_INTAKE/${fileName}`,
    status_after: 'In Progress',
  });

  return {
    case_reference: caseReference,
    status:         'Intake complete',
    letters_draft:  letters,
    letters_file:   fileName,
  };
}

module.exports = { openCase };
