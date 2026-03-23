# ER Investigation Platform

A locally-run, AI-assisted web application for Employee Relations investigators. Manages the full lifecycle of workplace investigations — from initial intake through to case closure — with Claude AI drafting initial versions of documents and the human investigator making every decision.

---

## What This Is

An ER investigator opens the application, enters the details of a new case, and the system uses the Anthropic Claude API to generate professional first-draft investigation documents. The investigator reviews every document, applies their judgment, approves it, and real names are merged back in locally before saving. The AI assists. The investigator decides.

Supported case types: Grievance, Disciplinary, Bullying & Harassment, Whistleblowing, Discrimination, Absence & Capability, AWOL, Counter-Allegation, Complex / Multi-Party.

---

## Origin and History

This platform began as a file-based MVP built to a single specification. The original design made one decision that has never changed: real names never leave the machine. Everything else has been upgraded.

The MVP used flat JSON files for all state, HTML as the only document output, no database, no encryption, no tests, and a single coordinator module that owned validation, anonymisation, classification, file I/O, and agent calling. It worked for one investigator running one case at a time on a single machine.

The current system is the result of a structured five-phase engineering upgrade pass. The upgrade preserved what was correct — the anonymisation model, the agent separation, the ER workflow focus, the human approval gates — and replaced what was weak. The flat files are gone. The NameMap is encrypted. The audit trail is hash-chained. Document output is DOCX and PDF. Every AI job is async. The database is designed so PostgreSQL can replace SQLite by changing one file.

The skills files, the case folder structure, and the core PII protection model are unchanged from the original build. They were right.

---

## Current Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express |
| Frontend | React 18 (CDN), Tailwind CSS (CDN), Babel standalone |
| AI | Anthropic Claude API (claude-sonnet-4-6) via @anthropic-ai/sdk |
| Database | SQLite via better-sqlite3 (PostgreSQL-ready abstraction) |
| Document output | DOCX (docx library), PDF (pdfkit), HTML (preview only) |
| Job execution | In-process async job queue (swap point documented in lib/job-queue.js) |

---

## Directory Structure

    er-investigation-platform/
    │
    ├── server.js
    ├── .env                               ← Never commit
    ├── .env.example
    ├── .gitignore
    ├── package.json
    │
    ├── /skills
    │   ├── SKILL_coordinator_agent.md
    │   ├── SKILL_document_agent.md
    │   ├── SKILL_quality_agent.md
    │   ├── SKILL_intake_agent.md
    │   └── SKILL_casemanagement_agent.md
    │
    ├── /agents
    │   ├── coordinator.js                 ← Orchestration only
    │   ├── intake.js                      ← Case reference; folder creation
    │   ├── document.js                    ← Generation, validation, approval, export
    │   ├── quality.js                     ← Deterministic checks + AI review
    │   └── casemanagement.js              ← Deadlines; notifications
    │
    ├── /api
    │   ├── cases.js
    │   ├── documents.js
    │   └── tracker.js
    │
    ├── /lib
    │   ├── anthropic.js                   ← Single Claude API gateway
    │   ├── anonymiser.js                  ← PII stripping
    │   ├── merger.js                      ← Post-approval name rehydration (local only)
    │   ├── encryption.js                  ← AES-256-GCM NameMap encryption
    │   ├── audit.js                       ← Hash-chained audit event writer
    │   ├── job-queue.js                   ← Async AI job abstraction
    │   ├── notifications.js               ← Deadline trigger and alert logic
    │   ├── startup.js                     ← Key validation; schema check; boot abort
    │   ├── filestore.js                   ← Case folder structure; file I/O
    │   ├── converter-docx.js              ← DOCX generation
    │   ├── converter-pdf.js               ← PDF generation via pdfkit
    │   ├── policyloader.js                ← Policy retrieval and prompt injection
    │   └── /validators
    │       ├── index.js                   ← Dispatch function
    │       ├── investigation-report.js
    │       ├── outcome-letter.js
    │       ├── invitation-letter.js
    │       └── interview-framework.js
    │
    ├── /db
    │   ├── connection.js                  ← SQLite connection; PostgreSQL-ready interface
    │   ├── schema.sql
    │   ├── migrations.js
    │   └── /repositories
    │       ├── cases.js
    │       ├── documents.js
    │       ├── users.js
    │       ├── audit.js
    │       ├── notifications.js
    │       ├── policies.js
    │       └── exports.js
    │
    ├── /scripts
    │   ├── migrate-from-files.js          ← Import legacy JSON data into DB
    │   └── verify-audit-chain.js          ← CLI audit integrity checker
    │
    ├── /tests
    │   ├── anonymiser.test.js
    │   ├── persistence.test.js
    │   ├── encryption.test.js
    │   ├── audit-chain.test.js
    │   ├── validators.test.js
    │   ├── notifications.test.js
    │   ├── export.test.js
    │   ├── migration.test.js
    │   └── document-approve.test.js
    │
    ├── /ui
    │   ├── index.html
    │   └── app.js
    │
    ├── /cases                             ← Case files (never commit)
    └── /data                              ← Legacy JSON files (preserved after migration)

