---
name: er-coordinator-agent
description: "This is the master orchestration skill for the ER Investigation Platform. It must be read first on every new case, before any other agent is invoked. The Coordinator Agent reads the case intake, identifies the case type and complexity, assesses risk, determines which sub-agents to activate, in what order, and with what inputs. It is the single point of control for the entire investigation workflow. Every document request, every agent call, and every escalation decision flows through the Coordinator. Do NOT invoke any sub-agent without first running the Coordinator logic defined in this skill."
source: "Derived from questionnaire responses of three Senior ER Investigators (7, 12, and 15+ years experience). Validated February 2026."
version: "1.0"
---

# ER Coordinator Agent — Master Skill File

## Overview

The Coordinator Agent is the brain of the ER Investigation Platform. It does not produce documents itself. It reads the case, makes decisions, and directs the specialist sub-agents to do the right work in the right order.

Every case that enters the system passes through the Coordinator first. No exceptions.

The Coordinator has five responsibilities:

1. **Intake validation** — confirm the case data is complete and usable before any work begins
2. **Case classification** — identify the case type, complexity level, and applicable policies
3. **Risk assessment** — identify escalation triggers and flag them before any documents are produced
4. **Workflow planning** — determine which documents are needed, in what order, and which agents produce them
5. **Handoff management** — pass the right inputs to each sub-agent and confirm outputs are returned correctly

---

## System Architecture — How the Agents Connect

```
CONSULTANT (enters case via UI)
           │
           ▼
  ┌─────────────────────┐
  │  COORDINATOR AGENT  │  ← You are here
  │  (this skill file)  │
  └──────────┬──────────┘
             │
    ┌────────┼────────┬────────────┐
    ▼        ▼        ▼            ▼
INTAKE   DOCUMENT  CASE MGMT   QUALITY
AGENT    AGENT     AGENT       AGENT
             │
    (reads SKILL_document_agent.md)
```

### Sub-Agent Skills Referenced by the Coordinator

| Agent | Skill File | What It Does |
|---|---|---|
| Intake Agent | `SKILL_intake_agent.md` | Opens case file, assigns reference, sends acknowledgements |
| Document Agent | `SKILL_document_agent.md` | Produces all investigation documents |
| Case Management Agent | `SKILL_casemanagement_agent.md` | Tracks status, deadlines, file storage |
| Quality Agent | `SKILL_quality_agent.md` | Reviews high-risk documents before consultant sees them |

---

## Step 1 — Intake Validation

Before doing anything else, the Coordinator must validate that the case data received from the consultant is complete. If any required field is missing or invalid, stop and request the missing information. Do not proceed to classification or workflow planning until all required fields are present.

### Required Fields Checklist

```
□ case_type            — must be one of the recognised types (see Section 3)
□ allegation_summary   — at least one allegation described in plain text
□ allegation_count     — integer, must match number of allegations provided
□ complainant_role     — job title / role description (NOT real name)
□ respondent_role      — job title / role description (NOT real name)
□ incident_period      — approximate date range of alleged events
□ referring_party      — who referred the case (HRBP / line manager / hotline / other)
□ policies_applicable  — at least one policy identified or marked "to be confirmed"
```

### Optional Fields (collect if available — do not block if missing)

```
○ witness_count        — number of potential witnesses
○ witness_roles        — roles of identified witnesses
○ evidence_types       — types of evidence already identified
○ legal_involved       — whether legal has already been notified
○ prior_er_history     — any relevant prior ER matters (by description, not names)
○ special_circumstances — e.g. senior leadership, cross-border, media risk
```

### Validation Response if Fields Are Missing

```
INTAKE VALIDATION INCOMPLETE

The following required information has not been provided:
[list missing fields]

Please provide this information before the case can be processed.
The system will not generate any documents until validation is complete.
```

### Step 1A — Conflict of Interest Check

**This check runs immediately after field validation, before any other step.**

Derived from authoritative investigator questionnaire (15+ years experience): the very first action when a new case is received is to assess whether there are any conflicts of interest or reasons to recuse the assigned investigator.

