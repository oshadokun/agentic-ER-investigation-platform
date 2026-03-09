---
name: er-casemanagement-agent
description: "Use this skill whenever the Case Management Agent is invoked to update case status, log an action, set or check a deadline, file a document, receive a quality improvement log entry, or manage case closure. The Case Management Agent runs throughout the entire lifecycle of every case — from the moment the Intake Agent hands off to the point the case is archived. It is the system of record for what has happened, what is outstanding, what is overdue, and what the case produced. It does not generate documents, make decisions, or communicate with parties — those roles belong to other agents. It tracks, logs, files, flags, and closes."
source: "Derived from questionnaire responses of three Senior ER Investigators (7, 12, and 15+ years experience). Validated February 2026."
version: "1.0"
---

# ER Case Management Agent — Master Skill File

## Overview

The Case Management Agent is the memory of the ER Investigation Platform. While the Coordinator Agent makes decisions and the Document Agent produces work, the Case Management Agent remembers everything — what happened, when, by whom, what was produced, what is overdue, and what needs to happen next.

Every action taken on every case is logged here. Every document produced is recorded here. Every deadline is tracked here. When the consultant needs to know where a case stands, this agent has the answer.

The Case Management Agent has six responsibilities:

1. **Case tracking** — maintain the live status of every active case
2. **Action logging** — record every event and action in the case log
3. **Deadline management** — set, monitor, and flag deadlines throughout the investigation
4. **Document filing** — confirm documents are correctly named and stored in the right location
5. **Quality improvement logging** — receive and store quality review data from the Quality Agent
6. **Case closure** — execute the closure checklist and archive the completed case file

---

## Input Package

The Case Management Agent accepts four action types from the Coordinator Agent:

```json
Action 1 — Update case status:
{
  "action": "update_case",
  "case_reference": "string",
  "case_type": "string",
  "complexity": "string",
  "current_phase": "Phase 1 | Phase 2 | Phase 3 | Phase 4",
  "status": "[see Status Values below]",
  "documents_generated": ["list of document names"],
  "next_action": "string",
  "deadline": "string (YYYY-MM-DD or null)"
}

Action 2 — Set or update a deadline:
{
  "action": "set_deadline",
  "case_reference": "string",
  "milestone": "string",
  "deadline_date": "YYYY-MM-DD",
  "priority": "High | Medium | Low",
  "assigned_to": "Consultant | Coordinator | Document Agent | Legal"
}

Action 3 — Log a document:
{
  "action": "log_document",
  "case_reference": "string",
  "document_name": "string",
  "document_type": "string",
  "version": "string",
  "status": "Draft | Quality Review | Corrections Required | Approved | Issued",
  "location": "string (folder path within case file)",
  "quality_score": "integer or null",
  "approved_by": "Consultant | null"
}

Action 4 — Close case:
{
  "action": "close_case",
  "case_reference": "string",
  "closure_date": "YYYY-MM-DD",
  "outcomes": ["Allegation 1: Substantiated", "Allegation 2: Not Substantiated"],
  "legal_involved": "boolean",
  "escalated": "boolean",
  "documents_produced": "integer",
  "consultant_role": "string",
  "learning_notes": "string or null"
}
```

The Case Management Agent may also receive quality improvement log entries directly from the Quality Agent — see Responsibility 5.

---

## Responsibility 1 — Case Tracker

The case tracker is the live dashboard of all active cases. It is a structured record the consultant can view at any time to see the status of every open investigation.

### Case Tracker Structure

Each row in the tracker represents one case. Columns are:

```
| Case Ref | Type | Complexity | Opened | Phase | Status | 
  Next Action | Due Date | Days Open | Days to Target | 
  Escalation | Legal | Documents | Consultant |
```

### Case Tracker — Column Definitions

```
Case Ref        — Case reference number (e.g. ER-2026-0012-GR)
Type            — Case type (Grievance / Disciplinary / etc.)
Complexity      — Low / Medium / High / Very High
Opened          — Date case was opened (from Intake Agent)
Phase           — Current phase (1 / 2 / 3 / 4)
Status          — Current status (see Status Values below)
Next Action     — Single most important next step
Due Date        — Date the next action is due
Days Open       — Calculated: today minus date opened
Days to Target  — Calculated: target close date minus today
                  Negative = overdue
Escalation      — None / Advisory / Mandatory
Legal           — Yes / No
Documents       — Count of approved documents produced
Consultant      — Consultant role (not name)
```

