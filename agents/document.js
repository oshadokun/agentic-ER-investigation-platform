const { callClaude }  = require('../lib/anthropic');
const { logEntry }    = require('../lib/logger');
const { saveDocument, buildFileName } = require('../lib/filestore');
const { mergeNames, findUnmergedPlaceholders } = require('../lib/merger');
const { convertToHtml } = require('../lib/converter');
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

const FOLDER_MAP = {
  'Investigation Plan':   '02_INVESTIGATION_PLAN',
  'Invitation Letter':    '03_CORRESPONDENCE/Outgoing',
  'Interview Framework':  '04_INTERVIEWS',
  'Witness Statement':    '06_WITNESS_STATEMENTS',
  'Investigation Report': '08_REPORT/Drafts',
  'Outcome Letter A':     '09_OUTCOME',
  'Outcome Letter B':     '09_OUTCOME',
  'Evidence Log':         '05_EVIDENCE',
  'Case Chronology':      '07_CHRONOLOGY',
  'Case Summary':         '09_OUTCOME'
};

const FORMAT_HINTS = {
  'Invitation Letter': `
FORMAT REQUIREMENT — THIS IS A BUSINESS LETTER, NOT A REPORT:
- Output a single, well-structured business letter
- Start with: [Date], then a blank line, then the recipient's address block using role placeholders (e.g. [COMPLAINANT_NAME], [COMPLAINANT_ADDRESS])
- Then the salutation: Dear [COMPLAINANT_NAME],
- Use short, clear prose paragraphs — NO bullet points, NO numbered lists, NO bold section headings within the body
- The letter must cover: (1) purpose of the meeting, (2) what the process involves, (3) their right to be accompanied, (4) date/time/location placeholders, (5) what to bring if anything, (6) reassurance about the process
- End with: Yours sincerely, [blank line], [INVESTIGATOR_NAME], [INVESTIGATOR_TITLE]
- Keep the entire letter to one page — concise, plain English, professional but approachable
- Do NOT use === LETTER === separators or any report-style structure`,

  'Outcome Letter A': `
FORMAT REQUIREMENT — THIS IS A FORMAL OUTCOME LETTER:
- Business letter format: date, recipient address block, salutation
- Short prose paragraphs only — no bullet-point lists within the main body
- Cover: outcome decision, brief reasoning, any recommendations, right of appeal and deadline
- Sign-off: Yours sincerely, [DECISION_MAKER_NAME], [TITLE]`,

  'Outcome Letter B': `
FORMAT REQUIREMENT — THIS IS A FORMAL OUTCOME LETTER:
- Business letter format: date, recipient address block, salutation
- Short prose paragraphs only
- Cover: outcome as it relates to this party, any actions/recommendations, next steps
- Sign-off: Yours sincerely, [DECISION_MAKER_NAME], [TITLE]`,

  'Investigation Plan': `
FORMAT REQUIREMENT — THIS IS A WORKING INVESTIGATION PLAN DOCUMENT:
- Use clear numbered sections with bold headings
- Sections must include: 1. Case Overview, 2. Scope & Objectives, 3. Key Issues to Investigate, 4. Witnesses to Interview, 5. Evidence Required, 6. Investigation Timeline, 7. Confidentiality Considerations, 8. Consultant Review Checklist
- Use numbered or bulleted sub-items within sections where appropriate
- This is an internal working document, not a letter — structured headings are correct here`,

  'Investigation Report': `
FORMAT REQUIREMENT — THIS IS A FORMAL INVESTIGATION REPORT:
- Title page block: Report title, Case Reference, Date, Prepared by [INVESTIGATOR_NAME]
- Numbered sections: 1. Executive Summary, 2. Background, 3. Scope, 4. Methodology, 5. Findings (one sub-section per allegation), 6. Conclusions, 7. Recommendations, 8. Appendices list
- Each finding section must state: the allegation, evidence considered, analysis, conclusion (upheld/not upheld/inconclusive)
- Formal, objective, third-person language throughout`,
};

async function generateDocument(anonymisedCase, documentType, additionalContext = '') {
  const formatHint = FORMAT_HINTS[documentType] || '';
  const prompt = `
You are the Document Agent for an ER investigation platform.
Generate a complete ${documentType} following your SKILL file exactly.

Case details:
${JSON.stringify(anonymisedCase, null, 2)}
${additionalContext ? `\nAdditional context:\n${additionalContext}` : ''}

Rules:
- Placeholders only — no real names
- Exact structure from SKILL file for this document type
- Include Consultant Review Checklist at the end
- Apply all language and tone standards
- Flag escalation concerns at the top if present
${formatHint}
`;

  const draftText  = await callClaude('SKILL_document_agent.md', prompt);
  const folder     = FOLDER_MAP[documentType] || '03_CORRESPONDENCE/Outgoing';
  const today      = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const fileName   = buildFileName(
    anonymisedCase.case_reference,
    documentType.replace(/\s/g, '_'),
    { date: today, version: 'DRAFT_v1', ext: 'html' }
  );

  await saveDocument(anonymisedCase.case_reference, folder, fileName, convertToHtml(draftText, `${documentType} — ${anonymisedCase.case_reference} DRAFT`));
  await logEntry(anonymisedCase.case_reference, {
    event_type:   'Document generated',
    by:           'Document Agent',
    details:      `${documentType} draft: ${folder}/${fileName}`,
    status_after: 'In Progress'
  });

  const qualityRequired =
    ['Investigation Report', 'Outcome Letter A', 'Outcome Letter B'].includes(documentType) ||
    ['High', 'Very High'].includes(anonymisedCase.complexity);

  return {
    document_type:    documentType,
    draft_text:       draftText,
    file_name:        fileName,
    file_path:        `${folder}/${fileName}`,
    quality_required: qualityRequired,
    status:           'Draft — awaiting consultant review'
  };
}

async function approveDocument(caseReference, documentType, draftText, nameMap) {
  const mergedText    = mergeNames(draftText, nameMap);
  const remaining     = findUnmergedPlaceholders(mergedText);
  const today         = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const folder        = FOLDER_MAP[documentType] || '09_OUTCOME';
  const finalFileName = buildFileName(
    caseReference,
    documentType.replace(/\s/g, '_'),
    { date: today, version: 'FINAL', ext: 'html' }
  );

  await saveDocument(caseReference, folder, finalFileName, convertToHtml(mergedText, `${documentType} — ${caseReference} FINAL`));
  await logEntry(caseReference, {
    event_type:   'Document approved',
    by:           'Consultant',
    details:      `${documentType} FINAL saved: ${folder}/${finalFileName}`,
    status_after: 'In Progress'
  });

  return {
    status:                  'Approved',
    file_name:               finalFileName,
    file_path:               `${folder}/${finalFileName}`,
    merged_text:             mergedText,
    remaining_placeholders:  remaining,
    warning: remaining.length > 0
      ? `${remaining.length} placeholder(s) still need filling: ${remaining.join(', ')}`
      : null
  };
}

module.exports = { generateDocument, approveDocument };
