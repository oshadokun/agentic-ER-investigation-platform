'use strict';
/**
 * lib/policy-loader.js
 *
 * Loads active policy templates from the database for a given document type.
 * Returns the templates to inject and records the injection in audit tables.
 */

const { getDb } = require('./db');

/**
 * Returns all active policy_templates applicable to the given document type.
 * A template is applicable if its `document_types` JSON array contains
 * the documentType string, or if it contains the wildcard "*".
 *
 * @param {string} documentType
 * @returns {Promise<Array<{ id: number, name: string, version: string, content: string }>>}
 */
async function loadPoliciesForDocumentType(documentType) {
  const db   = getDb();
  const rows = await db.all(
    'SELECT id, name, version, document_types, content FROM policy_templates WHERE active = 1',
    []
  );

  return rows.filter(row => {
    let types;
    try {
      types = JSON.parse(row.document_types);
    } catch {
      return false;
    }
    return Array.isArray(types) && (types.includes('*') || types.includes(documentType));
  });
}

/**
 * Records which policy templates were injected into a document draft.
 * If no templates were injected, records a single row with policy_template_id = NULL
 * so every document has a complete audit trail.
 *
 * @param {number} documentId
 * @param {number[]} policyTemplateIds   — empty array if none injected
 */
async function recordInjections(documentId, policyTemplateIds) {
  const db = getDb();
  if (policyTemplateIds.length === 0) {
    await db.run(
      'INSERT INTO document_policy_injections (document_id, policy_template_id) VALUES (?, NULL)',
      [documentId]
    );
    return;
  }
  for (const pid of policyTemplateIds) {
    await db.run(
      'INSERT INTO document_policy_injections (document_id, policy_template_id) VALUES (?, ?)',
      [documentId, pid]
    );
  }
}

module.exports = { loadPoliciesForDocumentType, recordInjections };