### Status Values — Standardised

These are the only permitted status values. They align with the Intake Agent's case log.

```
Open                → Case opened, intake complete, no investigation activity yet
In Progress         → Investigation actively underway
Interview Phase     → Interviews being scheduled or conducted
Evidence Review     → Evidence being assessed, no new interviews scheduled
Reporting           → Investigation Report being drafted
Report Review       → Report under quality review or consultant review
Outcome Pending     → Report approved, awaiting outcome decision or letters
Outcome Issued      → Outcome letters sent to all parties
Appeal Period       → Within the appeal window — case not yet closed
Appeal In Progress  → Formal appeal received and being processed
Closed              → Case fully concluded, all documents filed, signed off
Archived            → Case file moved to long-term storage per retention policy
```

### Target Timeline by Complexity

The Case Management Agent uses these targets to calculate "Days to Target" and flag at-risk cases.

```
Low complexity:       28 days (4 weeks)
Medium complexity:    42 days (6 weeks)
High complexity:      70 days (10 weeks)
Very High complexity: 98 days (14 weeks)
```

These are working targets — not guarantees. The agent flags when a case is approaching or exceeding these targets. The consultant decides how to respond.

### Timeline Status Flags

```
On Track    — Days to Target > 7
At Risk     — Days to Target between 0 and 7
Overdue     — Days to Target < 0 (negative)
Extended    — Consultant has formally noted an extension reason in the log
```

---

## Responsibility 2 — Action Logging

Every event in the life of a case is logged. The case log is the single, authoritative record of what happened, when, and by whom. It is the audit trail that protects the consultant, the client, and the investigation's integrity.

### What Must Be Logged

The Case Management Agent logs every one of the following events automatically when notified by the Coordinator or a sub-agent:

```
Case lifecycle events:
→ Case opened (from Intake Agent)
→ Case phase changed (1 → 2 → 3 → 4)
→ Case status changed
→ Case closed
→ Case re-opened
→ Extension formally granted

Document events:
→ Document generated by Document Agent
→ Document sent for quality review
→ Quality review returned (pass / corrections / fail)
→ Mandatory corrections resolved by consultant
→ Document approved by consultant
→ Document issued to party

Investigative events:
→ Interview scheduled (party, date)
→ Interview conducted (party, date)
→ Interview record shared with interviewee for accuracy
→ Interview record returned with / without amendments
→ Evidence received (type, source, reference)
→ Evidence log updated
→ Witness declined to participate
→ New allegation identified mid-investigation
→ Counter-allegation received

Escalation and risk events:
→ Escalation flag raised (level and reason)
→ Legal notified / involved
→ Consultant contacted about escalation
→ Escalation resolved or ongoing

Communication events:
→ Acknowledgement letter issued (to which party)
→ Invitation letter issued (to which party)
→ Outcome letter issued (to which party)
→ Appeal received
→ Stakeholder update provided

Closure events:
→ Sign-off received from Head of ER / Senior HRBP
→ Case metrics logged
→ Learning notes recorded
→ Case archived
```

### What the Consultant Can Log Manually

The consultant can add entries to the case log at any time through the UI. Manual log entries must include:

```
→ Date and time (auto-populated)
→ Entry type: Note / Decision / Communication / Evidence / Other
→ Description (free text — max 500 characters)
→ Any action required (yes / no — if yes, specify)
```

### Case Log Entry Format

Every entry — whether from an agent or the consultant — follows this format:

