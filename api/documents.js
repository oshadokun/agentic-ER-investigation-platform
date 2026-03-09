const express       = require('express');
const router        = express.Router();
const documentAgent = require('../agents/document');
const qualityAgent  = require('../agents/quality');
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

router.post('/generate', async (req, res) => {
  try {
    const { anonymisedCase, documentType, additionalContext } = req.body;
    const result = await documentAgent.generateDocument(anonymisedCase, documentType, additionalContext);
    if (result.quality_required) {
      result.quality_review = await qualityAgent.reviewDocument({
        case_reference:   anonymisedCase.case_reference,
        document_type:    documentType,
        case_type:        anonymisedCase.case_type,
        complexity:       anonymisedCase.complexity,
        escalation_level: anonymisedCase.escalation_required ? 'Advisory' : 'None',
        legal_involved:   anonymisedCase.legal_involved,
        allegations:      anonymisedCase.allegations,
        document_content: result.draft_text
      });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

router.post('/approve', async (req, res) => {
  try {
    const { caseReference, documentType, draftText } = req.body;
    const nameMapPath = path.join(
      process.env.CASE_FILES_PATH || './cases',
      caseReference, '00_CASE_LOG', `${caseReference}_NameMap.json`
    );
    const nameMap = JSON.parse(await fs.readFile(nameMapPath, 'utf8'));
    res.json(await documentAgent.approveDocument(caseReference, documentType, draftText, nameMap));
  } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

module.exports = router;