```
CONFLICT OF INTEREST CHECK

Ask the consultant to confirm:

□ Does the assigned investigator have a personal relationship with 
  the complainant, respondent, or any witness?

□ Has the assigned investigator previously managed, been managed by, 
  or been involved in a prior case with any party?

□ Does the assigned investigator have a financial, professional, or 
  personal interest in the outcome of this case?

□ Is the assigned investigator from the same immediate team or 
  department as any party to the investigation?

IF any box is checked:
→ FLAG to consultant: potential conflict of interest identified
→ HALT case assignment
→ Request reassignment to a different investigator before proceeding
→ Log conflict of interest flag in case log

IF no boxes are checked:
→ Proceed to Step 2
→ Log: "Conflict of interest check completed — no conflicts identified"
```

**Rule:** A case must never proceed if a genuine conflict of interest exists. The integrity of the investigation depends on the investigator's neutrality. This is non-negotiable.

---

## Step 2 — Anonymisation Check

Before any case data is passed to a sub-agent or to the API, the Coordinator must confirm that no personally identifiable information (PII) is present in the fields being processed.

### PII that must NEVER be passed to any sub-agent or the API

```
✗ Real first names or surnames of any party
✗ Employee ID numbers
✗ National Insurance numbers
✗ Specific home addresses
✗ Direct personal email addresses
✗ Any information that would identify a specific individual beyond their role
```

### What IS permitted in agent inputs

```
✓ Job titles and role descriptions ("Senior Manager, Finance")
✓ Department names ("HR Business Partner, Northern Region")
✓ Case reference numbers ("ER-2026-0042")
✓ General date ranges ("Q4 2025", "October–December 2025")
✓ Policy names ("Dignity at Work Policy", "Disciplinary Procedure")
✓ Evidence types ("email correspondence", "CCTV footage")
✓ Allegation descriptions (stripped of identifying names — use [COMPLAINANT], [RESPONDENT])
```

### If PII is detected in any input field

Flag immediately to the consultant:

```
⚠ PII DETECTED — ACTION REQUIRED

Real names or identifying information have been detected in the case inputs.
This information must be removed before the case can be processed.

The system does not pass personal data to the AI service.
Please replace names with role descriptions and resubmit.

Field(s) affected: [list fields]
```

---

## Step 3 — Case Classification

Once validation and anonymisation checks are passed, the Coordinator classifies the case. Classification determines the workflow, the document set, the timeline, and the escalation requirements.

### Case Type Definitions

Each case type has a defined primary policy area, a standard document set, and a default complexity level. All can be overridden by the complexity assessment in Step 4.

---

#### Case Type 1: Grievance

**Definition:** A formal complaint raised by an employee about their treatment, working conditions, or the actions of a colleague or manager. Includes interpersonal disputes, management style complaints, and terms and conditions issues.

**Primary policies:** Grievance Policy, Dignity at Work Policy

**Standard document set:**
```
Phase 1 — Case Opening:
  → Investigation Plan
  → Invitation Letter (Complainant)
  → Invitation Letter (Respondent)
  → Invitation Letters (Witnesses × witness_count)

Phase 2 — Investigation:
  → Interview Question Framework (Complainant)
  → Interview Question Framework (Respondent)
  → Interview Question Framework (Witness × witness_count)
  → Witness Statement Templates
  → Evidence Log
  → Case Chronology

Phase 3 — Reporting:
  → Investigation Report
  → Case Summary (management brief)

Phase 4 — Outcome:
  → Outcome Letter (Complainant — Version A)
  → Outcome Letter (Respondent — Version B)
```

**Default complexity:** Medium
**Default timeline:** 4–6 weeks

---

#### Case Type 2: Disciplinary

**Definition:** A formal process to address an employee's conduct or behaviour. The investigation establishes the facts before any disciplinary hearing takes place. The investigation report informs but does not determine the outcome of any hearing.

**Primary policies:** Disciplinary Policy, Code of Conduct

