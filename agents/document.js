'use strict';
/**
 * agents/document.js
 *
 * Document Agent — generates, validates, quality-reviews, and approves
 * investigation documents.
 *
 * Phase 3 additions:
 *  - Policy template injection (audited per condition 1)
 *  - Deterministic validator (pure function, per document type)
 *  - Reject-and-regenerate: up to 2 generation attempts before VALIDATION_FAILED
 *  - DOCX and PDF output on approval
 *  - All DB writes go through the documents table; document_id returned to caller
 */

const { callClaude }                      = require('../lib/anthropic');
const { logEntry }                        = require('../lib/logger');
const { saveDocument, buildFileName }     = require('../lib/filestore');
const { mergeNames, findUnmergedPlaceholders } = require('../lib/merger');
const { convertToHtml }                   = require('../lib/converter');
const { convertToDocx }                   = require('../lib/converter-docx');
const { convertToPdf }                    = require('../lib/converter-pdf');
const { loadPoliciesForDocumentType, recordInjections } = require('../lib/policy-loader');
const { validate }                        = require('../validators');
const { recordAuditEvent }               = require('../lib/audit');
const { getDb }                           = require('../lib/db');
const path                                = require('path');
require('dotenv').config();

// Maps document type to the category of party who receives the final document.
// Written to documents.recipient_category on approval.
const RECIPIENT_CATEGORY = {
  'Outcome Letter A':    'Complainant',
  'Outcome Letter B':    'Respondent',
  'Invitation Letter':   'Participant',
};

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

// Document types that ALWAYS get a quality review (Phase 3: all 4 main types)
const ALWAYS_QUALITY_REVIEW = new Set([
  'Investigation Report',
  'Outcome Letter A',
  'Outcome Letter B',
  'Invitation Letter',
  'Interview Framework',
]);

/**
 * Calls Claude to generate document text with policy templates injected.
 *
 * @param {object} anonymisedCase
 * @param {string} documentType
 * @param {string} additionalContext
 * @param {Array}  policies           - Active policy templates from DB
 * @returns {Promise<string>}
 */
