'use strict';
const express = require('express');
const router  = express.Router();
const {
  generateNotifications,
  getNotifications,
  getUnreadCount,
  updateNotificationState,
} = require('../lib/notifications');
const { getSetting, setSetting, getAllSettings } = require('../lib/settings');

// GET /api/notifications — list notifications (optionally filtered by state)
router.get('/', async (req, res) => {
  try {
    const { state } = req.query;
    const [items, unread] = await Promise.all([
      getNotifications(state || null),
      getUnreadCount(),
    ]);
    res.json({ unread_count: unread, notifications: items });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// POST /api/notifications/generate — trigger notification generation
router.post('/generate', async (req, res) => {
  try {
    const result = await generateNotifications();
    res.json({ status: 'OK', ...result });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// PATCH /api/notifications/:id — update state (dismiss or resolve)
router.patch('/:id', async (req, res) => {
  try {
    const { state } = req.body;
    const result    = await updateNotificationState(parseInt(req.params.id, 10), state);
    if (!result.ok) return res.status(400).json({ status: 'ERROR', message: result.error });
    res.json({ status: 'updated' });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// GET /api/notifications/settings — view notification thresholds
router.get('/settings', async (req, res) => {
  try {
    const all = await getAllSettings();
    const thresholds = Object.fromEntries(
      Object.entries(all).filter(([k]) => k.startsWith('notification.'))
    );
    res.json(thresholds);
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// PATCH /api/notifications/settings — update a threshold setting
router.patch('/settings', async (req, res) => {
  try {
    const allowed = ['notification.upcoming_days', 'notification.overdue_days'];
    const updated = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const val = parseInt(req.body[key], 10);
        if (isNaN(val) || val < 0) {
          return res.status(400).json({ status: 'ERROR', message: `${key} must be a non-negative integer` });
        }
        await setSetting(key, String(val));
        updated.push(key);
      }
    }
    if (updated.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'No recognised settings provided' });
    }
    res.json({ status: 'updated', keys: updated });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

module.exports = router;