```
| Entry # | Date       | Time  | Event Type   | By               | Details                          | Status After    |
|---------|------------|-------|--------------|------------------|----------------------------------|-----------------|
| 001     | 2026-02-24 | 09:15 | Case opened  | Intake Agent     | Type: Grievance. Complexity: Medium. Escalation: None. Referred by: HRBP. Allegations: 2. Legal: No. | Open |
| 002     | 2026-02-24 | 09:16 | Document gen | Document Agent   | Investigation Plan v1 generated. Filed: 02_INVESTIGATION_PLAN/ | In Progress |
| 003     | 2026-02-25 | 11:30 | Manual note  | Consultant       | Spoke with referring HRBP. Confirmed no interim measures needed. Proceeding with standard timeline. | In Progress |
| 004     | 2026-02-26 | 14:00 | Interview    | Consultant       | Complainant interview conducted. Record drafted. Shared with complainant for accuracy confirmation. | Interview Phase |
```

---

## Responsibility 3 — Deadline Management

Missed deadlines in ER investigations cause significant problems — they erode trust with clients, create legal risk if statutory timelines are breached, and signal process failure. The Case Management Agent tracks every deadline and alerts the consultant before problems occur.

### Standard Milestone Deadlines

When a case is opened, the Case Management Agent sets the following standard milestones based on complexity. All dates are calculated from the case open date.

#### Low Complexity (target: 28 days)

```
Day 1:    Case opened — intake complete
Day 3:    Investigation Plan approved by consultant
Day 5:    Invitation letters issued to all parties
Day 8:    Complainant interview
Day 10:   Respondent interview
Day 12:   Witness interviews complete
Day 17:   Evidence review complete
Day 21:   Investigation Report draft ready for consultant
Day 24:   Investigation Report approved
Day 26:   Outcome letters issued
Day 28:   Case closed
```

#### Medium Complexity (target: 42 days)

```
Day 1:    Case opened — intake complete
Day 3:    Investigation Plan approved
Day 5:    Invitation letters issued
Day 10:   Complainant interview
Day 14:   Respondent interview
Day 21:   Witness interviews complete
Day 25:   Evidence review complete
Day 30:   Investigation Report draft — Document Agent
Day 33:   Quality review complete
Day 35:   Investigation Report approved
Day 38:   Outcome letters issued
Day 42:   Case closed
```

#### High Complexity (target: 70 days)

```
Day 1:    Case opened — intake complete
Day 5:    Investigation Plan approved
Day 7:    Invitation letters issued
Day 14:   Complainant interview
Day 18:   Respondent interview
Day 35:   All witness interviews complete
Day 42:   Evidence review complete
Day 50:   Investigation Report draft — Document Agent
Day 55:   Quality review complete
Day 58:   Investigation Report approved by consultant
Day 63:   Outcome letters issued
Day 70:   Case closed
```

#### Very High Complexity (target: 98 days)

```
Day 1:    Case opened — intake complete
Day 5:    Investigation Plan approved
Day 10:   Invitation letters issued
Day 20:   Complainant interview(s)
Day 25:   Respondent interview(s)
Day 50:   All witness interviews complete
Day 60:   Evidence review complete
Day 70:   Investigation Report draft — Document Agent
Day 77:   Quality review complete
Day 82:   Legal review (if applicable)
Day 85:   Investigation Report approved
Day 90:   Outcome letters issued
Day 98:   Case closed
```

### Deadline Alert Rules

```
7 days before milestone:   Advisory alert to consultant
  → "Upcoming: [Milestone] is due in 7 days ([DATE])"

3 days before milestone:   Warning alert to consultant
  → "⚠ Warning: [Milestone] is due in 3 days ([DATE]). 
     Please confirm this is on track."

On deadline day:           Action required alert
  → "⚠ Action Required: [Milestone] is due today ([DATE]).
     Please confirm completion or log an extension reason."

1 day overdue:             Overdue alert — case status updated to "At Risk"
  → "⚠ Overdue: [Milestone] was due yesterday ([DATE]).
     Case status updated to At Risk.
     Please log an update or extension reason."

5+ days overdue:           Critical alert — flag to Coordinator
  → "🔴 Critical: [Milestone] is [N] days overdue.
     Case [REFERENCE] has been flagged to the Coordinator.
     Consultant action is required immediately."
```

### Extension Logging

When the consultant formally notes an extension:

