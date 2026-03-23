'use strict';
const express       = require('express');
const router        = express.Router();
const path          = require('path');
const fs            = require('fs-extra');
const documentAgent = require('../agents/document');
const queue         = require('../lib/job-queue');
const { getDb }     = require('../lib/db');
const { decrypt }   = require('../lib/encryption');
require('dotenv').config();

const CASE_FILES_PATH = process.env.CASE_FILES_PATH || './cases';

// ── Generate (async via job queue) ───────────────────────────────────────────

/**
 * POST /api/documents/generate
 * Enqueues a document.generate job and returns { job_id } immediately.
 * Poll GET /api/jobs/:job_id for status and result.
 */
router.post('/generate', (req, res) => {
  try {
    const { anonymisedCase, documentType, additionalContext } = req.body;
    if (!anonymisedCase || !documentType) {
      return res.status(400).json({ status: 'ERROR', message: 'anonymisedCase and documentType are required' });
    }
    const job_id = queue.enqueue(
      'document.generate',
      { anonymisedCase, documentType, additionalContext },
      ({ anonymisedCase, documentType, additionalContext }) =>
        documentAgent.generateDocument(anonymisedCase, documentType, additionalContext)
    );
    res.json({ job_id });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// ── Approve (synchronous — no AI call, name merge only) ──────────────────────

router.post('/approve', async (req, res) => {
  try {
    const { caseReference, documentType, draftText, document_id, override } = req.body;

    const db  = getDb();
    const row = await db.get(
      'SELECT encrypted_data, iv, auth_tag FROM name_maps WHERE case_reference = ?',
      [caseReference]
    );
    if (!row) {
      return res.status(404).json({ status: 'NOT_FOUND', message: 'NameMap not found for this case' });
    }
    const nameMap = JSON.parse(decrypt(row));

    res.json(await documentAgent.approveDocument(
      caseReference, documentType, draftText, nameMap,
      document_id || null,
      override === true
    ));
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// ── Download DOCX ─────────────────────────────────────────────────────────────

router.get('/download/docx/:caseReference', async (req, res) => {
  try {
    const { caseReference } = req.params;
    const { documentType }  = req.query;
    if (!documentType) {
      return res.status(400).json({ status: 'ERROR', message: 'documentType query param required' });
    }
    const db  = getDb();
    const row = await db.get(
      `SELECT docx_path FROM documents
        WHERE case_reference = ? AND document_type = ? AND status IN ('APPROVED','OVERRIDE')
        ORDER BY updated_at DESC LIMIT 1`,
      [caseReference, documentType]
    );
    if (!row || !row.docx_path) {
      return res.status(404).json({ status: 'NOT_FOUND', message: 'No approved DOCX found for this document' });
    }
    const fullPath = path.resolve(CASE_FILES_PATH, caseReference, row.docx_path);
    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({ status: 'NOT_FOUND', message: 'DOCX file not found on disk' });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`);
    res.sendFile(path.resolve(fullPath));
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// ── Download PDF ──────────────────────────────────────────────────────────────

router.get('/download/pdf/:caseReference', async (req, res) => {
  try {
    const { caseReference } = req.params;
    const { documentType }  = req.query;
    if (!documentType) {
      return res.status(400).json({ status: 'ERROR', message: 'documentType query param required' });
    }
    const db  = getDb();
    const row = await db.get(
      `SELECT pdf_path FROM documents
        WHERE case_reference = ? AND document_type = ? AND status IN ('APPROVED','OVERRIDE')
        ORDER BY updated_at DESC LIMIT 1`,
      [caseReference, documentType]
    );
    if (!row || !row.pdf_path) {
      return res.status(404).json({ status: 'NOT_FOUND', message: 'No approved PDF found for this document' });
    }
    const fullPath = path.resolve(CASE_FILES_PATH, caseReference, row.pdf_path);
    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({ status: 'NOT_FOUND', message: 'PDF file not found on disk' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`);
    res.sendFile(path.resolve(fullPath));
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

module.exports = router;
