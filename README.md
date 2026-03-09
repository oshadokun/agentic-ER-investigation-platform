> **CLAUDE CODE INSTRUCTION:** Before writing any code, use the Read tool to read this README in full, then read all five files in `/skills/`. Do not begin building until all six files have been read. Start with: `Read README.md`, then `Read skills/SKILL_coordinator_agent.md`, `Read skills/SKILL_document_agent.md`, `Read skills/SKILL_quality_agent.md`, `Read skills/SKILL_intake_agent.md`, `Read skills/SKILL_casemanagement_agent.md`. Then proceed to Section 12.

# ER Investigation Platform — Build Instructions for Claude Code

## READ THIS ENTIRE FILE BEFORE WRITING A SINGLE LINE OF CODE

This README is your complete build specification. Every architectural decision, every file to create, every library to use, every rule to follow is in here. Read it in full, then build in the exact sequence specified in Section 12. Do not improvise. Do not skip steps. Do not add features not listed here.

---

## Section 1 — What You Are Building

You are building a **consultant-facing, locally-run web application** that helps Employee Relations (ER) investigators produce investigation documents faster, more consistently, and more securely.

A consultant opens the application in their browser, enters the details of a new ER case, and the system uses the Anthropic Claude API to generate professional first-draft investigation documents. The consultant reviews every document, applies their judgment, approves it, and the real names are merged in locally before saving.

This is a **Minimum Viable Product (MVP)**. Build only what is specified here. Nothing more.

---

## Section 2 — The Skills Folder

Before you write any code, read all five files in the `/skills` folder. They are the source of truth for everything the agents must do. Every agent you build is an implementation of its corresponding skill file.

```
/skills/SKILL_coordinator_agent.md     ← Read first. Master orchestration logic.
/skills/SKILL_document_agent.md        ← Document generation rules and structures
/skills/SKILL_quality_agent.md         ← Quality review checks and scoring
/skills/SKILL_intake_agent.md          ← Case opening, file structure, naming rules
/skills/SKILL_casemanagement_agent.md  ← Tracking, deadlines, logging, closure
```

**Rule:** If anything in this README conflicts with a SKILL file, the SKILL file wins. The SKILL files encode validated investigator methodology. This README encodes build instructions. Methodology always trumps build convenience.

---

## Section 3 — Technology Stack

Use exactly these technologies. Do not substitute alternatives.

```
Runtime:         Node.js (v18 or above)
Framework:       Express.js — API server
Frontend:        React (via CDN in a single HTML file — no build step for MVP)
Styling:         Tailwind CSS (via CDN)
AI:              Anthropic Claude API (claude-sonnet-4-6)
Documents:       docx (npm package) — for .docx file generation
File system:     Node.js fs module — no database for MVP
Case tracking:   JSON files — /data/case_tracker.json
Package manager: npm
```

### Dependencies — package.json

```json
{
  "name": "er-investigation-platform",
  "version": "1.0.0",
  "description": "ER Investigation Platform MVP",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "docx": "^8.5.0",
    "express": "^4.18.0",
    "dotenv": "^16.0.0",
    "cors": "^2.8.5",
    "uuid": "^9.0.0",
    "fs-extra": "^11.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

---

## Section 4 — API Configuration

This platform uses the **Anthropic Claude API** directly.

The `.env` file in the root folder is already present with a placeholder for the API key:

```
ANTHROPIC_API_KEY=paste-your-key-here
ANTHROPIC_MODEL=claude-sonnet-4-6
PORT=3000
CASE_FILES_PATH=./cases
NODE_ENV=development
```

**Do not recreate or overwrite the .env file.** It already exists in the root.

When building `lib/anthropic.js`, initialise the Anthropic client like this:

```javascript
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
```

The model name to use in all API calls:

```javascript
model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
```

---

## Section 5 — Environment Files

### .env — Already exists in root. DO NOT recreate or overwrite.

### .env.example — Create this (safe to commit, no real credentials)

```
# ER Investigation Platform — Environment Configuration

# Anthropic API Key
# Get from: https://console.anthropic.com/api-keys
ANTHROPIC_API_KEY=your-api-key-here

# AI Model
ANTHROPIC_MODEL=claude-sonnet-4-6