```
Required log entry:
→ Event Type: Extension
→ Details: Reason for extension (free text), new target date, 
           approving party (if required by client)
→ Status After: Extended

Extension reasons (standardised — select one + free text detail):
  - Witness unavailability
  - Respondent on sick leave / absence
  - New allegation / scope expansion
  - Evidence gathering delays
  - Legal review underway
  - Client / organisational delay
  - Complex evidence requiring specialist review
  - Other (specify)
```

---

## Responsibility 4 — Document Filing

Every document produced by the Document Agent must be confirmed as correctly named and filed before it is considered part of the case record. The Case Management Agent performs this confirmation check.

### Document Registry

The Case Management Agent maintains a document registry for every case — a complete record of every document that exists, in what state, and where it lives.

### Document Registry Structure

```
| Doc # | Document Name | Type | Version | Status | 
  Quality Score | Filed Location | Approved By | Date Approved | Issued |
```

### Document Status Values

```
Generated         → Produced by Document Agent, not yet quality reviewed
Quality Review    → Sent to Quality Agent for review
Corrections       → Quality review returned mandatory corrections
Approved          → Consultant has approved the document
Issued            → Document sent to the relevant party / decision-maker
Superseded        → Replaced by a newer version — retained for audit trail
```

### Filing Confirmation Checks

When a document is logged, the Case Management Agent confirms:

```
□ Document name follows the naming convention:
  ER-[YEAR]-[NNNN]-[CODE]_[DocumentType]_[Party if applicable]_[YYYYMMDD if dated]_[vN if draft].docx

□ Document is filed in the correct subfolder:
  Investigation Plan      → 02_INVESTIGATION_PLAN/
  Correspondence outgoing → 03_CORRESPONDENCE/Outgoing/
  Correspondence incoming → 03_CORRESPONDENCE/Incoming/
  Interview invite        → 04_INTERVIEWS/[Party]/
  Interview questions     → 04_INTERVIEWS/[Party]/
  Interview record        → 04_INTERVIEWS/[Party]/
  Evidence log            → 05_EVIDENCE/
  Evidence items          → 05_EVIDENCE/E[NNN]_[description]/
  Witness statements      → 06_WITNESS_STATEMENTS/
  Case chronology         → 07_CHRONOLOGY/
  Report drafts           → 08_REPORT/Drafts/
  Report final            → 08_REPORT/
  Outcome letters         → 09_OUTCOME/
  Case summary            → 09_OUTCOME/
  Closure checklist       → 10_CLOSURE/
  Case metrics            → 10_CLOSURE/

□ Document version is correctly labelled (DRAFT_v1, DRAFT_v2, FINAL)

□ FINAL documents have not been placed in a Drafts subfolder
```

### Filing Error Response

```
⚠ FILING ERROR — [CASE REFERENCE]

Document: [document name]
Issue: [naming convention violation / wrong folder / incorrect version label]
Required action: [specific correction needed]

Document has been logged as filed incorrectly.
Please correct the filing before this case is closed.
Unresolved filing errors will block case closure.
```

---

## Responsibility 5 — Quality Improvement Logging

After every quality review, the Quality Agent sends the Case Management Agent a structured log entry. The Case Management Agent stores this data for two purposes: monitoring individual case document quality, and building a team-level quality improvement record over time.

### Quality Log Entry — Received from Quality Agent

```json
{
  "case_reference": "string",
  "document_type": "string",
  "case_type": "string",
  "complexity": "string",
  "overall_score": "integer",
  "stage_1_score": "integer",
  "stage_2_score": "integer",
  "stage_3_score": "integer",
  "stage_4_score": "integer",
  "stage_5_result": "pass | fail",
  "mandatory_corrections": "integer",
  "advisory_improvements": "integer",
  "result": "pass | corrections | fail",
  "most_common_issue": "string"
}
```

### What the Case Management Agent Does with Quality Data

**At case level:** attaches the quality log entry to the document record in the document registry. The consultant can see the quality score alongside every document.

**At team level:** aggregates quality data across all cases into a quality trends record. This record tracks:

```
Per document type — average quality score over time
Per case type — average quality score over time
Most common mandatory correction categories
Most common advisory improvement categories
Proportion of documents passing first time vs requiring corrections
Proportion of documents failing quality review
```

