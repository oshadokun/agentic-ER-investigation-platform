'use strict';
const BetterSqlite3 = require('better-sqlite3');

/**
 * SQLiteAdapter — wraps better-sqlite3 with an async interface
 * designed to be drop-in replaceable by a PostgreSQL adapter.
 *
 * Interface contract (must be preserved in the Postgres adapter):
 *   run(sql, params?)  → Promise<{ changes, lastInsertRowid }>
 *   get(sql, params?)  → Promise<row | null>
 *   all(sql, params?)  → Promise<row[]>
 *   transaction(fn)    → Promise<T>  — fn receives the adapter instance
 *
 * Transaction note (SQLite-specific):
 *   better-sqlite3 is fully synchronous. All db.run/get/all calls inside
 *   a transaction fn resolve synchronously as microtasks, so BEGIN → ops
 *   → COMMIT are guaranteed to be atomic: no other macrotask (HTTP request)
 *   can interleave between the BEGIN and COMMIT. The Postgres adapter will
 *   replace BEGIN/COMMIT with client.query() equivalents.
 */
class SQLiteAdapter {
  constructor(dbPath) {
    this._db = new BetterSqlite3(dbPath);
    this._db.pragma('journal_mode = WAL');  // concurrent reads + single write
    this._db.pragma('foreign_keys = ON');
  }

  async run(sql, params = []) {
    const info = this._db.prepare(sql).run(...params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  }

  async get(sql, params = []) {
    return this._db.prepare(sql).get(...params) ?? null;
  }

  async all(sql, params = []) {
    return this._db.prepare(sql).all(...params);
  }

  /**
   * Runs fn(db) inside an explicit BEGIN / COMMIT transaction.
   * On any error, ROLLBACK is issued and the error is re-thrown.
   * fn receives this adapter instance and may use await on its methods.
   */
  async transaction(fn) {
    this._db.exec('BEGIN');
    try {
      const result = await fn(this);
      this._db.exec('COMMIT');
      return result;
    } catch (err) {
      this._db.exec('ROLLBACK');
      throw err;
    }
  }

  exec(sql) {
    this._db.exec(sql);
  }

  close() {
    this._db.close();
  }
}

module.exports = SQLiteAdapter;