# Application Settings
PORT=3000
CASE_FILES_PATH=./cases
NODE_ENV=development
```

### .gitignore — Create this

```
.env
node_modules/
cases/
data/case_tracker.json
data/quality_trends.json
*.log
.DS_Store
Thumbs.db
```

**Critical:** `.env` and `/cases` must never be committed. The `.env` contains your API key. The `/cases` folder contains client case files.

---

## Section 6 — Complete File Structure

Build every file and folder listed here. The structure must match exactly.

```
er-investigation-platform/
│
├── .env                               ← Already exists — DO NOT MODIFY
├── README.md                          ← Already exists — DO NOT MODIFY
├── .env.example                       ← Create this
├── .gitignore                         ← Create this
├── package.json                       ← Create this
├── server.js                          ← Create this
│
├── /skills                            ← Already exists — DO NOT MODIFY
│   ├── SKILL_coordinator_agent.md
│   ├── SKILL_document_agent.md
│   ├── SKILL_quality_agent.md
│   ├── SKILL_intake_agent.md
│   └── SKILL_casemanagement_agent.md
│
├── /agents                            ← Build all five
│   ├── coordinator.js
│   ├── document.js
│   ├── quality.js
│   ├── intake.js
│   └── casemanagement.js
│
├── /api                               ← Build all three
│   ├── cases.js
│   ├── documents.js
│   └── tracker.js
│
├── /lib                               ← Build all five utilities
│   ├── anthropic.js
│   ├── anonymiser.js
│   ├── merger.js
│   ├── filestore.js
│   └── logger.js
│
├── /templates                         ← Create empty folder
│
├── /ui                                ← Build the frontend
│   ├── index.html
│   └── app.js
│
├── /data                              ← Create with seed files
│   ├── case_tracker.json
│   ├── case_sequence.json
│   └── quality_trends.json
│
└── /cases                             ← Create empty — Intake Agent populates
```

---

## Section 7 — Core Library Files

Build these five files first. Every agent depends on them. Build in the order listed.

---

### lib/anthropic.js

This is the only file that communicates with the Claude API. All other files call this one. It never receives real names — only anonymised inputs.

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

function readSkillFile(skillFileName) {
  const skillPath = path.join(__dirname, '..', 'skills', skillFileName);
  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill file not found: ${skillFileName}`);
  }
  return fs.readFileSync(skillPath, 'utf8');
}

async function callClaude(skillFileName, userMessage) {
  const systemPrompt = readSkillFile(skillFileName);

  const response = await client.messages.create({
    model:      process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 8192,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userMessage }]
  });

  return response.content[0].text;
}

module.exports = { callClaude, readSkillFile };
```

---

### lib/anonymiser.js

Strips all PII before anything goes to the API. Runs on every case without exception.

```javascript
function anonymise(caseData) {
  const nameMap = {
    '[COMPLAINANT]':           caseData.complainant_name      || '',
    '[RESPONDENT]':            caseData.respondent_name       || '',
    '[INVESTIGATING OFFICER]': caseData.investigating_officer || '',
    '[DECIDING MANAGER]':      caseData.deciding_manager      || '',
    '[HRBP]':                  caseData.hrbp_name             || '',
    '[ORGANISATION]':          caseData.organisation_name     || '',
  };

  if (caseData.witnesses && Array.isArray(caseData.witnesses)) {
    caseData.witnesses.forEach((witness, index) => {
      const label = `[WITNESS ${String.fromCharCode(65 + index)}]`;
      nameMap[label] = witness.name || '';
    });
  }

  const anonymised = {
    case_reference:      caseData.case_reference,
    case_type:           caseData.case_type,
    allegation_count:    caseData.allegations ? caseData.allegations.length : 0,
    allegations:         caseData.allegations || [],
    complainant_role:    caseData.complainant_role    || '',
    respondent_role:     caseData.respondent_role     || '',
    witness_count:       caseData.witnesses ? caseData.witnesses.length : 0,
    witness_roles:       caseData.witnesses ? caseData.witnesses.map(w => w.role || '') : [],
    incident_period:     caseData.incident_period     || '',
    case_open_date:      caseData.case_open_date      || '',
    policies_applicable: caseData.policies_applicable || [],
    evidence_types:      caseData.evidence_types      || [],
    complexity:          caseData.complexity           || 'Medium',
    escalation_required: caseData.escalation_required || false,
    legal_involved:      caseData.legal_involved       || false,
  };

  const nameValues    = Object.values(nameMap).filter(v => v.length > 0);
  const anonymisedStr = JSON.stringify(anonymised);

  for (const name of nameValues) {
    if (name.length > 2 && anonymisedStr.includes(name)) {
      throw new Error(`PII_DETECTED: Real name found in anonymised data. Review inputs before proceeding.`);
    }
  }

  return { anonymised, nameMap };
}

