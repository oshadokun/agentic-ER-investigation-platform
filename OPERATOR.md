# ER Investigation Platform — Operator Guide

This guide is written for a first-time operator setting up the platform on a new machine.
It does not assume any prior knowledge of the codebase.

---

## 1. Prerequisites

- **Node.js 18 or later** — check with `node --version`
- **npm 9 or later** — check with `npm --version`
- An **Anthropic API key** with access to `claude-sonnet-4-6`
- A machine with internet access (for API calls only; the app itself runs locally)

---

## 2. Setup from clone to running

```bash
# 1. Clone the repository
git clone <repository-url>
cd er-investigation-platform

# 2. Install dependencies
npm install

# 3. Create the environment file (copy the example, then edit it)
cp .env.example .env
```

Open `.env` in a text editor and fill in the required values (see Section 3 below).

```bash
# 4. Start the application
npm start
```

The application will:
- Create `./data/` and `./data/er_platform.db` if they do not exist
- Apply the full schema (all tables, indexes)
- Seed default settings for notification thresholds
- Validate the encryption key — if the key is missing or malformed, startup will abort with a clear error

Open a browser and go to `http://localhost:3000`.

---

## 3. Environment variable reference

All variables are read from the `.env` file in the project root.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | — | API key from console.anthropic.com |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` | Model ID. Do not change unless instructed. |
| `PORT` | No | `3000` | HTTP port to listen on |
| `CASE_FILES_PATH` | No | `./cases` | Directory where case folders are created |
| `NODE_ENV` | No | `development` | Set to `production` on a server |
| `DATABASE_PATH` | No | `./data/er_platform.db` | Path to the SQLite database file |
| `NAMEMAP_ENCRYPTION_KEY` | **Yes** | — | 64 hex characters (256-bit AES-GCM key) |

### Generating the encryption key

Run this once and paste the output into `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This produces a 64-character hex string, for example:
```
a3f8c21e09b74d56e83a102fc8d49b1f7e562c0ad3b91e4f87a62503dce19845
```

**Keep this key safe.** If it is lost, all NameMaps (the mapping of anonymised tokens to real names) cannot be decrypted. Case documents (which use anonymised placeholders) remain readable, but the merger step — which replaces placeholders with real names in approved documents — will fail.

---

## 4. Migrating data from the legacy file-based storage

If you have case data from the previous file-based version of the platform (JSON files in `./data/` and `./cases/`), run the migration script once:

```bash
npm run migrate
```

The script reads:
- `./data/case_tracker.json` — case metadata
- `./data/case_sequence.json` — the running case number counter
- `./data/quality_trends.json` — past quality review scores
- `./cases/<CASE_REFERENCE>/00_CASE_LOG/<CASE_REFERENCE>_Case_Log.json` — per-case event logs
- `./cases/<CASE_REFERENCE>/00_CASE_LOG/<CASE_REFERENCE>_NameMap.json` — per-case name maps

**The migration is idempotent** — running it twice does not create duplicate records. You can run it safely more than once.

**Original files are not modified or deleted.** After a successful migration, verify that the data is in the database (open the app and check the Case Tracker), then keep the originals as a backup for as long as you need them. You may archive or delete them once you are confident the migration was successful.

---

## 5. Key rotation (changing the encryption key)

Rotating the encryption key requires re-encrypting all NameMaps. There is no automated rotation script — follow these steps carefully.

**Do not start the application with the new key until all NameMaps have been re-encrypted.**

### Step-by-step

1. **Back up the database** (see Section 7) before starting.

2. Open a Node.js REPL or write a one-off script:

