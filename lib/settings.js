'use strict';
/**
 * lib/settings.js
 *
 * General-purpose key-value settings store backed by the `settings` table.
 * Default values are seeded at startup by migrations.js.
 *
 * SWAP POINT: For distributed deployments, replace getDb() calls with
 * a shared cache (Redis, etc.) to avoid per-request DB reads.
 */

const { getDb } = require('./db');

/**
 * Returns a setting value by key.
 * Returns defaultValue if the key does not exist in the DB.
 *
 * @param {string} key
 * @param {string} [defaultValue]
 * @returns {Promise<string>}
 */
async function getSetting(key, defaultValue = null) {
  const db  = getDb();
  const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : defaultValue;
}

/**
 * Sets a setting value (upsert).
 * @param {string} key
 * @param {string} value
 */
async function setSetting(key, value) {
  const db = getDb();
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, String(value)]
  );
}

/**
 * Returns all settings as a plain object { key: value }.
 * @returns {Promise<object>}
 */
async function getAllSettings() {
  const db   = getDb();
  const rows = await db.all('SELECT key, value FROM settings ORDER BY key', []);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

module.exports = { getSetting, setSetting, getAllSettings };