---

## The PII Protection Model

This is the security centrepiece. Nothing here has changed from the original design — it was correct from the start.

1. Real names enter the intake form
2. lib/anonymiser.js builds a NameMap ([COMPLAINANT] → "Jane Smith") and strips all identifying information — names, unique roles, locations, dates — before any outbound call
3. Only anonymised data reaches the Claude API
4. The NameMap is encrypted at rest (AES-256-GCM) and stored locally in 00_CASE_LOG/[REF]_NameMap.enc
5. On approval, lib/merger.js decrypts the local NameMap and replaces placeholders with real names — entirely on the local machine
6. The final merged document is saved; real names never leave the building

If anonymisation validation fails, the outbound API call is blocked. There is no bypass.

---

## Database Schema

Eleven tables. All actions are linked to a user record even in single-user mode, so multi-user expansion requires auth and assignment work — not schema redesign.

| Table | Purpose |
|---|---|
| users | User identity and role model |
| cases | Case records and lifecycle state |
| participants | Complainants, respondents, witnesses per case |
| documents | Document records with status and recipient category |
| document_versions | Immutable version history |
| policy_templates | Versioned policy and template library |
| document_policy_injections | Audit trail of which policies informed each draft |
| audit_events | Append-only hash-chained event log |
| deadlines | Case milestones and target dates |
| notifications | Deadline alerts with state management |
| settings | General-purpose key/value configuration store |

The data access layer (db/connection.js) uses an async interface — run, get, all, transaction — that does not depend on SQLite-specific behaviour. Swapping to PostgreSQL means changing one file.

---

## Audit Integrity

Every audit event is hash-chained using SHA-256. Each row stores its own canonical content hash, the previous row's hash, and a combined hash of both. The chain starts from SHA-256("genesis"). Backfill runs idempotently at startup so no row is ever left unchained.

To verify the chain:

    npm run verify-audit-chain

Reports total events checked, first broken link if any, and exits with a non-zero code on failure so it can be used in scripts.

---

## Document Output

HTML was the original MVP output format. It was never a suitable operational deliverable. The current system produces:

- **DOCX** — first-class output, A4, serif body font, numbered sections, header (case reference + document type), footer (version + generated date), styles defined programmatically via the docx library
- **PDF** — via pdfkit (pure Node.js, no headless browser or external binary)
- **HTML** — internal preview only, not the primary deliverable

All output is versioned. Draft, reviewed, approved, and final states are tracked. Export events are logged with document ID, version, format, timestamp, acting user, and recipient category.

Recipient categories: Complainant, Respondent, Participant, Internal.

---

## Quality Review

Every document passes through two layers before it can be approved.

**Layer 1 — Deterministic checks (always runs first)**
- Required sections present
- Mandatory rights and procedural wording present
- Structure valid for document type
- Prohibited phrases absent

**Layer 2 — AI quality review (supplements, does not replace layer 1)**
- Five-stage review against the quality skill file
- Returns structured JSON — parser uses JSON.parse() only
- Invalid JSON from the model = hard review failure, surfaced to the investigator

Coverage: Investigation Reports, Outcome Letters, Invitation Letters, Interview Frameworks.

