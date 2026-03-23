'use strict';
/**
 * tests/notifications.test.js
 *
 * Tests for notification generation, idempotency, and state transitions.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const os   = require('os');
const path = require('path');
const fs   = require('fs-extra');

process.env.NAMEMAP_ENCRYPTION_KEY = 'e'.repeat(64);

function makeEnv() {
  const dbPath = path.join(os.tmpdir(), `er_notif_test_${Date.now()}.db`);
  process.env.DATABASE_PATH = dbPath;

  Object.keys(require.cache).forEach(k => {
    if (k.includes('lib/db') || k.includes('lib\\db') ||
        k.includes('lib/notifications') || k.includes('lib\\notifications') ||
        k.includes('lib/settings') || k.includes('lib\\settings')) {
      delete require.cache[k];
    }
  });

  const { getDb, closeDb }                 = require('../lib/db');
  const notifs                              = require('../lib/notifications');
  const { getSetting, setSetting }          = require('../lib/settings');

  getDb(); // open and migrate (seeds settings defaults too)

  return { dbPath, getDb, closeDb, notifs, getSetting, setSetting };
}

function cleanup(env) {
  env.closeDb();
  fs.removeSync(env.dbPath);
  Object.keys(require.cache).forEach(k => {
    if (k.includes('lib/db') || k.includes('lib\\db') ||
        k.includes('lib/notifications') || k.includes('lib\\notifications') ||
        k.includes('lib/settings') || k.includes('lib\\settings')) {
      delete require.cache[k];
    }
  });
}

function insertCase(env, ref, targetDate, status = 'Open') {
  env.getDb()._db.prepare(
    `INSERT INTO cases
       (case_reference, case_type, complexity, date_opened, target_date, status, escalation_level)
     VALUES (?, 'Grievance', 'Medium', date('now'), ?, ?, 'None')`
  ).run(ref, targetDate, status);
}

describe('Notifications — generation', () => {
  test('default settings are seeded (upcoming_days=7, overdue_days=0)', async () => {
    const env = makeEnv();
    try {
      const upcoming = await env.getSetting('notification.upcoming_days');
      const overdue  = await env.getSetting('notification.overdue_days');
      assert.equal(upcoming, '7');
      assert.equal(overdue,  '0');
    } finally {
      cleanup(env);
    }
  });

  test('overdue case generates an overdue notification', async () => {
    const env = makeEnv();
    try {
      insertCase(env, 'ER-2026-0100-GR', '2026-01-01'); // well in the past

      const { created } = await env.notifs.generateNotifications();
      assert.equal(created, 1, 'Should create 1 notification');

      const items = await env.notifs.getNotifications('unread');
      assert.equal(items.length, 1);
      assert.equal(items[0].type, 'overdue');
      assert.equal(items[0].state, 'unread');
      assert.equal(items[0].case_reference, 'ER-2026-0100-GR');
    } finally {
      cleanup(env);
    }
  });

  test('upcoming case within threshold generates an upcoming_deadline notification', async () => {
    const env = makeEnv();
    try {
      // target_date = 3 days from now (within default 7-day threshold)
      const d = new Date();
      d.setDate(d.getDate() + 3);
      const targetDate = d.toISOString().split('T')[0];

      insertCase(env, 'ER-2026-0101-DI', targetDate);

      const { created } = await env.notifs.generateNotifications();
      assert.ok(created >= 1, 'Should create at least 1 notification');

      const items = await env.notifs.getNotifications('unread');
      const upcoming = items.find(n => n.type === 'upcoming_deadline');
      assert.ok(upcoming, 'Should have an upcoming_deadline notification');
    } finally {
      cleanup(env);
    }
  });

  test('case beyond threshold does not generate a notification', async () => {
    const env = makeEnv();
    try {
      // target_date = 30 days from now (well beyond 7-day threshold)
      const d = new Date();
      d.setDate(d.getDate() + 30);
      const targetDate = d.toISOString().split('T')[0];

      insertCase(env, 'ER-2026-0102-BH', targetDate);

      const { created } = await env.notifs.generateNotifications();
      assert.equal(created, 0, 'No notification should be created for a case with 30 days remaining');
    } finally {
      cleanup(env);
    }
  });

  test('closed case does not generate a notification', async () => {
    const env = makeEnv();
    try {
      insertCase(env, 'ER-2026-0103-WB', '2026-01-01', 'Closed');

      const { created } = await env.notifs.generateNotifications();
      assert.equal(created, 0, 'Closed cases should not generate notifications');
    } finally {
      cleanup(env);
    }
  });
});

describe('Notifications — idempotency', () => {
  test('running generation twice does not create duplicate unread notifications', async () => {
    const env = makeEnv();
    try {
      insertCase(env, 'ER-2026-0110-GR', '2026-01-01'); // overdue

      await env.notifs.generateNotifications();
      await env.notifs.generateNotifications(); // second run

      const items = await env.notifs.getNotifications('unread');
      const forCase = items.filter(n => n.case_reference === 'ER-2026-0110-GR');
      assert.equal(forCase.length, 1, 'Must not create duplicate unread notifications');
    } finally {
      cleanup(env);
    }
  });

  test('resolved notification allows a new one to be created on next run', async () => {
    const env = makeEnv();
    try {
      insertCase(env, 'ER-2026-0111-DI', '2026-01-01'); // overdue

      await env.notifs.generateNotifications();
      const first = await env.notifs.getNotifications('unread');
      assert.equal(first.length, 1);

      // Resolve the notification
      await env.notifs.updateNotificationState(first[0].id, 'resolved');

      // Run again — should create a fresh notification
      const { created } = await env.notifs.generateNotifications();
      assert.equal(created, 1, 'Should create a new notification after previous one was resolved');
    } finally {
      cleanup(env);
    }
  });

  test('dismissed notification (not resolved) does not get a duplicate on re-run', async () => {
    const env = makeEnv();
    try {
      insertCase(env, 'ER-2026-0112-AC', '2026-01-01'); // overdue

      await env.notifs.generateNotifications();
      const first = await env.notifs.getNotifications('unread');
      await env.notifs.updateNotificationState(first[0].id, 'dismissed');

      // Re-run — dismissed notification still exists so no new unread is created
      const { created } = await env.notifs.generateNotifications();
      assert.equal(created, 0, 'Dismissed notification should block a new unread from being created');
    } finally {
      cleanup(env);
    }
  });
});

describe('Notifications — state transitions', () => {
  test('unread → dismissed is allowed', async () => {
    const env = makeEnv();
    try {
      insertCase(env, 'ER-2026-0120-GR', '2026-01-01');
      await env.notifs.generateNotifications();
      const items = await env.notifs.getNotifications('unread');

      const result = await env.notifs.updateNotificationState(items[0].id, 'dismissed');
      assert.ok(result.ok);

      const updated = await env.notifs.getNotifications('dismissed');
      assert.equal(updated.length, 1);
    } finally {
      cleanup(env);
    }
  });

  test('unread → resolved is allowed', async () => {
    const env = makeEnv();
    try {
      insertCase(env, 'ER-2026-0121-DI', '2026-01-01');
      await env.notifs.generateNotifications();
      const items = await env.notifs.getNotifications('unread');

      const result = await env.notifs.updateNotificationState(items[0].id, 'resolved');
      assert.ok(result.ok);

      const resolved = await env.notifs.getNotifications('resolved');
      assert.equal(resolved.length, 1);
    } finally {
      cleanup(env);
    }
  });

  test('resolved → any change is rejected', async () => {
    const env = makeEnv();
    try {
      insertCase(env, 'ER-2026-0122-BH', '2026-01-01');
      await env.notifs.generateNotifications();
      const items = await env.notifs.getNotifications('unread');
      await env.notifs.updateNotificationState(items[0].id, 'resolved');

      const result = await env.notifs.updateNotificationState(items[0].id, 'dismissed');
      assert.ok(!result.ok, 'Resolved notifications cannot be changed');
    } finally {
      cleanup(env);
    }
  });

  test('dismissed notifications are retained (not deleted)', async () => {
    const env = makeEnv();
    try {
      insertCase(env, 'ER-2026-0123-WB', '2026-01-01');
      await env.notifs.generateNotifications();
      const items = await env.notifs.getNotifications('unread');
      const id = items[0].id;

      await env.notifs.updateNotificationState(id, 'dismissed');

      const all = await env.notifs.getNotifications(null);
      const found = all.find(n => n.id === id);
      assert.ok(found, 'Dismissed notification must still exist in the DB');
      assert.equal(found.state, 'dismissed');
    } finally {
      cleanup(env);
    }
  });

  test('settings can be changed via setSetting (configurable thresholds)', async () => {
    const env = makeEnv();
    try {
      await env.setSetting('notification.upcoming_days', '14');
      const val = await env.getSetting('notification.upcoming_days');
      assert.equal(val, '14');
    } finally {
      cleanup(env);
    }
  });
});