function anonymiseAllegations(allegations, nameMap) {
  return allegations.map(allegation => {
    let clean = allegation;
    for (const [placeholder, realValue] of Object.entries(nameMap)) {
      if (realValue && realValue.length > 2) {
        const regex = new RegExp(realValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        clean = clean.replace(regex, placeholder);
      }
    }
    return clean;
  });
}

module.exports = { anonymise, anonymiseAllegations };
```

---

### lib/merger.js

After consultant approval, replaces placeholders with real names and saves the final version.

```javascript
function mergeNames(documentText, nameMap) {
  let merged = documentText;
  for (const [placeholder, realValue] of Object.entries(nameMap)) {
    if (realValue && realValue.length > 0) {
      const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      merged = merged.replace(new RegExp(escaped, 'g'), realValue);
    }
  }
  return merged;
}

function findUnmergedPlaceholders(documentText) {
  const pattern = /\[([A-Z][A-Z\s]+[A-Z])\]/g;
  const found   = [];
  let match;
  while ((match = pattern.exec(documentText)) !== null) {
    const datePlaceholders = ['DATE', 'CASE OPEN DATE', 'DATE OF INCIDENT', 'DATE OF INTERVIEW'];
    if (!datePlaceholders.some(d => match[1].includes(d))) {
      found.push(match[0]);
    }
  }
  return [...new Set(found)];
}

module.exports = { mergeNames, findUnmergedPlaceholders };
```

---

### lib/filestore.js

Creates and manages the case file structure. Enforces the naming convention from SKILL_intake_agent.md.

```javascript
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

const BASE_PATH = process.env.CASE_FILES_PATH || './cases';

async function createCaseStructure(caseReference, caseType) {
  const folders = [
    '00_CASE_LOG',
    '01_INTAKE',
    '02_INVESTIGATION_PLAN',
    '03_CORRESPONDENCE/Outgoing',
    '03_CORRESPONDENCE/Incoming',
    '04_INTERVIEWS/Complainant',
    '04_INTERVIEWS/Respondent',
    '04_INTERVIEWS/Witnesses',
    '05_EVIDENCE',
    '06_WITNESS_STATEMENTS',
    '07_CHRONOLOGY',
    '08_REPORT/Drafts',
    '09_OUTCOME',
    '10_CLOSURE'
  ];

  const sensitiveTypes = {
    'Whistleblowing':       '05_EVIDENCE/RESTRICTED_Whistleblower_Identity',
    'Discrimination':       '05_EVIDENCE/SENSITIVE_Medical_or_Protected_Data',
    'Absence & Capability': '05_EVIDENCE/SENSITIVE_Medical_Evidence',
    'AWOL':                 '01_INTAKE/AWOL_Contact_Attempts'
  };

  if (sensitiveTypes[caseType]) folders.push(sensitiveTypes[caseType]);

  for (const folder of folders) {
    await fs.ensureDir(path.join(BASE_PATH, caseReference, folder));
  }

  return path.join(BASE_PATH, caseReference);
}

function buildFileName(caseReference, documentType, options = {}) {
  const parts = [caseReference, documentType];
  if (options.party)   parts.push(options.party);
  if (options.date)    parts.push(options.date.replace(/-/g, ''));
  if (options.version) parts.push(options.version);
  return parts.join('_') + '.' + (options.ext || 'docx');
}

async function saveDocument(caseReference, folder, fileName, content) {
  const filePath = path.join(BASE_PATH, caseReference, folder, fileName);
  await fs.ensureDir(path.dirname(filePath));
  typeof content === 'string'
    ? await fs.writeFile(filePath, content, 'utf8')
    : await fs.writeFile(filePath, content);
  return filePath;
}

async function readDocument(caseReference, folder, fileName) {
  return fs.readFile(path.join(BASE_PATH, caseReference, folder, fileName), 'utf8');
}

function getCasePath(caseReference) {
  return path.join(BASE_PATH, caseReference);
}

module.exports = { createCaseStructure, buildFileName, saveDocument, readDocument, getCasePath };
```

---

### lib/logger.js

Append-only case log. Every agent and the consultant write here. Entries are never edited.

```javascript
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

const BASE_PATH = process.env.CASE_FILES_PATH || './cases';

async function logEntry(caseReference, entry) {
  const logPath = path.join(
    BASE_PATH, caseReference, '00_CASE_LOG', `${caseReference}_Case_Log.json`
  );
  await fs.ensureDir(path.dirname(logPath));

  let log = [];
  if (await fs.pathExists(logPath)) {
    log = JSON.parse(await fs.readFile(logPath, 'utf8'));
  }

  log.push({
    entry_number: log.length + 1,
    date:         new Date().toISOString().split('T')[0],
    time:         new Date().toTimeString().split(' ')[0],
    event_type:   entry.event_type   || 'Note',
    by:           entry.by           || 'System',
    details:      entry.details      || '',
    status_after: entry.status_after || '',
  });

  await fs.writeFile(logPath, JSON.stringify(log, null, 2), 'utf8');
  return log[log.length - 1];
}

async function readLog(caseReference) {
  const logPath = path.join(
    BASE_PATH, caseReference, '00_CASE_LOG', `${caseReference}_Case_Log.json`
  );
  if (!(await fs.pathExists(logPath))) return [];
  return JSON.parse(await fs.readFile(logPath, 'utf8'));
}

module.exports = { logEntry, readLog };
```

---

## Section 8 — Agent Files

Build in this order: intake.js → casemanagement.js → quality.js → document.js → coordinator.js

---

### agents/intake.js

```javascript
const { callClaude }  = require('../lib/anthropic');
const { createCaseStructure, buildFileName, saveDocument } = require('../lib/filestore');
const { logEntry }    = require('../lib/logger');
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

const DATA_PATH = './data';

async function assignCaseReference(caseType) {
  const codes = {
    'Grievance': 'GR', 'Disciplinary': 'DI', 'Bullying & Harassment': 'BH',
    'Whistleblowing': 'WB', 'Discrimination': 'DC', 'Absence & Capability': 'AC',
    'AWOL': 'AW', 'Counter-Allegation': 'CA', 'Complex / Multi-Party': 'CM'
  };

  const seqPath = path.join(DATA_PATH, 'case_sequence.json');
  await fs.ensureDir(DATA_PATH);

  let seq = { year: new Date().getFullYear(), last: 0 };
  if (await fs.pathExists(seqPath)) seq = JSON.parse(await fs.readFile(seqPath, 'utf8'));
  if (seq.year !== new Date().getFullYear()) seq = { year: new Date().getFullYear(), last: 0 };

  seq.last += 1;
  await fs.writeFile(seqPath, JSON.stringify(seq, null, 2));

  return `ER-${seq.year}-${String(seq.last).padStart(4, '0')}-${codes[caseType] || 'XX'}`;
}

async function openCase(input) {
  const caseReference = await assignCaseReference(input.case_type);
  await createCaseStructure(caseReference, input.case_type);

  await logEntry(caseReference, {
    event_type:   'Case opened',
    by:           'Intake Agent',
    details:      `Type: ${input.case_type}. Complexity: ${input.complexity}. ` +
                  `Escalation: ${input.escalation_level}. Referred by: ${input.referring_party}. ` +
                  `Allegations: ${input.allegation_count}. Legal: ${input.legal_involved ? 'Yes' : 'No'}.`,
    status_after: 'Open'
  });

  const prompt = `
You are the Intake Agent for an ER investigation platform.
A new case has been opened:

Case Reference: ${caseReference}
Case Type: ${input.case_type}
Complexity: ${input.complexity}
Escalation Level: ${input.escalation_level}
Referring Party Role: ${input.referring_party}
Complainant Role: ${input.complainant_role}
Respondent Role: ${input.respondent_role}
Allegation Count: ${input.allegation_count}
Legal Involved: ${input.legal_involved}
Case Open Date: ${input.case_open_date}

Following your SKILL file, produce three letters:
1. Acknowledgement to referring party
2. Acknowledgement to complainant (or note if not applicable)
3. Notification to respondent (flag: requires consultant timing confirmation before sending)

Use placeholders — no real names. Apply all case type special rules.
Label each: === LETTER 1 ===, === LETTER 2 ===, === LETTER 3 ===
`;

  const letters  = await callClaude('SKILL_intake_agent.md', prompt);
  const fileName = buildFileName(caseReference, 'Acknowledgement_Letters_DRAFT', { version: 'v1' });
  await saveDocument(caseReference, '01_INTAKE', fileName, letters);

  await logEntry(caseReference, {
    event_type:   'Document generated',
    by:           'Intake Agent',
    details:      `Acknowledgement drafts saved: 01_INTAKE/${fileName}`,
    status_after: 'In Progress'
  });

  return { case_reference: caseReference, status: 'Intake complete', letters_draft: letters, letters_file: fileName };
}

module.exports = { openCase, assignCaseReference };
```

---

### agents/casemanagement.js

```javascript
const fs   = require('fs-extra');
const path = require('path');
const { logEntry } = require('../lib/logger');
require('dotenv').config();

const DATA_PATH    = './data';
const TRACKER_PATH = path.join(DATA_PATH, 'case_tracker.json');
const QUALITY_PATH = path.join(DATA_PATH, 'quality_trends.json');
const TARGET_DAYS  = { Low: 28, Medium: 42, High: 70, 'Very High': 98 };

async function getTracker() {
  await fs.ensureDir(DATA_PATH);
  if (!(await fs.pathExists(TRACKER_PATH))) return [];
  return JSON.parse(await fs.readFile(TRACKER_PATH, 'utf8'));
}

async function saveTracker(t) {
  await fs.writeFile(TRACKER_PATH, JSON.stringify(t, null, 2));
}

function calcTimeline(c) {
  const today        = new Date();
  const daysToTarget = Math.ceil((new Date(c.target_date) - today) / 86400000);
  return {
    days_open:       Math.ceil((today - new Date(c.date_opened)) / 86400000),
    days_to_target:  daysToTarget,
    timeline_status: daysToTarget > 7 ? 'On Track' : daysToTarget >= 0 ? 'At Risk' : 'Overdue'
  };
}

async function initialiseCase(input) {
  const tracker    = await getTracker();
  const openDate   = new Date();
  const targetDate = new Date(openDate);
  targetDate.setDate(targetDate.getDate() + (TARGET_DAYS[input.complexity] || 42));

  const newCase = {
    case_reference:   input.case_reference,
    case_type:        input.case_type,
    complexity:       input.complexity,
    date_opened:      openDate.toISOString().split('T')[0],
    target_date:      targetDate.toISOString().split('T')[0],
    phase:            1,
    status:           'Open',
    next_action:      'Review and approve acknowledgement letters',
    escalation_level: input.escalation_level,
    legal_involved:   input.legal_involved,
    documents:        [],
    timeline_status:  'On Track'
  };

  tracker.push(newCase);
  await saveTracker(tracker);
  return newCase;
}

async function updateCase(caseReference, updates) {
  const tracker = await getTracker();
  const idx     = tracker.findIndex(c => c.case_reference === caseReference);
  if (idx === -1) return null;
  tracker[idx] = { ...tracker[idx], ...updates, ...calcTimeline(tracker[idx]) };
  await saveTracker(tracker);
  return tracker[idx];
}

async function getAllCases() {
  const tracker = await getTracker();
  return tracker.map(c => ({ ...c, ...calcTimeline(c) }));
}

async function logQualityReview(data) {
  await fs.ensureDir(DATA_PATH);
  let trends = [];
  if (await fs.pathExists(QUALITY_PATH)) trends = JSON.parse(await fs.readFile(QUALITY_PATH, 'utf8'));
  trends.push({ ...data, date: new Date().toISOString().split('T')[0] });
  await fs.writeFile(QUALITY_PATH, JSON.stringify(trends, null, 2));
}

async function closeCase(input) {
  const tracker = await getTracker();
  const idx     = tracker.findIndex(c => c.case_reference === input.case_reference);
  if (idx === -1) return { status: 'ERROR', message: 'Case not found' };

  tracker[idx] = {
    ...tracker[idx],
    status:        'Closed',
    date_closed:   input.closure_date,
    outcomes:      input.outcomes,
    duration_days: Math.ceil((new Date(input.closure_date) - new Date(tracker[idx].date_opened)) / 86400000)
  };

  await saveTracker(tracker);

  const metricsPath = path.join(
    process.env.CASE_FILES_PATH || './cases',
    input.case_reference, '10_CLOSURE',
    `${input.case_reference}_Case_Metrics.json`
  );
  await fs.writeFile(metricsPath, JSON.stringify({ ...tracker[idx], ...input }, null, 2));

  await logEntry(input.case_reference, {
    event_type:   'Case closed',
    by:           'Case Management Agent',
    details:      `Case closed. Duration: ${tracker[idx].duration_days} days.`,
    status_after: 'Closed'
  });

  return { status: 'CLOSED', case: tracker[idx] };
}

module.exports = { initialiseCase, updateCase, getAllCases, logQualityReview, closeCase };
```

---

### agents/quality.js

```javascript
const { callClaude }  = require('../lib/anthropic');
const { logEntry }    = require('../lib/logger');
const casemanagement  = require('./casemanagement');

async function reviewDocument(input) {
  const prompt = `
You are the Quality Agent for an ER investigation platform.
Run a complete five-stage quality review following your SKILL file exactly.

Document Type: ${input.document_type}
Case Type: ${input.case_type}
Complexity: ${input.complexity}
Escalation Level: ${input.escalation_level}
Legal Involved: ${input.legal_involved}
Allegations: ${JSON.stringify(input.allegations)}
Protected Characteristics: ${JSON.stringify(input.protected_characteristics || [])}
Whistleblowing: ${input.whistleblowing || false}

Document:
---
${input.document_content}
---

Return the full quality report in the exact format from your SKILL file.
All five stage scores, all mandatory corrections, all advisory improvements, plain English summary.
`;

  const qualityReport = await callClaude('SKILL_quality_agent.md', prompt);

  const passMatch  = qualityReport.match(/OVERALL RESULT:\s*(PASS|FAIL|PASS WITH MANDATORY CORRECTIONS)/i);
  const scoreMatch = qualityReport.match(/OVERALL SCORE:\s*(\d+)/i);
  const result     = passMatch  ? passMatch[1]          : 'UNKNOWN';
  const score      = scoreMatch ? parseInt(scoreMatch[1]) : 0;

  await casemanagement.logQualityReview({
    case_reference: input.case_reference,
    document_type:  input.document_type,
    case_type:      input.case_type,
    complexity:     input.complexity,
    overall_score:  score,
    result
  });

  await logEntry(input.case_reference, {
    event_type:   'Quality review',
    by:           'Quality Agent',
    details:      `${input.document_type}: ${result} (Score: ${score}/100)`,
    status_after: result === 'PASS' ? 'Report Review' : 'Corrections Required'
  });

  return {
    case_reference:  input.case_reference,
    document_type:   input.document_type,
    overall_result:  result,
    overall_score:   score,
    quality_report:  qualityReport,
    requires_action: result !== 'PASS'
  };
}

module.exports = { reviewDocument };
```

---

### agents/document.js

```javascript
const { callClaude }  = require('../lib/anthropic');
const { logEntry }    = require('../lib/logger');
const { saveDocument, buildFileName } = require('../lib/filestore');
const { mergeNames, findUnmergedPlaceholders } = require('../lib/merger');
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

const FOLDER_MAP = {
  'Investigation Plan':   '02_INVESTIGATION_PLAN',
  'Invitation Letter':    '03_CORRESPONDENCE/Outgoing',
  'Interview Framework':  '04_INTERVIEWS',
  'Witness Statement':    '06_WITNESS_STATEMENTS',
  'Investigation Report': '08_REPORT/Drafts',
  'Outcome Letter A':     '09_OUTCOME',
  'Outcome Letter B':     '09_OUTCOME',
  'Evidence Log':         '05_EVIDENCE',
  'Case Chronology':      '07_CHRONOLOGY',
  'Case Summary':         '09_OUTCOME'
};

async function generateDocument(anonymisedCase, documentType, additionalContext = '') {
  const prompt = `
You are the Document Agent for an ER investigation platform.
Generate a complete ${documentType} following your SKILL file exactly.

Case details:
${JSON.stringify(anonymisedCase, null, 2)}
${additionalContext ? `\nAdditional context:\n${additionalContext}` : ''}

Rules:
- Placeholders only — no real names
- Exact structure from SKILL file for this document type
- Include Consultant Review Checklist at the end
- Apply all language and tone standards
- Flag escalation concerns at the top if present
`;

  const draftText  = await callClaude('SKILL_document_agent.md', prompt);
  const folder     = FOLDER_MAP[documentType] || '03_CORRESPONDENCE/Outgoing';
  const today      = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const fileName   = buildFileName(
    anonymisedCase.case_reference,
    documentType.replace(/\s/g, '_'),
    { date: today, version: 'DRAFT_v1' }
  );

  await saveDocument(anonymisedCase.case_reference, folder, fileName, draftText);
  await logEntry(anonymisedCase.case_reference, {
    event_type:   'Document generated',
    by:           'Document Agent',
    details:      `${documentType} draft: ${folder}/${fileName}`,
    status_after: 'In Progress'
  });

  const qualityRequired =
    ['Investigation Report', 'Outcome Letter A', 'Outcome Letter B'].includes(documentType) ||
    ['High', 'Very High'].includes(anonymisedCase.complexity);

  return {
    document_type:    documentType,
    draft_text:       draftText,
    file_name:        fileName,
    file_path:        `${folder}/${fileName}`,
    quality_required: qualityRequired,
    status:           'Draft — awaiting consultant review'
  };
}

async function approveDocument(caseReference, documentType, draftText, nameMap) {
  const mergedText    = mergeNames(draftText, nameMap);
  const remaining     = findUnmergedPlaceholders(mergedText);
  const today         = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const folder        = FOLDER_MAP[documentType] || '09_OUTCOME';
  const finalFileName = buildFileName(
    caseReference,
    documentType.replace(/\s/g, '_'),
    { date: today, version: 'FINAL' }
  );

  await saveDocument(caseReference, folder, finalFileName, mergedText);
  await logEntry(caseReference, {
    event_type:   'Document approved',
    by:           'Consultant',
    details:      `${documentType} FINAL saved: ${folder}/${finalFileName}`,
    status_after: 'In Progress'
  });

  return {
    status:                  'Approved',
    file_name:               finalFileName,
    file_path:               `${folder}/${finalFileName}`,
    merged_text:             mergedText,
    remaining_placeholders:  remaining,
    warning: remaining.length > 0
      ? `${remaining.length} placeholder(s) still need filling: ${remaining.join(', ')}`
      : null
  };
}

module.exports = { generateDocument, approveDocument };
```

---

### agents/coordinator.js

```javascript
const { callClaude }  = require('../lib/anthropic');
const { anonymise, anonymiseAllegations } = require('../lib/anonymiser');
const intake         = require('./intake');
const casemanagement = require('./casemanagement');
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

async function processCase(fullCaseData) {
  const required = ['case_type', 'allegations', 'complainant_role', 'respondent_role', 'incident_period', 'referring_party'];
  const missing  = required.filter(f => !fullCaseData[f]);
  if (missing.length > 0) return { status: 'VALIDATION_FAILED', missing_fields: missing, message: `Missing: ${missing.join(', ')}` };

  let anonymised, nameMap;
  try {
    ({ anonymised, nameMap } = anonymise(fullCaseData));
    anonymised.allegations = anonymiseAllegations(fullCaseData.allegations, nameMap);
  } catch (err) {
    return { status: 'PII_DETECTED', message: err.message };
  }

  const classPrompt = `
You are the Coordinator Agent for an ER investigation platform.
Analyse this case and return ONLY a JSON object with these fields:
case_type_confirmed, complexity_score (0-10), complexity_level ("Low"|"Medium"|"High"|"Very High"),
escalation_level ("None"|"Advisory"|"Mandatory"), escalation_reasons (array of strings),
timeline_weeks (integer), document_set (array of strings), legal_involvement_recommended (boolean), workflow_notes (string)

Case data:
${JSON.stringify(anonymised, null, 2)}

Return ONLY the JSON object. No other text.
`;

  const raw = await callClaude('SKILL_coordinator_agent.md', classPrompt);
  let classification;
  try {
    classification = JSON.parse(raw);
  } catch (e) {
    const m = raw.match(/\{[\s\S]+\}/);
    classification = m ? JSON.parse(m[0]) : null;
  }
  if (!classification) return { status: 'CLASSIFICATION_FAILED', message: 'Could not classify case. Please try again.' };

  const intakeResult = await intake.openCase({
    ...anonymised,
    escalation_level: classification.escalation_level,
    complexity:       classification.complexity_level,
    case_open_date:   new Date().toISOString().split('T')[0]
  });

  const caseReference = intakeResult.case_reference;

  await casemanagement.initialiseCase({
    case_reference:   caseReference,
    case_type:        anonymised.case_type,
    complexity:       classification.complexity_level,
    timeline_weeks:   classification.timeline_weeks,
    escalation_level: classification.escalation_level,
    legal_involved:   anonymised.legal_involved
  });

  // Store nameMap locally — never sent to the API
  const nameMapPath = path.join(
    process.env.CASE_FILES_PATH || './cases',
    caseReference, '00_CASE_LOG', `${caseReference}_NameMap.json`
  );
  await fs.writeFile(nameMapPath, JSON.stringify(nameMap, null, 2));

  return {
    status:             'CASE_OPENED',
    case_reference:     caseReference,
    classification,
    intake_result:      intakeResult,
    escalation_level:   classification.escalation_level,
    escalation_reasons: classification.escalation_reasons,
    workflow_plan: {
      phases: [
        { phase: 1, name: 'Case Opening',  documents: ['Investigation Plan', 'Invitation Letters'] },
        { phase: 2, name: 'Investigation', documents: ['Interview Frameworks', 'Evidence Log', 'Case Chronology'] },
        { phase: 3, name: 'Reporting',     documents: ['Investigation Report', 'Case Summary'] },
        { phase: 4, name: 'Outcome',       documents: ['Outcome Letter A', 'Outcome Letter B'] }
      ]
    },
    message: classification.escalation_level !== 'None'
      ? `⚠ Case opened with ${classification.escalation_level} escalation: ${classification.escalation_reasons.join(', ')}`
      : `Case ${caseReference} opened successfully.`
  };
}

module.exports = { processCase };
```

---

## Section 9 — API Routes and Server

### server.js

```javascript
const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'ui')));

