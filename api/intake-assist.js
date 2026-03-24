'use strict';
/**
 * api/intake-assist.js
 *
 * POST /api/intake-assist
 *
 * Assisted intake route. Accepts pasted text or client-side file content,
 * runs local extraction and pre-intake anonymisation synchronously in the
 * request handler, then enqueues a Claude structuring job.
 *
 * SECURITY CONTRACT:
 *   Raw referral text exists only for the duration of the synchronous
 *   extraction + anonymisation steps in this handler. It is NEVER:
 *     - written to the database
 *     - written to case folders
 *     - written to log files
 *     - written to audit events
 *     - passed to the job queue payload
 *   Only the anonymised text is enqueued. After the handler returns, the
 *   raw text is eligible for garbage collection.
 *
 * This route does NOT create any case record, folder, or database row.
 * Case creation happens only via POST /api/cases after the investigator
 * reviews and explicitly submits the suggestion form.
 *
 * Request body (JSON):
 *   { text: string, filename?: string }
 *   - text:     Raw content of the referral (paste or client-side file read)
 *   - filename: Original filename if uploaded; used only for format detection
 *
 * Success response:
 *   { job_id: string }
 *   → Poll GET /api/jobs/:job_id for status and result
 *
 * Error responses always include:
 *   { error: string, canRetry: boolean, fallbackToManual: boolean }
 */

const express            = require('express');
const router             = express.Router();
const { extract }        = require('../lib/extractor');
const { anonymise }      = require('../lib/pre-intake-anonymiser');
const { assistIntake }   = require('../agents/intake-assist');
const queue              = require('../lib/job-queue');

router.post('/', (req, res) => {
  const { text, filename } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      error:            'No text provided. Paste referral text or upload a supported file (.txt, .md, .eml).',
      canRetry:         true,
      fallbackToManual: true,
    });
  }

  // ── Step 1: Local text extraction ─────────────────────────────────────────
  // Synchronous, in-memory, no I/O.
  let extracted;
  try {
    extracted = extract(text, filename || '');
  } catch (err) {
    return res.status(422).json({
      error:            err.message,
      canRetry:         true,
      fallbackToManual: true,
    });
  }

  // ── Step 2: Pre-intake anonymisation ──────────────────────────────────────
  // Synchronous, in-memory, no I/O. Raw text (extracted.text) exits scope
  // after this block — only anonymisedText is kept.
  let anonymisedText, entityLog, residualPiiDetected;
  try {
    ({ anonymisedText, entityLog, residualPiiDetected } = anonymise(extracted.text));
  } catch (err) {
    return res.status(422).json({
      error:            'Anonymisation failed: ' + err.message,
      canRetry:         true,
      fallbackToManual: true,
    });
  }

  // ── Step 3: Hard block on residual PII ───────────────────────────────────
  // If patterns survived after replacement, do not proceed to Claude.
  if (residualPiiDetected) {
    return res.status(422).json({
      error:
        'Potential identifying information was detected in the text that could not be ' +
        'automatically replaced. Please review the text, remove or obscure any ' +
        'remaining names, contact details, or reference numbers, then try again.',
      canRetry:         true,
      fallbackToManual: true,
    });
  }

  // ── Step 4: Enqueue Claude structuring job ────────────────────────────────
  // ONLY anonymisedText and entityLog are passed — raw text is never queued.
  try {
    const job_id = queue.enqueue(
      'intake.assist',
      { anonymisedText, entityLog, sourceFormat: extracted.sourceFormat },
      ({ anonymisedText: aText, entityLog: eLog }) => assistIntake(aText, eLog)
    );
    return res.json({ job_id });
  } catch (err) {
    return res.status(500).json({
      error:            'Failed to queue the request. Please try again.',
      canRetry:         true,
      fallbackToManual: true,
    });
  }
});

module.exports = router;
