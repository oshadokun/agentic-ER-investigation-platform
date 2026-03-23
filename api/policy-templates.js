'use strict';
const express = require('express');
const router  = express.Router();
const { getDb } = require('../lib/db');

// GET /api/policy-templates — list all templates
router.get('/', async (req, res) => {
  try {
    const db   = getDb();
    const rows = await db.all(
      'SELECT id, name, version, document_types, active, created_at FROM policy_templates ORDER BY name, version',
      []
    );
    res.json(rows.map(r => ({ ...r, document_types: JSON.parse(r.document_types || '[]') })));
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// GET /api/policy-templates/:id — single template
router.get('/:id', async (req, res) => {
  try {
    const db  = getDb();
    const row = await db.get('SELECT * FROM policy_templates WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ status: 'NOT_FOUND' });
    res.json({ ...row, document_types: JSON.parse(row.document_types || '[]') });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// POST /api/policy-templates — create a new template
router.post('/', async (req, res) => {
  try {
    const { name, version, document_types, content, active = 1 } = req.body;
    if (!name || !version || !content) {
      return res.status(400).json({ status: 'ERROR', message: 'name, version, and content are required' });
    }
    const db     = getDb();
    const result = await db.run(
      `INSERT INTO policy_templates (name, version, document_types, content, active)
       VALUES (?, ?, ?, ?, ?)`,
      [name, version, JSON.stringify(Array.isArray(document_types) ? document_types : ['*']), content, active ? 1 : 0]
    );
    res.status(201).json({ id: result.lastInsertRowid, name, version });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ status: 'CONFLICT', message: `Template '${req.body.name}' v${req.body.version} already exists` });
    }
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// PATCH /api/policy-templates/:id — update active flag or content
router.patch('/:id', async (req, res) => {
  try {
    const db      = getDb();
    const allowed = ['active', 'content', 'document_types'];
    const updates = [];
    const params  = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        if (field === 'document_types') {
          updates.push('document_types = ?');
          params.push(JSON.stringify(Array.isArray(req.body[field]) ? req.body[field] : ['*']));
        } else if (field === 'active') {
          updates.push('active = ?');
          params.push(req.body.active ? 1 : 0);
        } else {
          updates.push(`${field} = ?`);
          params.push(req.body[field]);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'No updatable fields provided' });
    }

    params.push(req.params.id);
    await db.run(`UPDATE policy_templates SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ status: 'updated' });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

module.exports = router;
