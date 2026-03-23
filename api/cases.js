'use strict';
const express        = require('express');
const router         = express.Router();
const coordinator    = require('../agents/coordinator');
const casemanagement = require('../agents/casemanagement');
const { readLog }    = require('../lib/logger');
const queue          = require('../lib/job-queue');
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

/**
 * POST /api/cases
 * Enqueues a case.intake job and returns { job_id } immediately.
 * The job covers: validation, anonymisation, Claude classification,
 * atomic DB transaction (sequence + case + nameMap), and intake agent
 * (folder creation + Claude acknowledgement letters).
 * Poll GET /api/jobs/:job_id for status and result.
 */
router.post('/', (req, res) => {
  try {
    const job_id = queue.enqueue(
      'case.intake',
      req.body,
      (payload) => coordinator.processCase(payload)
    );
    res.json({ job_id });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

router.get('/',            async (req, res) => { try { res.json(await casemanagement.getAllCases()); } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); } });
router.get('/:ref/log',    async (req, res) => { try { res.json(await readLog(req.params.ref)); } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); } });
router.get('/:ref/data',   async (req, res) => {
  try {
    const p = path.join(process.env.CASE_FILES_PATH || './cases', req.params.ref, '00_CASE_LOG', `${req.params.ref}_CaseData.json`);
    if (!await fs.pathExists(p)) return res.status(404).json({ status: 'NOT_FOUND', message: 'Case data file not found' });
    res.json(JSON.parse(await fs.readFile(p, 'utf8')));
  } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});
router.patch('/:ref',      async (req, res) => { try { res.json(await casemanagement.updateCase(req.params.ref, req.body)); } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); } });
router.post('/:ref/close', async (req, res) => { try { res.json(await casemanagement.closeCase({ case_reference: req.params.ref, ...req.body })); } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); } });

module.exports = router;