**Standard document set:**
```
Phase 1 — Case Opening:
  → Investigation Plan
  → Invitation Letter (Respondent — note: complainant may be the organisation / manager)
  → Invitation Letters (Witnesses × witness_count)

Phase 2 — Investigation:
  → Interview Question Framework (Respondent)
  → Interview Question Framework (Witness × witness_count)
  → Witness Statement Templates
  → Evidence Log
  → Case Chronology

Phase 3 — Reporting:
  → Investigation Report
  → Case Summary (management brief)

Phase 4 — Outcome:
  → Outcome Letter (Respondent)
```

**Note:** Disciplinary investigations may not have a named individual complainant. The "complainant" may be the organisation itself (e.g. suspected fraud, gross misconduct). Adjust invitation letters accordingly.

**Default complexity:** Medium
**Default timeline:** 3–5 weeks

---

#### Case Type 3: Bullying & Harassment

**Definition:** A complaint that an employee is being subjected to unwanted, intimidating, offensive, or humiliating behaviour by a colleague or manager. May involve a single incident or a pattern of behaviour over time.

**Primary policies:** Dignity at Work Policy, Harassment Policy, Equality Policy

**Standard document set:** Same as Grievance (full set — both complainant and respondent letters required)

**Additional requirements:**
- Wellbeing check language must be included in all invitation letters and interview frameworks
- Evidence log must include specific columns for dates, locations, and frequency of alleged incidents
- Interview frameworks must include specific questions about impact on the complainant

**Escalation note:** If allegations involve a protected characteristic (race, sex, disability, religion, sexual orientation, age, pregnancy, marriage/civil partnership) — auto-flag for potential discrimination. See Escalation Rules.

**Default complexity:** Medium–High
**Default timeline:** 5–8 weeks

---

#### Case Type 4: Whistleblowing / Protected Disclosure

**Definition:** A report made by a worker about wrongdoing in the organisation, where the worker has a reasonable belief that the disclosure is in the public interest. Protected under the Public Interest Disclosure Act 1998 (PIDA).

**Primary policies:** Whistleblowing Policy, Protected Disclosure Policy

**Standard document set:** Same as Grievance (full set)

**Critical additional requirements:**
```
⚠ LEGAL COMPLEXITY — HIGH

Every whistleblowing case must be flagged to the Coordinator's 
escalation protocol BEFORE any documents are generated.

Key legal obligations:
- The whistleblower must not be subjected to detriment for making the disclosure
- Confidentiality of the whistleblower's identity must be protected wherever possible
- The organisation has specific obligations to investigate qualifying disclosures
- If the disclosure relates to criminal activity, financial irregularity, 
  health & safety risk, or environmental damage — legal involvement is mandatory

All invitation letters for whistleblowing cases must OMIT the 
whistleblower's identity from any communication to the respondent.
The Document Agent must be instructed accordingly.
```

**Default complexity:** High–Very High
**Default timeline:** 8–12 weeks
**Legal involvement:** Required — flag immediately

---

#### Case Type 5: Discrimination

**Definition:** A complaint that an employee has been treated less favourably because of a protected characteristic under the Equality Act 2010. Protected characteristics: age, disability, gender reassignment, marriage/civil partnership, pregnancy/maternity, race, religion/belief, sex, sexual orientation.

**Primary policies:** Equality & Diversity Policy, Dignity at Work Policy, relevant HR policies

**Standard document set:** Same as Grievance (full set)

**Critical additional requirements:**
```
⚠ LEGAL COMPLEXITY — HIGH

Every discrimination case must be flagged for escalation.
Legal input is strongly recommended before the investigation begins.

The investigation report must:
- Identify which protected characteristic(s) are alleged to be engaged
- Consider both direct and indirect discrimination where relevant
- Consider victimisation and harassment under the Equality Act
- Not make legal determinations (that is for a tribunal) — 
  it applies the balance of probabilities to the factual allegations only

The Coordinator must pass the protected characteristic(s) 
to the Document Agent as an additional input field.
```

**Default complexity:** High
**Default timeline:** 6–10 weeks
**Legal involvement:** Strongly recommended — flag for consultant decision