```js
const crypto  = require('crypto');
const path    = require('path');

// Old key (current value in .env)
process.env.NAMEMAP_ENCRYPTION_KEY = '<OLD_KEY>';
process.env.DATABASE_PATH = './data/er_platform.db';

const { getDb } = require('./lib/db');
const { encrypt, decrypt } = require('./lib/encryption');

const NEW_KEY_HEX = '<NEW_KEY>';  // 64-char hex, generated as above

const db = getDb()._db;
const rows = db.prepare('SELECT case_reference, encrypted_data FROM name_maps').all();

for (const row of rows) {
  // Decrypt with old key (the module uses process.env automatically)
  const plaintext = decrypt(row.encrypted_data);
  // Re-encrypt with new key
  const re = encrypt(plaintext, Buffer.from(NEW_KEY_HEX, 'hex'));
  db.prepare('UPDATE name_maps SET encrypted_data = ? WHERE case_reference = ?')
    .run(re, row.case_reference);
}
console.log(`Re-encrypted ${rows.length} NameMap(s).`);
```

3. Once the script completes without error, update `NAMEMAP_ENCRYPTION_KEY` in `.env` to the new value.

4. Restart the application: `npm start`

5. Test decryption by opening a case and generating a merged document. If names appear correctly, the rotation was successful.

6. Destroy (do not just delete) any record of the old key.

---

## 6. Audit chain verification

The platform maintains a SHA-256 hash chain over all audit events. Each event's hash is computed from the previous event's hash plus the event's own fields, forming a tamper-evident chain.

To verify the chain at any time:

```bash
npm run verify-audit-chain
```

Output on a clean chain:
```
Audit chain verification
  Checking row 1 ...
  Checking row 2 ...
  ...
  ✓ All N event(s) verified. Chain is intact.
```

Output if tampering or a deleted row is detected:
```
  ✗ Row 5 (id=5): hash mismatch — row may have been tampered with.
  Audit chain FAILED. 1 error(s) found.
```

The command exits with code `0` on success and code `1` on failure, so it can be used in scheduled integrity checks or CI pipelines:

```bash
npm run verify-audit-chain && echo "OK" || echo "INTEGRITY FAILURE — investigate immediately"
```

**Run this regularly** — daily is recommended. A broken chain means an audit event was altered or deleted after insertion. Audit events are append-only and must never be manually modified.

---

## 7. Backup and restore

### Backup

The entire platform state lives in two locations:

1. **The SQLite database** — `./data/er_platform.db` (or whatever `DATABASE_PATH` is set to)
2. **Case file folders** — `./cases/` (or whatever `CASE_FILES_PATH` is set to) — contains generated documents (HTML, DOCX, PDF) and any uploaded files

**To back up:**

```bash
# Stop the application first (or use SQLite's backup API via the CLI below)
# SQLite hot-backup (safe while the app is running, uses WAL mode):
sqlite3 ./data/er_platform.db ".backup './data/er_platform_backup_$(date +%Y%m%d).db'"

# Case files — standard file copy
cp -r ./cases ./cases_backup_$(date +%Y%m%d)
```

Also back up the `.env` file (especially `NAMEMAP_ENCRYPTION_KEY`). Store it separately from the database backup — if both are lost together, the data cannot be recovered.

### Restore

```bash
# Stop the application
# Replace the database file
cp ./data/er_platform_backup_YYYYMMDD.db ./data/er_platform.db

# Restore case files if needed
cp -r ./cases_backup_YYYYMMDD/* ./cases/

# Restore .env (ensure NAMEMAP_ENCRYPTION_KEY matches the backup)
# Start the application
npm start
```

After restoring, run `npm run verify-audit-chain` to confirm the audit chain is intact.

---

## 8. Running the test suite

```bash
# Full test suite (all unit and integration tests, ~1-2 minutes)
npm test

# Unit tests only (excludes the migration integration test)
npm run test:unit
```

All tests use isolated temporary databases — they do not touch `./data/er_platform.db`.

Tests that require Claude API calls (quality review, full document generation) are not in the automated suite because they are slow and require a live API key. They are listed as deferred in the development notes.

---

## 9. Known limitations

