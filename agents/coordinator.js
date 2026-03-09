const { callClaude }  = require('../lib/anthropic');
const { anonymise, anonymiseAllegations } = require('../lib/anonymiser');
const intake         = require('./intake');
const casemanagement = require('./casemanagement');
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

async function processCase(fullCaseData) {
  const required = ['case_type', 'allegations', 'complainant_role', 'respondent_role', 'incident_period', 'referring_party'];
  const missing  = required.filter(f => !fullCaseData[f]);
  if (missing.length > 0) return { status: 'VALIDATION_FAILED', missing_fields: missing, message: `Missing: ${missing.join(', ')}` };

  let anonymised, nameMap;
  try {
    ({ anonymised, nameMap } = anonymise(fullCaseData));
    anonymised.allegations    = anonymiseAllegations(fullCaseData.allegations, nameMap);
    anonymised.referring_party = fullCaseData.referring_party || '';
  } catch (err) {
    return { status: 'PII_DETECTED', message: err.message };
  }

  const classPrompt = `
You are the Coordinator Agent for an ER investigation platform.
Analyse this case and return ONLY a JSON object with these fields:
case_type_confirmed, complexity_score (0-10), complexity_level ("Low"|"Medium"|"High"|"Very High"),
escalation_level ("None"|"Advisory"|"Mandatory"), escalation_reasons (array of strings),
timeline_weeks (integer), document_set (array of strings), legal_involvement_recommended (boolean), workflow_notes (string)

Case data:
${JSON.stringify(anonymised, null, 2)}

Return ONLY the JSON object. No other text.
`;

  const raw = await callClaude('SKILL_coordinator_agent.md', classPrompt);
  let classification;
  try {
    classification = JSON.parse(raw);
  } catch (e) {
    const m = raw.match(/\{[\s\S]+\}/);
    classification = m ? JSON.parse(m[0]) : null;
  }
  if (!classification) return { status: 'CLASSIFICATION_FAILED', message: 'Could not classify case. Please try again.' };

  const intakeResult = await intake.openCase({
    ...anonymised,
    escalation_level: classification.escalation_level,
    complexity:       classification.complexity_level,
    case_open_date:   new Date().toISOString().split('T')[0]
  });

  const caseReference = intakeResult.case_reference;

  await casemanagement.initialiseCase({
    case_reference:   caseReference,
    case_type:        anonymised.case_type,
    complexity:       classification.complexity_level,
    timeline_weeks:   classification.timeline_weeks,
    escalation_level: classification.escalation_level,
    legal_involved:   anonymised.legal_involved
  });

  const casesPath = process.env.CASE_FILES_PATH || './cases';

  // Store nameMap locally — never sent to the API
  const nameMapPath = path.join(casesPath, caseReference, '00_CASE_LOG', `${caseReference}_NameMap.json`);
  await fs.writeFile(nameMapPath, JSON.stringify(nameMap, null, 2));

  // Store full anonymised case data for later document generation
  const caseDataFull = {
    ...anonymised,
    case_reference:   caseReference,
    complexity:       classification.complexity_level,
    escalation_level: classification.escalation_level,
    case_open_date:   new Date().toISOString().split('T')[0],
    classification
  };
  const caseDataPath = path.join(casesPath, caseReference, '00_CASE_LOG', `${caseReference}_CaseData.json`);
  await fs.writeFile(caseDataPath, JSON.stringify(caseDataFull, null, 2));

  return {
    status:             'CASE_OPENED',
    case_reference:     caseReference,
    classification,
    intake_result:      intakeResult,
    escalation_level:   classification.escalation_level,
    escalation_reasons: classification.escalation_reasons,
    workflow_plan: {
      phases: [
        { phase: 1, name: 'Case Opening',  documents: ['Investigation Plan', 'Invitation Letters'] },
        { phase: 2, name: 'Investigation', documents: ['Interview Frameworks', 'Evidence Log', 'Case Chronology'] },
        { phase: 3, name: 'Reporting',     documents: ['Investigation Report', 'Case Summary'] },
        { phase: 4, name: 'Outcome',       documents: ['Outcome Letter A', 'Outcome Letter B'] }
      ]
    },
    message: classification.escalation_level !== 'None'
      ? `⚠ Case opened with ${classification.escalation_level} escalation: ${classification.escalation_reasons.join(', ')}`
      : `Case ${caseReference} opened successfully.`
  };
}

module.exports = { processCase };