app.use('/api/cases',     require('./api/cases'));
app.use('/api/documents', require('./api/documents'));
app.use('/api/tracker',   require('./api/tracker'));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'ui', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nER Investigation Platform → http://localhost:${PORT}`);
  console.log(`Model: ${process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'}`);
  console.log(`Case files: ${process.env.CASE_FILES_PATH || './cases'}\n`);
});
```

### api/cases.js

```javascript
const express        = require('express');
const router         = express.Router();
const coordinator    = require('../agents/coordinator');
const casemanagement = require('../agents/casemanagement');
const { readLog }    = require('../lib/logger');

router.post('/',           async (req, res) => { try { res.json(await coordinator.processCase(req.body)); } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); } });
router.get('/',            async (req, res) => { try { res.json(await casemanagement.getAllCases()); } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); } });
router.get('/:ref/log',    async (req, res) => { try { res.json(await readLog(req.params.ref)); } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); } });
router.patch('/:ref',      async (req, res) => { try { res.json(await casemanagement.updateCase(req.params.ref, req.body)); } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); } });
router.post('/:ref/close', async (req, res) => { try { res.json(await casemanagement.closeCase({ case_reference: req.params.ref, ...req.body })); } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); } });

module.exports = router;
```

### api/documents.js

```javascript
const express       = require('express');
const router        = express.Router();
const documentAgent = require('../agents/document');
const qualityAgent  = require('../agents/quality');
const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