---

#### Case Type 6: Absence & Capability

**Definition:** A process addressing an employee's attendance record or ability to perform their role, which may involve medical evidence, occupational health involvement, or performance management.

**Primary policies:** Absence Management Policy, Capability Policy, relevant HR policies

**Standard document set:**
```
Phase 1 — Case Opening:
  → Investigation Plan
  → Invitation Letter (Employee)

Phase 2 — Investigation:
  → Interview Question Framework (Employee)
  → Evidence Log (includes medical / OH evidence types)
  → Case Chronology (attendance record focus)

Phase 3 — Reporting:
  → Investigation Report
  → Case Summary

Phase 4 — Outcome:
  → Outcome Letter (Employee)
```

**Additional note:** Medical evidence handling requires specific data protection care. Flag to Case Management Agent that medical data is involved — access controls must be stricter.

**Default complexity:** Low–Medium
**Default timeline:** 3–6 weeks

---

#### Case Type 7: Counter-Allegation

**Definition:** A situation where the respondent in an existing investigation raises their own formal allegation against the complainant or another party during the course of the investigation.

**Coordinator decision rule:**
```
IF counter-allegation is received DURING an active investigation:
  → Assess whether it is directly related to the original allegation
  
  IF directly related (e.g. the respondent alleges the complainant fabricated the complaint):
    → Incorporate into the existing investigation scope
    → Update the Investigation Plan
    → Notify consultant — additional interview time required
    → Generate: Updated Investigation Plan, additional interview frameworks
    
  IF unrelated to original allegation:
    → Open as a separate case
    → Assign new case reference
    → Flag to consultant — two parallel cases now active
    → Generate: Separate Investigation Plan for new case
    → Note in both case files that related cases exist
```

---

#### Case Type 8: Complex / Multi-Party

**Definition:** An investigation involving three or more parties, multiple complainants or respondents, cross-departmental allegations, or significant legal / reputational risk.

**Coordinator decision rule:**
```
Auto-classify as Complex / Multi-Party if ANY of the following apply:
  → allegation_count >= 5
  → witness_count >= 6
  → More than one complainant OR more than one respondent
  → Case involves parties from more than two departments
  → special_circumstances field contains: "senior leadership", "cross-border", "media risk", "regulatory"
  → legal_involved = true at intake
```

**Additional requirements:**
- Complexity level = Very High — always
- Legal involvement = Required — flag immediately
- Timeline = 10–14 weeks minimum
- Case summary for senior management = mandatory at each phase
- Coordinator must check for conflicts of interest before assigning documents

---

#### Case Type 9: AWOL (Absent Without Leave)

**Definition:** A case where an employee has failed to attend work without authorisation, notification, or reasonable explanation. May overlap with disciplinary, capability, or wellbeing concerns depending on circumstances.

**Primary policies:** Absence Management Policy, Disciplinary Policy, relevant HR policies

**Standard document set:**
```
Phase 1 — Case Opening:
  → Investigation Plan
  → Invitation Letter (Employee — sent to last known address and work email)

Phase 2 — Investigation:
  → Interview Question Framework (Employee — if they respond and attend)
  → Evidence Log (attendance records, contact attempts, HR records)
  → Case Chronology (dates of absence, contact attempts, responses)

Phase 3 — Reporting:
  → Investigation Report
  → Case Summary

Phase 4 — Outcome:
  → Outcome Letter (Employee)
```

**Special handling rules:**
```
□ Document all contact attempts — date, method, outcome — in the case log
□ If employee does not respond: note in report as a limitation
□ Do not conclude investigation solely because employee is unreachable — 
  follow the organisation's AWOL policy on reasonable attempts and timeline
□ If AWOL continues beyond policy threshold: flag to consultant — 
  may escalate to disciplinary process
□ If medical or personal crisis is suspected: flag wellbeing concern 
  to consultant before proceeding
□ Invitation letters must be sent via multiple channels where possible:
  work email, personal email (if known), post to last known address
```

