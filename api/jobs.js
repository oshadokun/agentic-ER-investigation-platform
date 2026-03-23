'use strict';
const express = require('express');
const router  = express.Router();
const queue   = require('../lib/job-queue');

/**
 * GET /api/jobs/:id
 * Returns combined status + result for polling.
 *
 * Response while running:
 *   { id, type, status: 'pending'|'running', created_at, updated_at }
 *
 * Response on completion:
 *   { id, type, status: 'completed', result: <job result>, updated_at }
 *
 * Response on failure:
 *   { id, type, status: 'failed', error: <message>, updated_at }
 */
router.get('/:id', (req, res) => {
  const s = queue.status(req.params.id);
  if (!s) return res.status(404).json({ status: 'NOT_FOUND', message: `Job ${req.params.id} not found` });

  if (s.status === 'completed' || s.status === 'failed') {
    const r = queue.result(req.params.id);
    return res.json({ ...s, ...r });
  }

  res.json(s);
});

module.exports = router;