router.post('/generate', async (req, res) => {
  try {
    const { anonymisedCase, documentType, additionalContext } = req.body;
    const result = await documentAgent.generateDocument(anonymisedCase, documentType, additionalContext);
    if (result.quality_required) {
      result.quality_review = await qualityAgent.reviewDocument({
        case_reference:   anonymisedCase.case_reference,
        document_type:    documentType,
        case_type:        anonymisedCase.case_type,
        complexity:       anonymisedCase.complexity,
        escalation_level: anonymisedCase.escalation_required ? 'Advisory' : 'None',
        legal_involved:   anonymisedCase.legal_involved,
        allegations:      anonymisedCase.allegations,
        document_content: result.draft_text
      });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

router.post('/approve', async (req, res) => {
  try {
    const { caseReference, documentType, draftText } = req.body;
    const nameMapPath = path.join(
      process.env.CASE_FILES_PATH || './cases',
      caseReference, '00_CASE_LOG', `${caseReference}_NameMap.json`
    );
    const nameMap = JSON.parse(await fs.readFile(nameMapPath, 'utf8'));
    res.json(await documentAgent.approveDocument(caseReference, documentType, draftText, nameMap));
  } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

module.exports = router;
```

### api/tracker.js

```javascript
const express        = require('express');
const router         = express.Router();
const casemanagement = require('../agents/casemanagement');

router.get('/dashboard', async (req, res) => {
  try {
    const cases = await casemanagement.getAllCases();
    res.json({
      total:    cases.length,
      on_track: cases.filter(c => c.timeline_status === 'On Track').length,
      at_risk:  cases.filter(c => c.timeline_status === 'At Risk').length,
      overdue:  cases.filter(c => c.timeline_status === 'Overdue').length,
      cases:    cases.filter(c => !['Closed', 'Archived'].includes(c.status))
    });
  } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

module.exports = router;
```

---

## Section 10 — UI

### ui/index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ER Investigation Platform</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body class="bg-gray-50 text-gray-900">
  <div id="root"></div>
  <script type="text/babel" src="app.js"></script>
</body>
</html>
```

### ui/app.js — Build these five views as a complete React single-page application:

**Dashboard** — summary counts (total / on track / at risk / overdue) then a table of all active cases with colour-coded timeline badges. Green = On Track, Amber = At Risk, Red = Overdue. Clicking a row opens the Case View.

**New Case Form** — fields: case type (dropdown of 9 types: Grievance, Disciplinary, Bullying & Harassment, Whistleblowing, Discrimination, Absence & Capability, AWOL, Counter-Allegation, Complex / Multi-Party), complainant name and role, respondent name and role, allegations (add/remove rows), witnesses (add/remove rows with name and role), incident period, referring party, applicable policies (add/remove), evidence types (checkboxes), legal involved (yes/no toggle), conflict of interest check (yes/no toggle — if yes, flag warning and block submission). Submit calls `POST /api/cases`.

**Case View** — case reference and summary at top, phase progress bar (Phase 1 through 4), escalation banner in amber or red if escalation flags are present, document list with status badges, generate document buttons for the current phase, case log at the bottom.

**Document Viewer** — full document draft text displayed for consultant review, quality report shown alongside if one was generated, Approve button calls `POST /api/documents/approve`, remaining placeholder warnings shown clearly after merge.

**Case Log** — scrollable chronological list of all case events, read-only, with a manual note entry field at the bottom.

---

## Section 11 — Data Seed Files

Create these three files in `/data`:

```
data/case_tracker.json    →  []
data/case_sequence.json   →  { "year": 2026, "last": 0 }
data/quality_trends.json  →  []
```

---

## Section 12 — Build Sequence

Build in this exact order:

```
Step 1   Read all five SKILL files in /skills completely
Step 2   Read the existing .env file — confirm ANTHROPIC_API_KEY is present
Step 3   Create package.json → run npm install
Step 4   Create .env.example and .gitignore
Step 5   Build /lib:    anthropic.js → anonymiser.js → merger.js → filestore.js → logger.js
Step 6   Create /data seed files
Step 7   Build /agents: intake.js → casemanagement.js → quality.js → document.js → coordinator.js
Step 8   Build /api:    cases.js → documents.js → tracker.js
Step 9   Build server.js
Step 10  Build /ui:     index.html → app.js
Step 11  Create empty /cases and /templates folders
Step 12  Run: npm start
Step 13  Confirm server starts and prints model name in console — no errors
Step 14  Open http://localhost:3000 — confirm UI loads
Step 15  Submit a test grievance case through the New Case form
Step 16  Confirm: case reference assigned, folder structure created, log entry made
Step 17  Confirm: document generation returns a draft
Step 18  Confirm: approval merges names and saves FINAL file correctly
```

---

## Section 13 — Security Rules

```
1.  .env is never committed — .gitignore excludes it
2.  /cases is never committed — .gitignore excludes it
3.  Real names never appear in any API call — anonymiser.js enforces this
4.  nameMap stored only in local case file — never sent to the API
5.  All API calls go through lib/anthropic.js only — no direct SDK calls elsewhere
6.  ANTHROPIC_API_KEY read only from process.env — never hardcoded anywhere
7.  Anthropic client initialised with apiKey: process.env.ANTHROPIC_API_KEY only
8.  No authentication in MVP — local only (localhost)
9.  PII detected in anonymiser → throw error and stop — never proceed to API call
10. .env already exists — do not recreate or overwrite it
```

---

## Section 14 — Future Migration (Do Not Build Now)

```
filestore.js          → Supabase Storage for multi-user file storage
case_tracker.json     → Supabase PostgreSQL table
logger.js             → Supabase database inserts
No auth (MVP)         → Supabase Auth for multi-user and SaaS
localhost:3000        → Vercel deployment for public access
```

Clean separation between data access (lib/) and business logic (agents/) means these are one-file swaps, not rebuilds.

---

## You Are Ready to Build

```
##Upgrades ongoing 
