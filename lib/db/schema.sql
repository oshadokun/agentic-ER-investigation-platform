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
