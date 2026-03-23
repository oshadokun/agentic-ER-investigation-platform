'use strict';
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const SQLiteAdapter  = require('./adapters/sqlite');
const { runMigrations } = require('./migrations');

const DB_PATH = process.env.DATABASE_PATH
  || path.join(process.cwd(), 'data', 'er_platform.db');

let _instance = null;

/**
 * Returns the singleton database adapter.
 * On first call: opens the database file, runs schema migrations, and
 * caches the instance. Safe to call from any module.
 *
 * To swap in a PostgreSQL adapter for production:
 *   - Replace SQLiteAdapter with a PostgreSQLAdapter that honours the
 *     same run/get/all/transaction interface.
 *   - Update DB_PATH / connection string logic here only.
 *   - No other module needs to change.
 */
function getDb() {
  if (_instance) return _instance;

  // Ensure the data directory exists
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  _instance = new SQLiteAdapter(DB_PATH);
  runMigrations(_instance);
  return _instance;
}

/**
 * Closes the database connection and clears the singleton.
 * Useful for graceful shutdown and in tests that need a fresh instance.
 */
function closeDb() {
  if (_instance) {
    _instance.close();
    _instance = null;
  }
}

module.exports = { getDb, closeDb };