If a draft fails validation, the system retries once with the failure reason appended to the prompt. If the second attempt also fails, the draft is surfaced to the investigator with a VALIDATION_FAILED status label and requires an explicit investigator action to proceed. It cannot pass through the normal approval flow.

---

## Policy and Template Library

Policies and templates are stored in the database, versioned, and linked to document types. When a document is generated, relevant policies are retrieved and injected into the prompt. Every generation audit event records which policy record IDs and versions were used. If no policy was injected, that is also recorded explicitly.

The skill files (/skills/*.md) are the effective prompt-layer configuration. They are tracked alongside policy records and linked to generation events so there is a complete record of what instructions informed any given draft.

---

## Deadline and Notification System

Target days by complexity: Low = 28, Medium = 42, High = 70, Very High = 98.

Notification thresholds (configurable via the settings table without a code deploy):
- Upcoming: 7 days before target_date
- Overdue: past target_date

Notification states: unread, dismissed, resolved. Dismissed notifications are retained and block duplicates. Only a resolved notification allows a new alert for the same case and deadline type to be created. Unread notifications surface prominently in the UI via a bell with a live count badge.

---

## Role Model

Four roles are defined in the data model even though single-user mode operates as Investigator-only.

| Role | Access intent |
|---|---|
| Investigator | Full case access; document generation and approval |
| HR Business Partner | Case oversight |
| Legal Reviewer | Read-only access to flagged cases |
| Appeal Officer | Access to closed cases |

Multi-user expansion requires authentication and role assignment — not schema changes.

---

## Security

| Control | Implementation |
|---|---|
| NameMap encryption | AES-256-GCM; key from NAMEMAP_ENCRYPTION_KEY env var only |
| Key entropy check | App refuses to start if key is absent or below 32 bytes |
| Startup validation | lib/startup.js; server will not boot in an unsafe state |
| PII blocking | Anonymiser throws and blocks API call if real name detected in output |
| Audit tamper detection | GCM auth tag on encrypted NameMap; hash chain on audit events |
| Export blocking | Export blocked if unmerged placeholders detected in document |
| Prompt injection | Allegations sanitised before API call; system prompt includes injection resistance |
| Key rotation | npm run rotate-key re-encrypts all NameMaps from old key to new key |
| No silent fallback | All failures are surfaced explicitly — no silent fallback behaviour anywhere in the system |
| .env | Never committed; excluded by .gitignore |
| /cases | Never committed; excluded by .gitignore |

Threat model is documented in docs/THREAT_MODEL.md.

---

## Environment Variables

    ANTHROPIC_API_KEY=your-api-key-here
    ANTHROPIC_MODEL=claude-sonnet-4-6
    NAMEMAP_ENCRYPTION_KEY=your-32-byte-minimum-hex-or-base64-key
    PORT=3000
    CASE_FILES_PATH=./cases
    NODE_ENV=development

To generate a valid encryption key:

    openssl rand -hex 32

The app will not start without NAMEMAP_ENCRYPTION_KEY present and meeting the minimum entropy requirement.

---

## Setup

    git clone <repo>
    cd er-investigation-platform
    npm install
    cp .env.example .env
    # Edit .env — add ANTHROPIC_API_KEY and NAMEMAP_ENCRYPTION_KEY
    npm start

If you have existing cases from the original file-based version:

    npm run migrate

This imports all legacy case data into the database, preserves original files, and produces a migration summary. Do not delete original files until you have verified the migration summary.

---

## Available Scripts

| Script | Purpose |
|---|---|
| npm start | Start the server |
| npm test | Run all tests |
| npm run migrate | Import legacy file-based data into SQLite |
| npm run verify-audit-chain | Check audit event chain integrity |
| npm run rotate-key | Re-encrypt all NameMaps under a new key |

---

## Tests

72 tests across 9 files. All tests run without a live Claude API key.

| File | Coverage |
|---|---|
| anonymiser.test.js | PII detection; placeholder substitution; edge cases |
| persistence.test.js | DB reads/writes; FK enforcement; transaction rollback |
| encryption.test.js | Round-trips; tamper detection; key validation |
| audit-chain.test.js | Hash computation; chain continuity; tamper detection; gap detection |
| validators.test.js | All six validator modules; each failure mode |
| notifications.test.js | Generation; idempotency; state transitions; thresholds |
| export.test.js | DOCX structure; PDF headers; buffer validity; audit event logging; recipient category |
| migration.test.js | Valid import; malformed case handling; idempotency; file preservation |
| document-approve.test.js | Audit event on approval; recipient category; hash chaining |

---

## Known Limitations

- **No authentication** — single-user, localhost only. Multi-user requires an auth layer to be added.
- **In-process job queue** — jobs are lost on server restart. The swap point for Redis/BullMQ is documented in lib/job-queue.js.
- **API-dependent tests not automated** — quality review, policy injection, and end-to-end document generation tests require a live Claude API key and take 60–90 seconds each. They are not in the automated suite. A mock Claude client is the recommended next step.
- **DOCX template system** — styles are defined programmatically for now. Organisation-specific template swapping is a documented future enhancement.
- **PDF page breaks** — pdfkit renders sequentially; headings can appear at the bottom of a page. Explicit page-break logic has not been implemented.
- **No email or Slack notifications** — alerts are in-app only.
- **Per-allegation verdict validation** — the validator checks for the presence of verdicts in the report body. Strict per-allegation mapping would require structured document parsing.

---

## Future Migration Path

| Current | Future |
|---|---|
| SQLite via better-sqlite3 | PostgreSQL — change db/connection.js only |
| In-process job queue | BullMQ or pg-boss — swap lib/job-queue.js implementation |
| Single user | Multi-user — add auth layer; populate user assignments |
| localhost | Cloud deployment — Vercel or equivalent |
| No email alerts | SMTP or SendGrid integration in lib/notifications.js |

---

## Skill Files

The five files in /skills are the methodology layer. They define what every agent must do, how documents must be structured, and what quality standards apply. They are not code — they are the investigator's professional knowledge encoded as system prompts.

If anything in the codebase conflicts with a skill file, the skill file wins.

    SKILL_coordinator_agent.md     ← Case classification; escalation rules; workflow logic
    SKILL_document_agent.md        ← All document types; structure; language standards
    SKILL_quality_agent.md         ← Five-stage review; scoring; mandatory corrections
    SKILL_intake_agent.md          ← Case opening; reference numbering; folder naming
    SKILL_casemanagement_agent.md  ← Tracking; deadlines; closure

---

## Summary

This system is a local-first, investigator-controlled ER investigation platform that combines strict PII protection, structured document generation, deterministic validation, and auditable decision tracking. It is designed for real-world use by ER professionals, not as a prototype.

The architecture supports future expansion to multi-user and cloud deployment without redesign. The data model is complete. The abstraction boundaries are clean. The audit trail is legally defensible.

For operational setup, key management, and backup procedures, follow OPERATOR.md.

---

And here is the architecture map:
flowchart TD
    UI[React UI]
    API[Express API routes]
    JQ[Async job queue]

    subgraph AGENTS[Agents]
        CO[coordinator]
        IN[intake]
        DO[document]
        QU[quality]
        CM[casemanagement]
    end

    subgraph LIBS[Core libraries]
        AN[anonymiser]
        EN[encryption]
        ME[merger]
        AT[anthropic gateway]
        PL[policyloader]
        VA[validators]
        AU[audit]
        NO[notifications]
        DX[converter-docx]
        PX[converter-pdf]
    end

    subgraph DB[SQLite database]
        T1[cases]
        T2[documents]
        T3[audit-events]
        T4[notifications]
        T5[policy-templates]
        T6[deadlines]
        T7[users]
    end

    SK[Skills / system prompts]
    CL[Claude API - anonymised only]
    CF[Case files - DOCX / PDF / NameMap.enc]

    UI --> API
    API --> JQ
    JQ --> AGENTS
    AGENTS --> LIBS
    LIBS --> DB
    LIBS --> CL
    LIBS --> CF
    SK -.-> AT






The README above is one continuous block with no nested code fences — copy from the `# ER Investigation Platform` heading straight through to the end of the Summary section. The architecture map shows every layer from the browser UI down to the database, external API, and case files, with the PII boundary marked where anonymised data crosses to Claude and real names stay local.