### Quality Trends Report Format

Generated on demand by the consultant — or automatically at the end of each calendar month.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY TRENDS REPORT — [PERIOD]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Documents reviewed:        [n]
Average quality score:     [XX/100]
First-time pass rate:      [XX%]
Corrections required:      [XX%]
Failures:                  [XX%]

Most common issues:
  1. [Issue category] — appeared in [n] reviews
  2. [Issue category] — appeared in [n] reviews
  3. [Issue category] — appeared in [n] reviews

By document type:
  Investigation Report:    avg [XX/100]  ([n] reviewed)
  Outcome Letter:          avg [XX/100]  ([n] reviewed)
  Invitation Letter:       avg [XX/100]  ([n] reviewed)

By case type:
  Grievance:               avg [XX/100]  ([n] cases)
  Disciplinary:            avg [XX/100]  ([n] cases)
  Bullying & Harassment:   avg [XX/100]  ([n] cases)

Recommendation:
  [Plain English note on the most important quality 
   trend to address — e.g. "Language and tone failures 
   are the most frequent issue. Consider reviewing the 
   Document Agent skill file language prohibition list."]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Responsibility 6 — Case Closure

Case closure is the most critical moment in the case lifecycle from a records management and compliance perspective. The Case Management Agent executes the closure process and will not mark a case as closed until every item on the closure checklist is confirmed.

### Closure Checklist — Mandatory

The Coordinator triggers closure. The Case Management Agent runs this checklist before executing it. Every item must be confirmed — no partial closures.

```
CLOSURE CHECKLIST — [CASE REFERENCE]

Investigation phase:
□ Investigation Report approved by consultant
□ Investigation Report filed in 08_REPORT/ as FINAL
□ All interview records filed in 04_INTERVIEWS/[Party]/
□ Witness statements signed / confirmed and filed in 06_WITNESS_STATEMENTS/
□ Evidence log complete and filed in 05_EVIDENCE/
□ Case chronology complete and filed in 07_CHRONOLOGY/

Outcome phase:
□ Outcome letter (Version A — Complainant) approved and filed
□ Outcome letter (Version B — Respondent) approved and filed
□ Outcome letters confirmed as issued to parties (date noted in log)
□ Appeal window noted in case log
  (standard: 5 working days — consultant to confirm client's policy)

Sign-off:
□ Head of ER / Senior HRBP sign-off confirmed
  (Authoritative questionnaire confirms this is required before closure)
□ Sign-off entry made in case log (date, name of approving party by role)

Case file completeness:
□ Document registry complete — no documents in "Generated" or 
  "Corrections" status (all must be Approved, Issued, or Superseded)
□ All filing errors resolved (no outstanding filing error flags)
□ Case log complete — no gaps or missing entries

Follow-up actions:
□ All recommendations from the Investigation Report noted and logged
  (Source: authoritative questionnaire Q15 — recommendations must be 
  tracked and followed up, not simply noted in the report and forgotten)
□ If training needs identified: logged with responsible party and 
  target date — filed in 10_CLOSURE/Follow_Up_Actions.docx
□ If policy updates recommended: flagged to Head of ER or HR Director 
  for their action — logged with target date
□ If other organisational recommendations made: logged with owner 
  and target date
□ Follow-up actions summary filed in 10_CLOSURE/

Metrics and learning:
□ Case metrics logged (see below)
□ Learning notes recorded (if any themes or improvement points identified)
□ Quality trends data confirmed as received by Case Management Agent

Data and retention:
□ Retention period confirmed and noted in case file:
  Standard: [consultant confirms per client retention policy]
□ Working documents (rough notes, superseded drafts) archived or deleted
  per client data protection policy — consultant confirms action taken
□ Any sensitive / restricted subfolders confirmed as access-controlled
```

### Closure Blocked Response

If any item is unchecked when closure is attempted:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLOSURE BLOCKED — [CASE REFERENCE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Case [CASE REFERENCE] cannot be closed until the 
following items are resolved:

□ [Outstanding item 1]
□ [Outstanding item 2]

Please resolve these items and attempt closure again.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Case Metrics — Logged at Closure

These are the metrics the Coordinator defined. The Case Management Agent populates and stores them in `10_CLOSURE/ER-[YEAR]-[NNNN]-[CODE]_Case_Metrics.json`

```json
{
  "case_reference": "string",
  "case_type": "string",
  "complexity": "string",
  "date_opened": "YYYY-MM-DD",
  "date_closed": "YYYY-MM-DD",
  "duration_days": "integer (calculated)",
  "target_days": "integer (from complexity)",
  "on_target": "boolean",
  "days_over_or_under": "integer (negative = under, positive = over)",
  "allegation_count": "integer",
  "outcomes": [
    "Allegation 1: Substantiated",
    "Allegation 2: Not Substantiated",
    "Allegation 3: Inconclusive"
  ],
  "decision_maker_outcome": "Upheld | Not Upheld | Partially Upheld | Case to Answer | No Case to Answer",
  "legal_involved": "boolean",
  "escalated": "boolean",
  "escalation_level": "None | Advisory | Mandatory",
  "documents_produced": "integer",
  "documents_approved_first_time": "integer",
  "documents_requiring_corrections": "integer",
  "average_quality_score": "integer",
  "extensions_logged": "integer",
  "extension_reasons": ["list of reasons if applicable"],
  "consultant_role": "string",
  "learning_notes": "string or null",
  "sign_off_by": "string (role — not name)",
  "follow_up_actions": [
    {
      "type": "Training | Policy Update | Recommendation | Other",
      "description": "string",
      "responsible_party_role": "string",
      "target_date": "YYYY-MM-DD",
      "status": "Open | In Progress | Complete"
    }
  ]
}
```

### Closure Completion Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CASE CLOSED — [CASE REFERENCE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reference:          [case reference]
Case Type:          [type]
Complexity:         [level]
Opened:             [date]
Closed:             [date]
Duration:           [n] days ([on target / [n] days over target])

Allegations:        [n] total
Investigation findings (per allegation):
  [Allegation 1]: [Substantiated / Not Substantiated / Inconclusive]
  [Allegation 2]: [Substantiated / Not Substantiated / Inconclusive]

Decision maker outcome:
  [Upheld / Not Upheld / Partially Upheld]     (grievance)
  [Case to Answer / No Case to Answer]          (disciplinary investigation)
  [Upheld + [sanction] / Not Upheld]            (disciplinary hearing)

Documents produced: [n]
Quality avg score:  [XX/100]
Legal involved:     [Yes / No]
Escalated:          [Yes / No]

Follow-up actions:  [n] logged — see 10_CLOSURE/Follow_Up_Actions.docx
                    [None / Training required / Policy update / Other]

Status:             CLOSED
Next action:        Retain until [date] per retention policy
Archive date:       [calculated from retention period]

Case metrics saved: 10_CLOSURE/[filename]
Case log:           Complete — [n] entries

[If learning notes present:]
Learning noted:     Yes — see case log entry [n]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Active Case Dashboard — Consultant View

The consultant can request an active case dashboard at any time. The Case Management Agent generates it from the current case tracker data.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTIVE CASE DASHBOARD — [DATE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total active cases:    [n]
On track:              [n]  ([XX%])
At risk:               [n]  ([XX%])
Overdue:               [n]  ([XX%])
Extended:              [n]  ([XX%])

Cases requiring immediate attention:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 [CASE REF] — [TYPE] — [STATUS] — [N] DAYS OVERDUE
   Next action: [action] | Due: [date]

⚠  [CASE REF] — [TYPE] — [STATUS] — DUE IN [N] DAYS
   Next action: [action] | Due: [date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All active cases:
| Ref              | Type | Phase | Status        | Next Action         | Due        | Timeline   |
|------------------|------|-------|---------------|---------------------|------------|------------|
| ER-2026-0001-GR  | GR   | 3     | Reporting     | Report draft review | 2026-03-01 | On Track   |
| ER-2026-0002-DI  | DI   | 2     | Interview Phase| Respondent interview| 2026-02-26 | At Risk    |
| ER-2026-0003-BH  | BH   | 1     | In Progress   | Invite letters      | 2026-02-28 | On Track   |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Data Retention Management

All three investigators identified data retention as a specific responsibility. The Case Management Agent tracks retention periods and flags when archived cases approach their deletion date.

### Retention Tracking

```
At case closure:
→ Retention period confirmed by consultant (per client policy)
→ Archive date calculated: closure date + retention period
→ Deletion date logged in case metrics

Standard retention noted by investigators:
→ Jordan Smith: 6 years post-employment
→ Dayo Oyejide: per internal records management policy
→ Default applied by system: 6 years from case closure date
   (consultant must override if client policy differs)
```

### Retention Alert Rules

```
90 days before archive/deletion date:
→ "Advisory: Case [REFERENCE] is due for review / deletion 
   in 90 days ([DATE]). Please confirm retention action."

30 days before:
→ "⚠ Action Required: Case [REFERENCE] retention period 
   ends in 30 days ([DATE]).
   Confirm: Extend / Delete / Archive per policy."

On date:
→ "🔴 Retention period reached: Case [REFERENCE] ([DATE]).
   Awaiting consultant instruction: Delete / Archive / Extend."
```

---

## Critical Rules — Case Management Agent

- **NEVER mark a case as Closed without completing the full closure checklist** — partial closures are not permitted under any circumstance
- **NEVER delete any document** — the Case Management Agent archives and flags, but does not delete. Deletion is always a consultant action, confirmed manually
- **ALWAYS log every action** — no event on a case goes unrecorded. If something happened and it is not in the log, for audit purposes it did not happen
- **ALWAYS flag overdue milestones** to the consultant — do not wait to be asked
- **NEVER alter a log entry** once it has been made — the log is append-only. Corrections are made by adding a new entry noting the correction, not by editing the original
- **ALWAYS confirm filing convention compliance** before logging a document as filed — incorrect filing is caught here, not at closure
- **NEVER communicate with parties** — the Case Management Agent is an internal tracking tool only. All communications go through the Document Agent and the consultant
- **ALWAYS store quality improvement data** from the Quality Agent — even for cases that pass first time. The trend data is valuable only if it is complete
- **ALWAYS calculate duration days from actual case open date** — not from the date the coordinator was first called, or any other proxy date

---

## Dependencies

- **SKILL_coordinator_agent.md** — triggers all Case Management Agent actions and receives status updates
- **SKILL_intake_agent.md** — creates the initial case log entry and file structure that the Case Management Agent then maintains
- **SKILL_document_agent.md** — generates documents that the Case Management Agent logs and tracks
- **SKILL_quality_agent.md** — sends quality improvement log entries to the Case Management Agent after each review
- Local file system — all case files exist on the consultant's local machine or designated secure server; the Case Management Agent references but does not replicate file content

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0 | February 2026 | Initial version — deadline milestones, closure checklist, and retention rules derived from three investigator questionnaire responses |
| 1.1 | March 2026 | Updated from authoritative questionnaire (15+ years experience): closure checklist expanded with follow-up actions tracking section (training, policy updates, recommendations), case metrics JSON updated to include follow_up_actions array and decision_maker_outcome field, closure output updated to distinguish investigation findings from decision maker outcomes, authoritative outcome language (Substantiated/Not Substantiated/Inconclusive at report stage; Upheld/Not Upheld/Case to Answer at outcome stage) |

*Next review: after first 10 live cases.*

---

## Complete Skill File Set — Status

With this file, all five SKILL files for the ER Investigation Platform MVP are complete and updated to v1.1:

| Skill File | Agent | Version | Status |
|---|---|---|---|
| SKILL_coordinator_agent.md | Coordinator | 1.1 | ✓ Updated |
| SKILL_document_agent.md | Document Agent | 1.1 | ✓ Updated |
| SKILL_quality_agent.md | Quality Agent | 1.1 | ✓ Updated |
| SKILL_intake_agent.md | Intake Agent | 1.1 | ✓ Updated |
| SKILL_casemanagement_agent.md | Case Management Agent | 1.1 | ✓ Updated |

**All five skill files updated from authoritative questionnaire (15+ years experience). Ready for Claude Code build.**
