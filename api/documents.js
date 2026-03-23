'use strict';
const express       = require('express');
const router        = express.Router();
const documentAgent = require('../agents/document');
const qualityAgent  = require('../agents/quality');
const { getDb }     = require('../lib/db');
const { decrypt }   = require('../lib/encryption');
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
        document_content: result.draft_text,
      });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

router.post('/approve', async (req, res) => {
  try {
    const { caseReference, documentType, draftText } = req.body;

    const db  = getDb();
    const row = await db.get(
      'SELECT encrypted_data, iv, auth_tag FROM name_maps WHERE case_reference = ?',
      [caseReference]
    );
    if (!row) {
      return res.status(404).json({ status: 'NOT_FOUND', message: 'NameMap not found for this case' });
    }
    const nameMap = JSON.parse(decrypt(row));

    res.json(await documentAgent.approveDocument(caseReference, documentType, draftText, nameMap));
  } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

module.exports = router;