**Default complexity:** Low–Medium
**Default timeline:** 2–4 weeks (may extend if employee unreachable)
**Legal involvement:** Advisory if prolonged or if dismissal for AWOL is being considered

---

## Step 4 — Complexity Assessment

Regardless of the case type default, the Coordinator must run the following assessment to confirm or override the default complexity level.

### Complexity Scoring

Score one point for each factor present:

```
Complexity Factors:
□ allegation_count >= 3                                  (+1)
□ witness_count >= 4                                     (+1)
□ incident_period spans more than 6 months               (+1)
□ Multiple case types present (e.g. grievance + discrimination) (+1)
□ Legal involvement indicated                            (+1)
□ Senior leadership involved (Director level or above)   (+1)
□ Cross-border or multi-jurisdiction elements            (+1)
□ Prior ER history relevant to this case                 (+1)
□ Media, regulatory, or reputational risk                (+1)
□ Whistleblowing / protected disclosure elements         (+1)
□ Subject Matter Expert (SME) witnesses required         (+1)
  (e.g. IT forensics, Payroll, Security, Occupational Health)
```

### Complexity Level by Score

| Score | Complexity Level | Default Timeline | Quality Agent Review |
|---|---|---|---|
| 0–1 | Low | 3–4 weeks | Report only |
| 2–3 | Medium | 4–6 weeks | Report + Outcome letters |
| 4–5 | High | 6–10 weeks | All documents |
| 6+ | Very High | 10–14 weeks | All documents + legal flag |

---

## Step 5 — Escalation Assessment

Run this check on every case before generating any documents. If any trigger is present, the Coordinator must flag it to the consultant and pause document generation until the consultant confirms how to proceed.

### Escalation Triggers

```
MANDATORY ESCALATION (legal involvement required — do not proceed without consultant confirmation):
⚠ Case type = Whistleblowing / Protected Disclosure
⚠ Allegations involve criminal conduct (fraud, theft, assault, sexual offences)
⚠ Allegations involve a protected characteristic under the Equality Act 2010
⚠ legal_involved = true at intake
⚠ Complexity score >= 6
⚠ Senior leadership (Director / C-suite) is named as respondent

ADVISORY ESCALATION (flag to consultant — their decision whether to involve legal):
△ Complexity score = 4 or 5
△ Prior ER history shows pattern of similar complaints against respondent
△ Counter-allegations received during investigation
△ New serious allegations emerge during investigation (mid-case escalation)
△ Witness declines to participate or is non-cooperative
△ Respondent is currently on sick leave or medical absence
△ Media or external regulatory body involvement indicated
△ Parallel criminal investigation indicated
```

### Escalation Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESCALATION ASSESSMENT — [CASE REFERENCE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Level:    [MANDATORY / ADVISORY]
Trigger:  [reason]
Action:   [what the consultant must do before proceeding]

MANDATORY: Document generation is PAUSED until consultant confirms.
ADVISORY:  Document generation will proceed. Consultant is advised to 
           consider legal involvement before key documents are issued.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 6 — Workflow Planning

Once classification and escalation checks are complete, the Coordinator builds the workflow plan — the ordered list of agents to call, documents to generate, and inputs to pass.

### Workflow Plan Structure

