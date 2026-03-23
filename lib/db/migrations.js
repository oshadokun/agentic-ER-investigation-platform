'use strict';
const fs   = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/**
 * Applies the schema DDL to the database.
 * All CREATE TABLE statements use IF NOT EXISTS, so this is safe to run
 * on every startup — it is a no-op when tables already exist.
 */
function runMigrations(adapter) {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  adapter.exec(schema);
}

module.exports = { runMigrations };