| Limitation | Detail |
|---|---|
| **Single-user only** | The application is designed for one investigator on one machine. There is no authentication or multi-user isolation. |
| **Document generation blocks** | AI document generation takes 60-90 seconds and runs as an async job in-process. The UI polls for completion. Under heavy load or multiple concurrent users, jobs queue. |
| **No key rotation tooling** | Encryption key rotation requires a manual script (Section 5). There is no built-in rotation command. |
| **Audit chain is append-only** | Audit events can never be amended or deleted without breaking the chain. This is intentional; it is a feature, not a bug. |
| **SQLite — single file** | The database is a single SQLite file. It is not suitable for multi-machine deployments without a PostgreSQL migration (the DB adapter was designed to be swappable). |
| **Job queue is in-process** | The async job queue (`lib/job-queue.js`) runs inside the Node.js process. If the server restarts while a job is running, the job is lost and must be re-submitted. The queue has a documented swap point for Redis/BullMQ if persistence is needed. |
| **No email/Slack notifications** | Deadline notifications appear in the platform UI only. There is no outbound alerting integration. |
| **PDF page breaks** | The PDF converter renders text sequentially; it does not insert page breaks before section headings. Long documents may have headings at the bottom of a page. |
| **API cost** | Each document generation call to the Claude API uses tokens. On average, a full Investigation Report costs approximately $0.10-0.30 per generation at current API prices. |
| **Assisted intake accuracy** | The pre-intake anonymiser is heuristic and pattern-based. It will not catch names written in ALL CAPS, lowercase, or non-standard formats. The investigator confirmation checkbox is the mandatory final gate. |
| **Assisted intake — PDF not supported** | Assisted intake accepts pasted text, .txt, .md, and .eml files only. PDF reading is not supported in Phase 1. |

---

## 10. Assisted Intake

Assisted intake is an optional workflow that reduces manual data entry when an investigator has a referral document or email to hand.

### How it works

1. Click **+ New Case** in the top menu.
2. Click **Use Assisted Intake →** in the banner at the top of the form.
3. Paste referral text or upload a `.txt`, `.md`, or `.eml` file.
4. Click **Extract & Analyse Referral**.
5. The system performs two local steps **before any AI call**:
   - **Local extraction** — strips file format syntax (Markdown, email headers) to get clean plain text.
   - **Pre-intake anonymisation** — detects and replaces emails, phone numbers, postcodes, NI numbers, organisation names (with legal suffix), and Title Case name sequences with placeholders (`[PERSON 1]`, `[ORG 1]`, etc.).
6. If obvious PII survives replacement (e.g. a compact email address or mobile number), the request is blocked with a clear message. The investigator must edit the text before retrying.
7. The anonymised text is sent to Claude, which returns a structured JSON intake suggestion.
8. The **Review** form appears, pre-populated with suggestions. Fields are colour-coded:
   - **Yellow border** — low confidence (AI was uncertain; review carefully)
   - **Red border / "Not found"** — field could not be extracted; must be filled manually
   - **Orange border / "⚠ Possible PII"** — the AI output contained a pattern that looks like identifying information; review and remove before submitting
9. Real names (complainant, respondent) are **never extracted or pre-populated**. The investigator must enter them manually.
10. A mandatory confirmation checkbox must be checked before submission is possible. This is enforced at the code level — the POST /api/cases call cannot be reached without it.
11. Clicking **Open Case** submits through the same path as manual intake. No case is created before this point.

### Supported input formats

| Format | Notes |
|---|---|
| Pasted text | Any length up to 2 MB |
| `.txt` | Returned as-is |
| `.md` | Markdown syntax stripped; text content preserved |
| `.eml` | MIME headers stripped; text/plain body extracted; quoted-printable decoded; multipart handled |
| `.pdf` | **Not supported** — use copy/paste instead |

### Anonymisation boundary

The anonymisation boundary is the same as manual intake:

```
raw referral text
  → local extraction       (server memory only)
  → pre-intake anonymisation  (server memory only — raw text discarded after this step)
  → Claude API call (anonymised text only)
  → structured JSON suggestion
  → investigator review form
  → investigator confirms + submits
  → POST /api/cases (same path as manual intake)
```

Raw referral text is **never** written to the database, case folders, log files, or audit events.

### Failure handling

If extraction or AI structuring fails, the system always offers two options:

1. **Retry with different input** — edit the text and try again
2. **Fall back to manual intake** — opens the standard form with no pre-populated data

The investigator is never left in a dead-end state.
