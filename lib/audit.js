'use strict';
/**
 * lib/audit.js
 *
 * Centralized audit event recording with SHA-256 hash chaining.
 *
 * Every call to recordAuditEvent() runs inside a DB transaction that:
 *   1. Reads the row_hash of the current chain tip (or genesis hash for first row)
 *   2. Inserts the new audit_events row
 *   3. Computes row_hash = SHA-256(prev_hash | id | fields...)
 *   4. Updates the row with the computed hash
 *
 * Since better-sqlite3 is synchronous, the transaction is atomic — no other
 * write can interleave between reading the chain tip and committing the new row.
 *
 * SWAP POINT (PostgreSQL): replace the transaction body with a Postgres
 * advisory lock or SELECT FOR UPDATE on the max(id) row.
 */

const { getDb }                      = require('./db');
const { computeRowHash, GENESIS_HASH } = require('./db/migrations');

/**
 * Records an audit event and appends it to the hash chain.
 * Never throws — audit logging must not crash the main flow.
 *
 * @param {object} event
 * @param {string}  event.case_reference
 * @param {number|null} [event.document_id]
 * @param {string}  event.event_type    - e.g. 'VALIDATION_FAILED', 'DOCUMENT_APPROVED'
 * @param {object}  [event.details]     - JSON-serialisable event-specific data
 * @param {string}  [event.actor]       - 'system' | 'consultant' | username
 */
async function recordAuditEvent({ case_reference, document_id = null, event_type, details = {}, actor = 'system' }) {
  try {
    const db = getDb();

    // Atomic chain extension: read tip → insert → compute hash → update
    await db.transaction(async tx => {
      const tip = await tx.get(
        'SELECT row_hash FROM audit_events ORDER BY id DESC LIMIT 1',
        []
      );
      const prev_hash = tip && tip.row_hash ? tip.row_hash : GENESIS_HASH;

      // Insert with a placeholder row_hash so we get the AUTOINCREMENT id
      const ins = await tx.run(
        `INSERT INTO audit_events
           (case_reference, document_id, event_type, details, actor, prev_hash, row_hash)
         VALUES (?, ?, ?, ?, ?, ?, '')`,
        [
          case_reference || null,
          document_id    || null,
          event_type,
          JSON.stringify(details),
          actor,
          prev_hash,
        ]
      );

      const id  = ins.lastInsertRowid;
      const row = await tx.get('SELECT * FROM audit_events WHERE id = ?', [id]);

      const row_hash = computeRowHash({
        prev_hash,
        id:             row.id,
        case_reference: row.case_reference || '',
        document_id:    row.document_id,
        event_type:     row.event_type,
        details:        row.details || '',
        actor:          row.actor   || '',
        created_at:     row.created_at,
      });

      await tx.run('UPDATE audit_events SET row_hash = ? WHERE id = ?', [row_hash, id]);
    });
  } catch {
    // Audit logging must never crash the caller
  }
}

module.exports = { recordAuditEvent };
