'use strict';
/**
 * lib/notifications.js
 *
 * Deadline notification generation and state management.
 *
 * Thresholds are read from the `settings` table so they can be changed
 * without a code deploy:
 *   notification.upcoming_days  (default: 7)
 *   notification.overdue_days   (default: 0 — past target_date)
 *
 * Idempotency: re-running generateNotifications() will not create duplicate
 * unread notifications for the same case + type + target_date. A new
 * notification is only created if no existing unread or dismissed notification
 * already exists for that combination — i.e., only if the previous one was
 * resolved (or never existed).
 *
 * Dismissed notifications are retained. They are never deleted.
 */

const { getDb }      = require('./db');
const { getSetting } = require('./settings');

// ── Notification generation ───────────────────────────────────────────────────

/**
 * Scans all open cases and creates deadline notifications where thresholds
 * are met. Returns { created, skipped } counts.
 */
async function generateNotifications() {
  const db           = getDb();
  const upcomingDays = parseInt(await getSetting('notification.upcoming_days', '7'), 10);

  const cases = await db.all(
    `SELECT case_reference, target_date
       FROM cases
      WHERE status != 'Closed'
        AND date_closed IS NULL
        AND target_date IS NOT NULL`,
    []
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let created = 0;
  let skipped = 0;

  for (const c of cases) {
    const target    = new Date(c.target_date);
    target.setHours(0, 0, 0, 0);
    const msPerDay  = 1000 * 60 * 60 * 24;
    const daysUntil = Math.round((target - today) / msPerDay);

    if (daysUntil < 0) {
      // Overdue
      const ok = await _createIfNotExists(
        c.case_reference,
        'overdue',
        c.target_date,
        `Case ${c.case_reference} is overdue. Target date was ${c.target_date} (${Math.abs(daysUntil)} day(s) ago).`
      );
      ok ? created++ : skipped++;
    } else if (daysUntil <= upcomingDays) {
      // Upcoming within threshold
      const ok = await _createIfNotExists(
        c.case_reference,
        'upcoming_deadline',
        c.target_date,
        `Case ${c.case_reference} deadline in ${daysUntil} day(s) — target: ${c.target_date}.`
      );
      ok ? created++ : skipped++;
    }
  }

  return { created, skipped };
}

/**
 * Creates a notification only if no 'unread' notification for the same
 * case + type + target_date already exists.
 * Returns true if created, false if skipped.
 */
async function _createIfNotExists(case_reference, type, target_date, message) {
  const db       = getDb();
  const existing = await db.get(
    `SELECT id FROM notifications
      WHERE case_reference = ? AND type = ? AND target_date = ? AND state IN ('unread', 'dismissed')`,
    [case_reference, type, target_date]
  );
  if (existing) return false;

  await db.run(
    `INSERT INTO notifications (case_reference, type, message, target_date)
     VALUES (?, ?, ?, ?)`,
    [case_reference, type, message, target_date]
  );
  return true;
}

// ── Notification retrieval ────────────────────────────────────────────────────

/**
 * Returns notifications optionally filtered by state.
 * @param {string|null} [state] - 'unread'|'dismissed'|'resolved'|null (all)
 */
async function getNotifications(state = null) {
  const db = getDb();
  if (state) {
    return db.all(
      `SELECT * FROM notifications WHERE state = ? ORDER BY created_at DESC`,
      [state]
    );
  }
  return db.all('SELECT * FROM notifications ORDER BY created_at DESC', []);
}

/**
 * Returns the count of unread notifications.
 */
async function getUnreadCount() {
  const db  = getDb();
  const row = await db.get(
    "SELECT COUNT(*) as n FROM notifications WHERE state = 'unread'",
    []
  );
  return row ? row.n : 0;
}

// ── State transitions ─────────────────────────────────────────────────────────

/**
 * Updates the state of a notification.
 * Valid transitions: unread → dismissed, unread → resolved, dismissed → resolved.
 * Dismissed notifications are never deleted.
 *
 * @param {number} id
 * @param {'dismissed'|'resolved'} newState
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function updateNotificationState(id, newState) {
  const valid = ['dismissed', 'resolved'];
  if (!valid.includes(newState)) {
    return { ok: false, error: `Invalid state: ${newState}. Must be one of: ${valid.join(', ')}` };
  }
  const db  = getDb();
  const row = await db.get('SELECT state FROM notifications WHERE id = ?', [id]);
  if (!row) return { ok: false, error: `Notification ${id} not found` };
  if (row.state === 'resolved') return { ok: false, error: 'Resolved notifications cannot be changed' };

  await db.run(
    `UPDATE notifications SET state = ?, updated_at = datetime('now') WHERE id = ?`,
    [newState, id]
  );
  return { ok: true };
}

module.exports = {
  generateNotifications,
  getNotifications,
  getUnreadCount,
  updateNotificationState,
};