async function _callDocumentAgent(anonymisedCase, documentType, additionalContext, policies) {
  const formatHint   = FORMAT_HINTS[documentType] || '';
  const policyBlock  = policies.length > 0
    ? `\nORGANISATIONAL POLICIES AND TEMPLATES TO APPLY:\n${policies.map(p => `--- ${p.name} (v${p.version}) ---\n${p.content}`).join('\n\n')}\n`
    : '\nNo specific policy templates have been injected for this document type.\n';

  const prompt = `
You are the Document Agent for an ER investigation platform.
Generate a complete ${documentType} following your SKILL file exactly.

Case details:
${JSON.stringify(anonymisedCase, null, 2)}
${additionalContext ? `\nAdditional context:\n${additionalContext}` : ''}
${policyBlock}
Rules:
- Placeholders only — no real names
- Exact structure from SKILL file for this document type
- Include Consultant Review Checklist at the end
- Apply all language and tone standards
- Flag escalation concerns at the top if present
${formatHint}
`;

  return callClaude('SKILL_document_agent.md', prompt);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates a document with policy injection, deterministic validation,
 * and reject-and-regenerate (up to 2 attempts). Records the document in the
 * `documents` table and creates a full audit trail.
 *
 * @returns {Promise<object>} result object (see below)
 */
async function generateDocument(anonymisedCase, documentType, additionalContext = '') {
  const db        = getDb();
  const folder    = FOLDER_MAP[documentType] || '03_CORRESPONDENCE/Outgoing';
  const today     = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const caseRef   = anonymisedCase.case_reference;

  // ── Load applicable policy templates ────────────────────────────────────
  const policies   = await loadPoliciesForDocumentType(documentType);
  const policyIds  = policies.map(p => p.id);

  // ── Attempt 1 ────────────────────────────────────────────────────────────
  let draftText    = await _callDocumentAgent(anonymisedCase, documentType, additionalContext, policies);
  let validation   = validate(draftText, documentType, {
    allegations: anonymisedCase.allegations,
    case_type:   anonymisedCase.case_type,
    complexity:  anonymisedCase.complexity,
  });

  let attempt      = 1;
  let finalStatus  = validation.passed ? 'VALIDATION_PASSED' : null;

  // ── Attempt 2 (if attempt 1 failed validation) ───────────────────────────
  if (!validation.passed) {
    await logEntry(caseRef, {
      event_type:   'Validation failed (attempt 1)',
      by:           'Document Agent',
      details:      `${documentType}: ${validation.failures.join('; ')}`,
      status_after: 'Regenerating'
    });

    // Regenerate with explicit failure feedback
    const correctionContext = `
IMPORTANT — Previous generation failed validation. Fix these issues:
${validation.failures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

${additionalContext}`.trim();

    draftText  = await _callDocumentAgent(anonymisedCase, documentType, correctionContext, policies);
    validation = validate(draftText, documentType, {
      allegations: anonymisedCase.allegations,
      case_type:   anonymisedCase.case_type,
      complexity:  anonymisedCase.complexity,
    });
    attempt    = 2;
    finalStatus = validation.passed ? 'VALIDATION_PASSED' : 'VALIDATION_FAILED';
  }

  // ── Insert documents row ──────────────────────────────────────────────────
  const insertResult = await db.run(
    `INSERT INTO documents
       (case_reference, document_type, attempt, status, validation_failures)
     VALUES (?, ?, ?, ?, ?)`,
    [
      caseRef,
      documentType,
      attempt,
      finalStatus,
      validation.passed ? null : JSON.stringify(validation.failures),
    ]
  );
  const documentId = insertResult.lastInsertRowid;

  // ── Record policy injections (always — NULL row if none) ──────────────────
  await recordInjections(documentId, policyIds);

  // ── Audit VALIDATION_FAILED ───────────────────────────────────────────────
  if (finalStatus === 'VALIDATION_FAILED') {
    await recordAuditEvent({
      case_reference: caseRef,
      document_id:    documentId,
      event_type:     'VALIDATION_FAILED',
      details:        { document_type: documentType, failures: validation.failures, attempts: 2 },
      actor:          'system',
    });
  }

  // ── Save HTML file ────────────────────────────────────────────────────────
  const fileName = buildFileName(caseRef, documentType.replace(/\s/g, '_'), {
    date: today, version: `DRAFT_v${attempt}`, ext: 'html'
  });
  const htmlPath = `${folder}/${fileName}`;
  await saveDocument(caseRef, folder, fileName,
    convertToHtml(draftText, `${documentType} — ${caseRef} DRAFT`)
  );

  // Update documents row with html_path
  await db.run(
    `UPDATE documents SET html_path = ?, updated_at = datetime('now') WHERE id = ?`,
    [htmlPath, documentId]
  );

  await logEntry(caseRef, {
    event_type:   'Document generated',
    by:           'Document Agent',
    details:      `${documentType} draft (attempt ${attempt}): ${htmlPath} [${finalStatus}]`,
    status_after: finalStatus === 'VALIDATION_FAILED' ? 'Validation Failed' : 'In Progress'
  });

  // ── Quality review ────────────────────────────────────────────────────────
  const qualityRequired =
    ALWAYS_QUALITY_REVIEW.has(documentType) ||
    ['High', 'Very High'].includes(anonymisedCase.complexity);

  let qualityReview = null;
  if (qualityRequired && finalStatus !== 'VALIDATION_FAILED') {
    const qualityAgent = require('./quality');
    try {
      qualityReview = await qualityAgent.reviewDocument({
        case_reference:   caseRef,
        document_type:    documentType,
        case_type:        anonymisedCase.case_type,
        complexity:       anonymisedCase.complexity,
        escalation_level: anonymisedCase.escalation_required ? 'Advisory' : 'None',
        legal_involved:   anonymisedCase.legal_involved,
        allegations:      anonymisedCase.allegations,
        document_content: draftText,
        document_id:      documentId,
      });
    } catch (err) {
      // QUALITY_PARSE_ERROR — surface in result but don't crash generation
      qualityReview = { error: err.message, overall_result: 'QUALITY_PARSE_ERROR' };
    }
  }

  return {
    document_id:         documentId,
    document_type:       documentType,
    draft_text:          draftText,
    file_name:           fileName,
    file_path:           htmlPath,
    attempt,
    status:              finalStatus,
    validation_passed:   validation.passed,
    validation_failures: validation.passed ? [] : validation.failures,
    quality_required:    qualityRequired,
    quality_review:      qualityReview,
    policies_injected:   policies.map(p => ({ id: p.id, name: p.name, version: p.version })),
  };
}

/**
 * Approves a document: merges real names, saves FINAL HTML, DOCX, and PDF.
 * Records DOCUMENT_APPROVED in audit_events.
 *
 * @param {string} caseReference
 * @param {string} documentType
 * @param {string} draftText
 * @param {object} nameMap
 * @param {number} [documentId]   - DB id for documents row update (optional)
 * @param {boolean} [override]    - true if investigator is overriding VALIDATION_FAILED
 */
async function approveDocument(caseReference, documentType, draftText, nameMap, documentId = null, override = false) {
  const mergedText    = mergeNames(draftText, nameMap);
  const remaining     = findUnmergedPlaceholders(mergedText);
  const today         = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const folder        = FOLDER_MAP[documentType] || '09_OUTCOME';

  const finalFileName = buildFileName(caseReference, documentType.replace(/\s/g, '_'), {
    date: today, version: 'FINAL', ext: 'html'
  });
  const docxFileName  = buildFileName(caseReference, documentType.replace(/\s/g, '_'), {
    date: today, version: 'FINAL', ext: 'docx'
  });
  const pdfFileName   = buildFileName(caseReference, documentType.replace(/\s/g, '_'), {
    date: today, version: 'FINAL', ext: 'pdf'
  });

  const htmlPath = `${folder}/${finalFileName}`;
  const docxPath = `${folder}/${docxFileName}`;
  const pdfPath  = `${folder}/${pdfFileName}`;
  const docTitle = `${documentType} — ${caseReference} FINAL`;

  // Save all three formats
  await saveDocument(caseReference, folder, finalFileName,
    convertToHtml(mergedText, docTitle)
  );

  const docxBuffer = await convertToDocx(mergedText, docTitle, caseReference);
  await saveDocument(caseReference, folder, docxFileName, docxBuffer);

  const pdfBuffer  = await convertToPdf(mergedText, docTitle, caseReference);
  await saveDocument(caseReference, folder, pdfFileName, pdfBuffer);

  // Update documents row
  if (documentId) {
    const db               = getDb();
    const status           = override ? 'OVERRIDE' : 'APPROVED';
    const recipientCategory = RECIPIENT_CATEGORY[documentType] || 'Internal';
    await db.run(
      `UPDATE documents
          SET status = ?, html_path = ?, docx_path = ?, pdf_path = ?,
              recipient_category = ?, updated_at = datetime('now')
        WHERE id = ?`,
      [status, htmlPath, docxPath, pdfPath, recipientCategory, documentId]
    );

    // Audit
    await recordAuditEvent({
      case_reference: caseReference,
      document_id:    documentId,
      event_type:     override ? 'VALIDATION_OVERRIDE' : 'DOCUMENT_APPROVED',
      details:        { document_type: documentType, format: 'html,docx,pdf', version: 'FINAL', override },
      actor:          'consultant',
    });
  }

  await logEntry(caseReference, {
    event_type:   override ? 'Document approved (override)' : 'Document approved',
    by:           'Consultant',
    details:      `${documentType} FINAL saved: HTML, DOCX, PDF → ${folder}/`,
    status_after: 'In Progress'
  });

  return {
    status:                 override ? 'Approved (override)' : 'Approved',
    file_name:              finalFileName,
    file_path:              htmlPath,
    docx_path:              docxPath,
    pdf_path:               pdfPath,
    merged_text:            mergedText,
    remaining_placeholders: remaining,
    warning: remaining.length > 0
      ? `${remaining.length} placeholder(s) still need filling: ${remaining.join(', ')}`
      : null
  };
}

module.exports = { generateDocument, approveDocument };
