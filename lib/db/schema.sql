-- ER Investigation Platform — Database Schema
-- SQLite implementation; DDL is intentionally PostgreSQL-compatible:
--   • TEXT for strings (VARCHAR in Postgres)
--   • INTEGER for booleans (BOOLEAN in Postgres)
--   • datetime('now') DEFAULT will be replaced by NOW() in the Postgres adapter
--   • AUTOINCREMENT ≈ SERIAL / GENERATED ALWAYS AS IDENTITY in Postgres

CREATE TABLE IF NOT EXISTS case_sequence (
  year        INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (year)
);

CREATE TABLE IF NOT EXISTS cases (
  case_reference   TEXT    NOT NULL PRIMARY KEY,
  case_type        TEXT    NOT NULL,
  complexity       TEXT    NOT NULL,
  date_opened      TEXT    NOT NULL,
  target_date      TEXT    NOT NULL,
  phase            INTEGER NOT NULL DEFAULT 1,
  status           TEXT    NOT NULL DEFAULT 'Open',
  next_action      TEXT,
  escalation_level TEXT    NOT NULL DEFAULT 'None',
  legal_involved   INTEGER NOT NULL DEFAULT 0,
  documents        TEXT    NOT NULL DEFAULT '[]',
  timeline_status  TEXT    NOT NULL DEFAULT 'On Track',
  date_closed      TEXT,
  outcomes         TEXT,
  duration_days    INTEGER,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS case_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  case_reference TEXT    NOT NULL REFERENCES cases(case_reference),
  entry_number   INTEGER NOT NULL,
  date           TEXT    NOT NULL,
  time           TEXT    NOT NULL,
  event_type     TEXT    NOT NULL,
  actor          TEXT    NOT NULL,
  details        TEXT    NOT NULL,
  status_after   TEXT    NOT NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS name_maps (
  case_reference TEXT NOT NULL PRIMARY KEY REFERENCES cases(case_reference),
  encrypted_data TEXT NOT NULL,
  iv             TEXT NOT NULL,
  auth_tag       TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quality_reviews (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  case_reference TEXT    NOT NULL REFERENCES cases(case_reference),
  document_type  TEXT    NOT NULL,
  case_type      TEXT    NOT NULL,
  complexity     TEXT    NOT NULL,
  overall_score  INTEGER NOT NULL,
  result         TEXT    NOT NULL,
  date           TEXT    NOT NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Phase 3 tables (additive — no existing columns changed) ─────────────────────

CREATE TABLE IF NOT EXISTS policy_templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  version     TEXT    NOT NULL,
  document_types TEXT NOT NULL DEFAULT '[]',  -- JSON array of applicable doc types
  content     TEXT    NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name, version)
);

-- One row per draft generated; tracks full lifecycle including validation status.
CREATE TABLE IF NOT EXISTS documents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  case_reference  TEXT    NOT NULL REFERENCES cases(case_reference),
  document_type   TEXT    NOT NULL,
  attempt         INTEGER NOT NULL DEFAULT 1,   -- 1 or 2 (reject-and-regenerate)
  status          TEXT    NOT NULL DEFAULT 'DRAFT',
  -- Possible status values:
  --   DRAFT             – generated, not yet validated
  --   VALIDATION_PASSED – passed deterministic checks
  --   VALIDATION_FAILED – failed after both generation attempts
  --   APPROVED          – investigator approved (name-merge complete)
  --   OVERRIDE          – investigator manually overrode VALIDATION_FAILED
  validation_failures TEXT,                     -- JSON array of failure strings, nullable
  quality_score   INTEGER,
  quality_result  TEXT,
  quality_json    TEXT,                         -- full JSON blob from quality agent
  html_path           TEXT,
  docx_path           TEXT,
  pdf_path            TEXT,
  recipient_category  TEXT,   -- 'Complainant'|'Respondent'|'Participant'|'Internal'
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit: exactly which policy templates were injected into each document draft.
-- A row with policy_template_id IS NULL records that NO policy was injected
-- (so every document has at least one row here for completeness).
CREATE TABLE IF NOT EXISTS document_policy_injections (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id         INTEGER NOT NULL REFERENCES documents(id),
  policy_template_id  INTEGER REFERENCES policy_templates(id),  -- NULL = none injected
  injected_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Structured audit log with SHA-256 hash chain (Phase 3 events + Phase 4 chain).
-- prev_hash: row_hash of the previous row, or SHA-256('genesis') for the first row.
-- row_hash:  SHA-256(prev_hash | id | case_reference | document_id | event_type | details | actor | created_at)
-- Both columns are set by lib/audit.js on every INSERT. A startup migration
-- backfills any rows that pre-date the hash chain (e.g. written in Phase 3).
CREATE TABLE IF NOT EXISTS audit_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  case_reference TEXT    NOT NULL,
  document_id    INTEGER REFERENCES documents(id),
  event_type     TEXT    NOT NULL,
  -- Suggested event_type values:
  --   VALIDATION_FAILED, VALIDATION_OVERRIDE, QUALITY_PARSE_ERROR,
  --   QUALITY_FAILED, DOCUMENT_APPROVED, DOCUMENT_GENERATED
  details        TEXT,   -- JSON object with event-specific data
  actor          TEXT,   -- system or investigator username
  prev_hash      TEXT,   -- hash of the previous row (genesis hash for row 1)
  row_hash       TEXT,   -- SHA-256 hash of this row's canonical fields
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Phase 4 tables ──────────────────────────────────────────────────────────────

-- General-purpose key-value settings store.
-- Named rows are the swap point for runtime configuration (no code deploys needed).
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT NOT NULL PRIMARY KEY,
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notification records. States: unread → dismissed | resolved.
-- Dismissed rows are retained (never deleted) for audit purposes.
-- Idempotency: duplicate unread notifications for the same case+type+target_date
-- are not created unless the previous one was resolved.
CREATE TABLE IF NOT EXISTS notifications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  case_reference TEXT    NOT NULL,
  type           TEXT    NOT NULL,   -- 'upcoming_deadline' | 'overdue'
  state          TEXT    NOT NULL DEFAULT 'unread',
  message        TEXT    NOT NULL,
  target_date    TEXT    NOT NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