The Coordinator outputs a workflow plan before any agent is called. The plan is shown to the consultant for confirmation before execution begins.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORKFLOW PLAN — [CASE REFERENCE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Case Type:       [CASE TYPE]
Complexity:      [LEVEL] (Score: [X]/10)
Escalation:      [None / Advisory / Mandatory]
Legal Involved:  [Yes / No / To be confirmed]
Timeline:        [X–Y weeks from today]

PHASE 1 — CASE OPENING
  Agent: Intake Agent
    → Assign case reference
    → Create case file structure
    → Log case in case tracker
  Agent: Document Agent
    → Generate: Investigation Plan
    → Generate: Invitation Letter (Complainant)
    → Generate: Invitation Letter (Respondent)
    → Generate: Invitation Letters (Witnesses × [count])

PHASE 2 — INVESTIGATION
  Agent: Document Agent
    → Generate: Interview Question Framework (Complainant)
    → Generate: Interview Question Framework (Respondent)
    → Generate: Interview Question Framework (Witness × [count])
    → Generate: Witness Statement Templates
    → Generate: Evidence Log
    → Generate: Case Chronology
  Agent: Case Management Agent
    → Set deadline reminders for each interview
    → Track evidence received vs outstanding

PHASE 3 — REPORTING
  Agent: Document Agent
    → Generate: Investigation Report
    → Generate: Case Summary
  Agent: Quality Agent  [if complexity >= Medium]
    → Review Investigation Report
    → Return quality report to consultant

PHASE 4 — OUTCOME
  Agent: Document Agent
    → Generate: Outcome Letter (Version A — Complainant)
    → Generate: Outcome Letter (Version B — Respondent)
  Agent: Quality Agent  [if complexity >= Medium]
    → Review Outcome Letters
  Agent: Case Management Agent
    → Update case status to "Outcome Pending"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Confirm workflow? [YES — proceed] [MODIFY — adjust plan]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 7 — Agent Handoff Protocol

When calling each sub-agent, the Coordinator must pass the correct input package. This section defines exactly what is passed to each agent.

### Handoff to Intake Agent

```json
{
  "action": "open_case",
  "case_type": "[from classification]",
  "complexity": "[from assessment]",
  "referring_party": "[from intake]",
  "case_open_date": "[today]",
  "complainant_role": "[anonymised]",
  "respondent_role": "[anonymised]",
  "allegation_count": "[integer]",
  "escalation_level": "[None / Advisory / Mandatory]",
  "legal_involved": "[boolean]"
}
```

### Handoff to Document Agent

```json
{
  "action": "generate_document",
  "document_requested": "[document name]",
  "case_reference": "[assigned by Intake Agent]",
  "case_type": "[from classification]",
  "complexity": "[from assessment]",
  "allegation_count": "[integer]",
  "allegations": ["[anonymised allegation 1]", "[anonymised allegation 2]"],
  "complainant_role": "[anonymised]",
  "respondent_role": "[anonymised]",
  "witness_count": "[integer]",
  "witness_roles": ["[anonymised role 1]", "[anonymised role 2]"],
  "incident_period": "[date range]",
  "policies_applicable": ["[policy 1]", "[policy 2]"],
  "evidence_types": ["[type 1]", "[type 2]"],
  "escalation_level": "[None / Advisory / Mandatory]",
  "legal_involved": "[boolean]",
  "special_instructions": "[any case-specific notes from consultant]"
}
```

### Handoff to Quality Agent

```json
{
  "action": "quality_review",
  "document_type": "[Investigation Report / Outcome Letter / other]",
  "case_reference": "[case reference]",
  "case_type": "[case type]",
  "complexity": "[level]",
  "escalation_level": "[level]",
  "document_content": "[full document text for review]",
  "allegations": ["[list of allegations — for completeness check]"],
  "legal_involved": "[boolean]"
}
```

### Handoff to Case Management Agent

```json
{
  "action": "update_case" | "set_deadline" | "log_document" | "close_case",
  "case_reference": "[case reference]",
  "case_type": "[case type]",
  "complexity": "[level]",
  "current_phase": "[Phase 1 / 2 / 3 / 4]",
  "status": "[Open / In Progress / Reporting / Outcome / Closed]",
  "documents_generated": ["[list of documents produced so far]"],
  "next_action": "[what needs to happen next]",
  "deadline": "[date if applicable]"
}
```

---

## Step 8 — Mid-Case Decision Rules

Investigations do not always follow a straight line. The Coordinator must handle mid-case events without losing control of the workflow.

### New Allegation Emerges During Investigation

```
IF new allegation raised during active investigation:

  Assess: Is it related to original case?
  
  Related:
  → Notify consultant immediately
  → Pause document generation
  → Await consultant instruction: expand scope or separate case
  → IF expand scope: update Investigation Plan, regenerate interview frameworks
  → IF separate case: open new case, cross-reference in both files
  
  Unrelated:
  → Open separate case
  → Cross-reference both case files
  → Notify consultant
```

### Witness Refuses to Participate

```
IF witness declines to be interviewed:

  → Document refusal in Case Management Agent log
  → Note in Investigation Report methodology section:
    "[WITNESS A] was invited to participate in this investigation but 
    declined to do so. Their account has therefore not been available 
    to the Investigating Officer. This limitation is acknowledged in 
    the assessment of evidence."
  → Do NOT attempt to compel — flag to consultant
  → If refusal affects ability to reach findings: flag as investigation limitation
```

### Respondent Goes on Sick Leave Mid-Investigation

```
IF respondent reports sick leave during investigation:

  → Pause respondent interview
  → Flag to consultant: advisory escalation
  → Suggested approach: allow reasonable time for return, 
    consider written questions as alternative if prolonged absence
  → Update timeline in Case Management Agent
  → Do NOT close or conclude the investigation without 
    giving the respondent a reasonable opportunity to respond
```

### Legal Contacts the Coordinator Mid-Investigation

```
IF legal_involved changes from false to true mid-case:

  → Immediately flag to consultant
  → Pause any documents not yet approved
  → Await legal clearance before generating outcome documents
  → Case Management Agent: add "Legal Review" milestone to tracker
```

---

## Step 9 — Case Closure Protocol

The Coordinator manages case closure to ensure nothing is missed.

### Closure Checklist

```
Before marking a case as closed, confirm ALL of the following:

□ Investigation Report approved by consultant
□ Outcome letters issued to all relevant parties
□ Appeal window noted (typically 5 working days from outcome — confirm with client policy)
□ All documents filed in correct case folder structure
□ Case reference updated to "Closed" in Case Management Agent
□ Head of ER / Senior HRBP sign-off confirmed (Dayo Oyejide noted this is required)
□ Case metrics logged (case type, complexity, duration, outcome category)
□ Any learning or themes noted for ER team knowledge base
□ All working documents (drafts, notes) archived or deleted per retention policy
```

### Case Metrics to Log at Closure

These are collected to inform continuous improvement and, in future, reporting dashboards:

```
case_reference:       string
case_type:            string
complexity:           string
date_opened:          date
date_closed:          date
duration_days:        integer (calculated)
allegation_count:     integer
outcome_per_allegation: array ["Substantiated", "Not Substantiated", "Inconclusive", etc.]
legal_involved:       boolean
escalated:            boolean
documents_produced:   integer (count)
consultant:           string (consultant role, not name — for team tracking)
follow_up_actions:    array (training, policy updates, recommendations — see below)
```

---

## Authoritative Outcome Language Framework

**Source: Authoritative investigator questionnaire (15+ years experience). This section takes precedence over any other outcome language used elsewhere in the system.**

Different case types use different outcome language. The Coordinator must pass the correct outcome language context to the Document Agent and Quality Agent for every case.

### Investigation Report — Conclusion Verdicts (Three Valid Verdicts)

For every allegation in every case type, the Investigating Officer reaches one of three conclusions:

```
SUBSTANTIATED
  → The evidence supports the allegation on the balance of probabilities
  → More likely than not that the alleged conduct occurred
  → Use when: evidence clearly supports the allegation

NOT SUBSTANTIATED  (also acceptable: UNSUBSTANTIATED)
  → The evidence does not support the allegation on the balance of probabilities
  → More likely than not that the alleged conduct did not occur
  → Use when: evidence clearly contradicts or does not support the allegation

INCONCLUSIVE
  → The evidence is insufficient to reach a finding either way
  → Cannot determine on the balance of probabilities whether conduct occurred
  → Use when: conflicting accounts with no corroborating evidence, 
    key witnesses unavailable, evidence destroyed or not accessible
  → MUST include explanation of why a finding could not be reached
  → NOT a default when investigation is difficult — only when genuinely unable to determine
```

**Rule:** Inconclusive is a legitimate finding, not a failure. It must be explained clearly and the limitations documented.

---

### Outcome Language by Case Type — Post-Report Decision Maker

The investigation report findings inform but do not determine the outcome. The decision maker applies the following outcome language:

#### Grievance Outcomes (Decision Maker)
```
→ UPHELD
  The allegation is found to have occurred. The complaint is upheld.
  
→ NOT UPHELD
  The allegation is not found to have occurred. The complaint is not upheld.
  
→ PARTIALLY UPHELD
  Some but not all allegations are found to have occurred.
  The complaint is partially upheld.
```

#### Disciplinary Investigation Outcomes (Investigation Stage)
```
→ CASE TO ANSWER
  The investigation findings support that there is a case for the 
  respondent to answer at a disciplinary hearing.
  
→ NO CASE TO ANSWER
  The investigation findings do not support proceeding to a 
  disciplinary hearing. No further action required.
```

#### Disciplinary Hearing Outcomes (Hearing Manager)
```
→ UPHELD + SANCTION
  The allegation is found proven. A sanction is applied.
  Sanction levels (from least to most severe):
  - Informal warning / advice
  - Formal verbal warning
  - Written warning
  - Final written warning
  - Demotion (where applicable)
  - Dismissal with notice
  - Summary dismissal (gross misconduct — immediate, no notice)

→ NOT UPHELD
  The allegation is not found proven. No sanction applied.

→ PARTIALLY UPHELD + SANCTION
  Some allegations are found proven. Sanction reflects findings.
```

**Critical rule:** The Coordinator must pass the case type to the Document Agent when requesting outcome letters so that the correct outcome language is used. Grievance outcome letters use upheld/not upheld/partially upheld. Disciplinary investigation outcome letters use case to answer/no case to answer. These are not interchangeable.

---

## Coordinator Output Summary

At the end of every case phase, the Coordinator produces a status summary for the consultant. This keeps the consultant informed without requiring them to track agent activity manually.

### Phase Completion Summary Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE [X] COMPLETE — [CASE REFERENCE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Case Type:      [type]
Complexity:     [level]
Phase:          [name]
Date:           [today]

Documents produced this phase:
  ✓ [Document 1] — ready for review
  ✓ [Document 2] — ready for review
  ⚠ [Document 3] — flagged for consultant attention (reason)

Next phase:     [Phase X+1 name]
Next actions:
  → [Action 1]
  → [Action 2]

Outstanding:
  → [anything the consultant needs to provide or decide]

Case timeline status:   [On track / At risk / Delayed]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Critical Rules — Coordinator Agent

- **NEVER skip the anonymisation check** — it runs on every case, every time, before any agent is called
- **NEVER generate documents before the workflow plan is confirmed** by the consultant
- **NEVER close a case automatically** — closure always requires consultant confirmation
- **ALWAYS run escalation checks before Phase 1 documents are generated** — not after
- **ALWAYS produce the workflow plan** and show it to the consultant before execution begins
- **ALWAYS pass the correct input package** to each sub-agent — do not pass raw case data
- **ALWAYS update the Case Management Agent** after each phase completes
- **NEVER make legal determinations** — flag, escalate, and wait for the consultant
- **ALWAYS acknowledge limitations** — if an investigation cannot be completed fully, document why
- **ALWAYS keep the consultant in control** — the Coordinator makes recommendations, the consultant makes decisions

---

## Dependencies

- **SKILL_intake_agent.md** — must exist before Phase 1 can execute
- **SKILL_document_agent.md** — must exist before any document can be generated
- **SKILL_casemanagement_agent.md** — must exist for case tracking and file management
- **SKILL_quality_agent.md** — must exist for Medium complexity cases and above
- **Anthropic API** — used by Document Agent for document generation (anonymised inputs only)

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0 | February 2026 | Initial version — derived from three investigator questionnaire responses |
| 1.1 | March 2026 | Updated from authoritative questionnaire (15+ years experience): added AWOL case type, conflict of interest check, SME witness category, authoritative outcome language framework (upheld/not upheld/partially upheld for grievances; case to answer/no case to answer for disciplinaries; Inconclusive as third report verdict) |

*Next review: after first live case testing.*
