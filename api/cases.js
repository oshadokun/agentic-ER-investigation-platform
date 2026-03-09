const express        = require('express');
const router         = express.Router();
const coordinator    = require('../agents/coordinator');
const casemanagement = require('../agents/casemanagement');
const { readLog }    = require('../lib/logger');
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

router.post('/',           async (req, res) => { try { res.json(await coordinator.processCase(req.body)); } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); } });
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
