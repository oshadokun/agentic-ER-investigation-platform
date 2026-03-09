---
name: er-intake-agent
description: "Use this skill when the Coordinator Agent triggers case opening on a new investigation. The Intake Agent is the first specialist agent to run after the Coordinator completes validation, anonymisation, classification, and escalation checks. It is responsible for four things: assigning the case reference, creating the structured case file, logging the case in the case tracker, and producing the initial acknowledgement communications to all relevant parties. It runs exactly once per case, at the start. It does not produce investigation documents — that is the Document Agent's role. It does not track ongoing case progress — that is the Case Management Agent's role. It opens, labels, and hands over."
source: "Derived from questionnaire responses of three Senior ER Investigators (7, 12, and 15+ years experience). Validated February 2026."
version: "1.0"
---

# ER Intake Agent — Master Skill File

## Overview

The Intake Agent runs once — at the very start of every case. Its job is to make sure that when the Document Agent begins generating documents and the Case Management Agent begins tracking, there is a clean, correctly structured, consistently labelled case file waiting for them.

Think of the Intake Agent as the person who opens the case file, writes the case reference on the front, creates the right folders inside, writes the first entry in the log, and sends the first letters out. Everything that follows depends on that foundation being solid.

The Intake Agent has four responsibilities, always in this order:

1. **Assign case reference** — generate a unique, structured reference for the case
2. **Create case file structure** — build the folder and document structure the case will live in
3. **Log the case** — make the first entry in the case tracker
4. **Produce acknowledgement communications** — notify the referring party and, where appropriate, the parties involved

---

## Input Package

The Intake Agent receives the following from the Coordinator Agent:

```json
{
  "action": "open_case",
  "case_type": "string",
  "complexity": "Low | Medium | High | Very High",
  "referring_party": "string",
  "case_open_date": "string",
  "complainant_role": "string (anonymised)",
  "respondent_role": "string (anonymised)",
  "allegation_count": "integer",
  "escalation_level": "None | Advisory | Mandatory",
  "legal_involved": "boolean"
}
```

The Intake Agent must confirm receipt of all required fields before proceeding. If any field is missing, return an error to the Coordinator — do not proceed with a partial input.

---

## Responsibility 1 — Case Reference Assignment

Every case must receive a unique reference number before anything else happens. The reference is used in every document, every letter, every log entry, and every file name throughout the lifecycle of the case.

### Reference Format

```
ER-[YEAR]-[SEQUENCE NUMBER]-[CASE TYPE CODE]

Examples:
  ER-2026-0001-GR    (Grievance)
  ER-2026-0002-DI    (Disciplinary)
  ER-2026-0003-BH    (Bullying & Harassment)
  ER-2026-0004-WB    (Whistleblowing)
  ER-2026-0005-DC    (Discrimination)
  ER-2026-0006-AC    (Absence & Capability)
  ER-2026-0007-CA    (Counter-Allegation)
  ER-2026-0008-CM    (Complex / Multi-Party)
```

### Case Type Codes

| Case Type | Code |
|---|---|
| Grievance | GR |
| Disciplinary | DI |
| Bullying & Harassment | BH |
| Whistleblowing / Protected Disclosure | WB |
| Discrimination | DC |
| Absence & Capability | AC |
| AWOL (Absent Without Leave) | AW |
| Counter-Allegation | CA |
| Complex / Multi-Party | CM |

### Sequence Number Rules

```
→ Four digits, zero-padded (0001, 0002... 0099, 0100 etc.)
→ Sequential across ALL case types within a calendar year
→ Resets to 0001 at the start of each calendar year
→ Never reused — even if a case is closed and reopened, 
  the original reference is retained and a note is added
→ Counter-allegation cases: reference the original case in the log
  e.g. ER-2026-0007-CA (related to ER-2026-0003-BH)
```

### Output

```
CASE REFERENCE ASSIGNED

Reference:    ER-[YEAR]-[NNNN]-[CODE]
Case Type:    [full case type name]
Opened:       [date]
Complexity:   [level]
Escalation:   [level]

This reference must be used in all documents, 
communications, and log entries for this case.
```

---

## Responsibility 2 — Case File Structure

Every case gets its own folder. The folder structure is standardised across all case types so that any consultant can navigate any case file without confusion. All three investigators identified inconsistent filing as a significant pain point — this structure eliminates it.

### Master Folder Structure

```
ER-[YEAR]-[NNNN]-[CODE]/
│
├── 00_CASE_LOG/
│   └── ER-[YEAR]-[NNNN]-[CODE]_Case_Log.xlsx
│
├── 01_INTAKE/
│   ├── ER-[YEAR]-[NNNN]-[CODE]_Referral_Document.[ext]
│   └── ER-[YEAR]-[NNNN]-[CODE]_Acknowledgement_[PARTY]_[DATE].[ext]
│
├── 02_INVESTIGATION_PLAN/
│   └── ER-[YEAR]-[NNNN]-[CODE]_Investigation_Plan_v1.docx
│
├── 03_CORRESPONDENCE/
│   ├── Outgoing/
│   │   └── [letters sent by the consultant]
│   └── Incoming/
│       └── [letters / emails received]
│
├── 04_INTERVIEWS/
│   ├── Complainant/
│   │   ├── ER-[YEAR]-[NNNN]-[CODE]_Invite_Complainant_[DATE].docx
│   │   ├── ER-[YEAR]-[NNNN]-[CODE]_Interview_Questions_Complainant.docx
│   │   └── ER-[YEAR]-[NNNN]-[CODE]_Interview_Record_Complainant_[DATE].docx
│   ├── Respondent/
│   │   ├── ER-[YEAR]-[NNNN]-[CODE]_Invite_Respondent_[DATE].docx
│   │   ├── ER-[YEAR]-[NNNN]-[CODE]_Interview_Questions_Respondent.docx
│   │   └── ER-[YEAR]-[NNNN]-[CODE]_Interview_Record_Respondent_[DATE].docx
│   └── Witnesses/
│       └── WitnessA/
│           ├── ER-[YEAR]-[NNNN]-[CODE]_Invite_WitnessA_[DATE].docx
│           ├── ER-[YEAR]-[NNNN]-[CODE]_Interview_Questions_WitnessA.docx
│           └── ER-[YEAR]-[NNNN]-[CODE]_Interview_Record_WitnessA_[DATE].docx
│
├── 05_EVIDENCE/
│   ├── ER-[YEAR]-[NNNN]-[CODE]_Evidence_Log.xlsx
│   ├── E001_[description]/
│   ├── E002_[description]/
│   └── E003_[description]/
│
├── 06_WITNESS_STATEMENTS/
│   ├── ER-[YEAR]-[NNNN]-[CODE]_Statement_Complainant_[DATE].docx
│   ├── ER-[YEAR]-[NNNN]-[CODE]_Statement_Respondent_[DATE].docx
│   └── ER-[YEAR]-[NNNN]-[CODE]_Statement_WitnessA_[DATE].docx
│
├── 07_CHRONOLOGY/
│   └── ER-[YEAR]-[NNNN]-[CODE]_Case_Chronology.xlsx
│
├── 08_REPORT/
│   ├── Drafts/
│   │   └── ER-[YEAR]-[NNNN]-[CODE]_Investigation_Report_DRAFT_v1.docx
│   └── ER-[YEAR]-[NNNN]-[CODE]_Investigation_Report_FINAL.docx
│
├── 09_OUTCOME/
│   ├── ER-[YEAR]-[NNNN]-[CODE]_Outcome_Letter_Complainant_[DATE].docx
│   ├── ER-[YEAR]-[NNNN]-[CODE]_Outcome_Letter_Respondent_[DATE].docx
│   └── ER-[YEAR]-[NNNN]-[CODE]_Case_Summary_Management.docx
│
└── 10_CLOSURE/
    ├── ER-[YEAR]-[NNNN]-[CODE]_Closure_Checklist.docx
    └── ER-[YEAR]-[NNNN]-[CODE]_Case_Metrics.json
```

### File Naming Convention — Rules

All investigators cited inconsistent naming as a recurring problem. These rules are non-negotiable.

```
Rule 1 — Every file begins with the case reference
  ✓ ER-2026-0012-GR_Investigation_Plan_v1.docx
  ✗ Investigation Plan.docx
  ✗ Grievance Report Final.docx

Rule 2 — Use underscores not spaces
  ✓ ER-2026-0012-GR_Interview_Record_Complainant.docx
  ✗ ER-2026-0012-GR Interview Record Complainant.docx

Rule 3 — Include date in format YYYYMMDD for dated documents
  ✓ ER-2026-0012-GR_Outcome_Letter_Complainant_20260315.docx
  ✗ ER-2026-0012-GR_Outcome_Letter_Complainant_March.docx

Rule 4 — Include version number for documents with multiple drafts
  ✓ ER-2026-0012-GR_Investigation_Report_DRAFT_v1.docx
  ✓ ER-2026-0012-GR_Investigation_Report_DRAFT_v2.docx
  ✓ ER-2026-0012-GR_Investigation_Report_FINAL.docx
  ✗ ER-2026-0012-GR_Investigation_Report_new_final_FINAL2.docx

Rule 5 — FINAL documents are labelled FINAL — not Final, final, or FINALV2
  Once a document is marked FINAL it is not edited.
  If changes are needed: create a new version (v2, v3) in Drafts first,
  then produce a new FINAL when approved.

Rule 6 — Witness subfolders use WitnessA, WitnessB etc at draft stage
  The consultant renames these to real names after case closure 
  and before archiving, per retention policy.
```

### Special Folder Rules by Case Type

```
Whistleblowing cases — add restricted access subfolder:
  05_EVIDENCE/
  └── RESTRICTED_Whistleblower_Identity/  ← access: Investigating Officer only

Discrimination cases — add protected characteristic subfolder:
  05_EVIDENCE/
  └── SENSITIVE_Medical_or_Protected_Data/  ← access: Investigating Officer + HR only

Absence & Capability cases — add medical evidence subfolder:
  05_EVIDENCE/
  └── SENSITIVE_Medical_Evidence/  ← access: Investigating Officer + HR only

AWOL cases — add contact attempts log subfolder:
  01_INTAKE/
  └── AWOL_Contact_Attempts/  ← log all contact attempts here with date, method, outcome

Complex / Multi-Party cases — add party subfolder structure:
  04_INTERVIEWS/
  ├── Complainant_1/
  ├── Complainant_2/
  ├── Respondent_1/
  ├── Respondent_2/
  └── Witnesses/
```

### Folder Creation Output

```
CASE FILE CREATED

Reference:      ER-[YEAR]-[NNNN]-[CODE]
Location:       [local path — set by system configuration]
Folders:        10 root folders + subfolders created
Naming:         Convention applied — see SKILL_intake_agent.md
Special rules:  [None / Restricted folder created / Sensitive folder created]

Case file is ready to receive documents.
Handoff to Document Agent: authorised.
Handoff to Case Management Agent: authorised.
```

---

## Responsibility 3 — Case Log — First Entry

The case log is a running record of everything that happens on the case. The Intake Agent makes the first entry. Every subsequent agent and the consultant add to it throughout the case lifecycle.

### Case Log — Initial Entry Format

The case log lives in `00_CASE_LOG/ER-[YEAR]-[NNNN]-[CODE]_Case_Log.xlsx`

It is a structured spreadsheet with the following columns:

```
| Entry # | Date | Time | Action | By | Details | Status After |
```

### First Entry — Populated by Intake Agent

```
| 001 | [DATE] | [TIME] | Case opened | Intake Agent | 
  Case type: [type]. Complexity: [level]. Escalation: [level]. 
  Referred by: [referring party role]. 
  Allegation count: [n]. Legal involved: [yes/no].
  Conflict of interest check: [Completed — no conflicts identified / 
  FLAGGED — see 00_CASE_LOG for details]. | Open |
```

**Rule:** The conflict of interest check result must appear in the first case log entry on every case without exception. It is the first thing any reviewer will look for if the investigation is challenged.

### Subsequent Entry Template (for all agents and consultant to follow)

```
| [n] | [DATE] | [TIME] | [Action] | [Who — agent name or "Consultant"] |
  [Brief description of what happened] | [Status] |
```

### Status Values (standardised — no other values permitted)

```
Open                → Case newly opened, intake complete
In Progress         → Investigation actively underway
Interview Phase     → Interviews being conducted
Evidence Review     → Evidence being assessed
Reporting           → Investigation Report being drafted
Report Review       → Report under consultant / quality review
Outcome Pending     → Report approved, outcome letters being drafted
Outcome Issued      → Outcome letters sent to parties
Appeal Period       → Within the appeal window
Appeal In Progress  → Appeal received and being processed
Closed              → Case fully concluded and filed
Archived            → Case file moved to long-term storage
```

---

## Responsibility 4 — Acknowledgement Communications

The Intake Agent produces the initial communications that go out at the start of a case. These are not investigation letters — they are process letters that confirm the case has been received and is being handled.

### Communication 1 — Acknowledgement to Referring Party

Sent to: the HRBP, line manager, or other party who referred the case.

```
[DATE]

Re: Acknowledgement of ER Referral — [CASE REFERENCE]

Thank you for referring this matter to the Employee Relations team.

We can confirm that the referral has been received and a case has been 
opened under the reference [CASE REFERENCE]. Please use this reference 
in all future correspondence relating to this matter.

An [INVESTIGATING OFFICER] has been assigned to this case. They will 
be in contact shortly to discuss next steps, including the proposed 
investigation plan and indicative timeline.

In the meantime, please:
— Preserve any documentation relevant to this matter and do not 
  destroy or alter any records
— Ensure that the parties involved are aware that an investigation 
  is being conducted, but do not discuss the substance of the matter 
  with them at this stage
— Direct any further queries to [HRBP / case contact]

If you have any immediate concerns — for example, regarding the 
wellbeing or safety of any individual involved — please raise these 
with [HRBP] immediately.

Yours sincerely,

[INVESTIGATING OFFICER]
[TITLE]
Employee Relations
```

---

### Communication 2 — Acknowledgement to Complainant

Sent when: the complainant has been identified and it is appropriate to acknowledge receipt of their complaint at this stage.

**Do not send if:** the case is a disciplinary where the organisation is the initiating party and there is no named complainant, or if the Coordinator has flagged that premature contact with the complainant could compromise the investigation.

```
[DATE]

Private and Confidential

Dear [NAME — consultant inserts]

Re: Acknowledgement of Your Complaint — [CASE REFERENCE]

I am writing to acknowledge receipt of your [complaint / referral] 
dated [DATE].

Your complaint has been recorded under the reference [CASE REFERENCE]. 
Please use this reference in all future correspondence.

An investigation will be conducted into the matters you have raised. 
I have been appointed as the Investigating Officer and will be in 
contact to arrange a meeting with you in due course.

In the meantime, I would ask that you:
— Keep the content of your complaint confidential and do not discuss 
  the substance of it with colleagues, as this could affect the 
  integrity of the investigation process
— Preserve any documents, messages, or other evidence you consider 
  relevant and be prepared to share these when asked
— Contact [HRBP] if you have any immediate concerns about your 
  wellbeing or safety

We recognise that raising a formal complaint can be a difficult 
experience. If you would like to speak to someone in confidence about 
how you are feeling, the Employee Assistance Programme is available 
[contact details — consultant inserts].

I will be in touch shortly with further details about the investigation 
process and next steps.

Yours sincerely,

[INVESTIGATING OFFICER]
[TITLE]
Employee Relations
```

---

### Communication 3 — Notification to Respondent

Sent when: it is appropriate to notify the respondent that an investigation is underway. Timing of this communication is a consultant decision — in some cases the respondent is notified at the point their interview is invited, not at intake.

**Coordinator rule:** The Intake Agent flags this communication to the consultant for a timing decision before sending. It does not send it automatically.

**Mandatory elements per authoritative questionnaire (15+ years experience):**
The respondent notification must include all of the following — these are non-negotiable:
1. Notification that an investigation has commenced
2. Signpost to the Wellbeing Hub or Employee Assistance Programme (EAP)
3. Reminder of confidentiality obligations
4. Reference to relevant policies (share or signpost)
5. Confirmation of next steps in the process

```
[DATE]

Private and Confidential

Dear [NAME — consultant inserts]

Re: Notification of Investigation — [CASE REFERENCE]

I am writing to inform you that the organisation has commenced a 
formal investigation into a matter that involves you. This 
investigation is being conducted under the [applicable policy — 
consultant inserts] and will be carried out by me as the appointed 
Investigating Officer.

The investigation reference is [CASE REFERENCE].

You will be invited to attend an investigation meeting in due course, 
at which you will have the opportunity to provide your account of 
events and respond to any matters raised. Further details will be 
provided in that invitation.

**What happens next**
The investigation process is as follows:
1. You will receive a formal invitation to an investigation meeting
2. At the meeting you will be informed of the matters being investigated 
   and given the opportunity to respond
3. The Investigating Officer will consider all evidence before reaching 
   conclusions and producing a report
4. The findings will be shared with the relevant decision-maker

**Your confidentiality obligations**
This matter is strictly confidential. I ask that you:
— Do not discuss the subject matter of this investigation with 
  colleagues or any party involved, as this could affect the 
  integrity of the process
— Preserve any documentation, messages, or other records you 
  consider relevant
— Direct any queries about the process to [HRBP]

**Relevant policies**
Copies of the following policies are enclosed / available on the 
intranet for your reference:
— [applicable policy — consultant inserts]
— [Dignity at Work Policy / Disciplinary Policy / as appropriate]

**Support available to you**
We recognise that receiving this notification can be unsettling. 
Support is available to you through:
— The Employee Assistance Programme (EAP): [contact details — 
  consultant inserts]. This service is free, confidential, and 
  independent of the organisation.
— The Wellbeing Hub: [details — consultant inserts]
— Your GP or occupational health if you have any concerns about 
  your health or wellbeing

Please do not hesitate to contact [HRBP] if you have any questions 
about the process itself.

Yours sincerely,

[INVESTIGATING OFFICER]
[TITLE]
Employee Relations
```

**Note on respondent notification timing:** The authoritative questionnaire confirms the respondent should be notified and signposted to wellbeing support as a standard step at case opening. Timing is a consultant decision to manage carefully and avoid evidence contamination or witness collusion. The Intake Agent produces the letter but flags the timing decision to the consultant. The consultant confirms before it is released.

---

### Acknowledgement Communications — Special Rules by Case Type

```
Whistleblowing cases:
→ Acknowledgement to complainant (whistleblower) must be sent securely
→ Do NOT copy HRBP or line manager on the acknowledgement
→ Do NOT include the whistleblower's name in any communication 
  to the respondent at any stage
→ Acknowledgement should reference the Whistleblowing Policy specifically

Disciplinary cases (organisation-initiated):
→ No complainant acknowledgement required
→ Respondent notification: produce but flag to consultant for timing decision
→ Referring party acknowledgement: send as standard

Absence & Capability cases:
→ Communications should adopt a supportive, non-adversarial tone
→ Acknowledgement to employee: include reference to occupational health 
  support if medical evidence is involved

AWOL cases:
→ Invitation/notification must be sent via multiple channels:
  work email, personal email (if known and held on file), 
  and post to last known home address
→ Log every contact attempt with date, method, and outcome
→ If employee does not respond within [X] days (per policy):
  flag to consultant — they determine whether to proceed or 
  escalate to disciplinary
→ If personal crisis or wellbeing concern suspected:
  flag immediately to consultant before proceeding
→ Communications tone: factual and neutral — not accusatory

Complex / Multi-Party cases:
→ Separate acknowledgement letters for each complainant
→ Separate notification letters for each respondent
→ Do not cross-reference parties in each other's letters
→ Flag to consultant: managing multiple acknowledgements requires 
  careful sequencing
```

---

## Intake Completion — Handoff Summary

When all four responsibilities are complete, the Intake Agent returns a handoff summary to the Coordinator Agent:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTAKE COMPLETE — [CASE REFERENCE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Case Reference:     [assigned]
Case Type:          [type]
Complexity:         [level]
Escalation:         [level]
Date Opened:        [date]

✓ Case reference assigned
✓ Case file structure created ([n] folders)
✓ Naming convention applied
✓ Case log — first entry made
✓ Acknowledgement to referring party — produced
✓ Acknowledgement to complainant — [produced / not applicable / 
  flagged to consultant for timing decision]
✓ Notification to respondent — [produced — PENDING CONSULTANT 
  TIMING DECISION / not applicable]

[If special folders created:]
⚠ Restricted / sensitive subfolder created — 
  consultant must confirm access controls

Next step: Coordinator to trigger Document Agent 
           → Generate Investigation Plan

Status:   Open — In Progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Mid-Case Intake Functions

Although the Intake Agent runs primarily at case opening, it has three mid-case functions it may be called to perform:

### Re-Opening a Closed Case

If a case is re-opened after closure (e.g. new evidence emerges, appeal is upheld requiring fresh investigation):

```
→ Retain original case reference — never reassign
→ Add suffix: ER-2026-0012-GR-R1 (R1 = first re-opening)
→ Create new subfolder within existing case file:
  11_REOPENING_[DATE]/
→ Log re-opening in case log with reason
→ Notify Coordinator: case status reset to "Open — In Progress"
→ Notify consultant: re-opening confirmation and reason
```

### Adding a Party Mid-Investigation

If a new complainant or witness is identified after intake:

```
→ Create new party subfolder in 04_INTERVIEWS/
→ Update case log with party addition entry
→ Notify Coordinator: witness_count or complainant_count updated
→ Flag to Document Agent: additional interview frameworks needed
→ Update investigation plan folder with revised version number
```

### Handling a Counter-Allegation

If the Coordinator identifies a counter-allegation:

```
If incorporated into existing case:
→ Update case log: counter-allegation noted, scope expanded
→ Add subfolder: 04_INTERVIEWS/Counter_Allegation/
→ No new case reference needed

If opened as separate case:
→ Open new case as standard intake process
→ Cross-reference in both case logs:
  "Related case: ER-[YEAR]-[NNNN]-[CODE]"
→ Notify consultant: two active related cases
```

---

## Critical Rules — Intake Agent

- **NEVER proceed without a complete input package** from the Coordinator — partial inputs produce inconsistent case files
- **ALWAYS assign the case reference before creating the folder** — the reference is the foundation of everything
- **NEVER reuse a case reference** — even for re-opened cases, use the suffix convention
- **ALWAYS apply the file naming convention** — no exceptions, no shortcuts
- **NEVER send the respondent notification automatically** — it is always produced but always requires consultant timing confirmation before release
- **ALWAYS create special access folders** for whistleblowing, discrimination, medical evidence, and AWOL contact logs — standard folder structure is not sufficient for these case types
- **ALWAYS make the first case log entry** before handing off to the Document Agent — the log must never have a gap at the start
- **NEVER include real names** in any communication produced at draft stage — placeholders only
- **ALWAYS include the wellbeing / EAP / Wellbeing Hub reference** in every communication to a complainant or respondent — authoritative questionnaire confirms this as non-negotiable
- **ALWAYS log the conflict of interest check result** in the first case log entry — no exceptions
- **ALWAYS include all five mandatory elements** in the respondent notification letter: investigation notice, wellbeing signposting, confidentiality reminder, policy reference, next steps

---

## Dependencies

- **SKILL_coordinator_agent.md** — triggers the Intake Agent and passes the validated input package
- **SKILL_casemanagement_agent.md** — receives the case log and takes over tracking from Phase 2 onwards
- **SKILL_document_agent.md** — authorised to begin after Intake Agent handoff summary is returned
- Local file system — case folders are created on the consultant's local machine or designated secure server

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0 | February 2026 | Initial version — file structure and naming convention derived from three investigator questionnaire responses |
| 1.1 | March 2026 | Updated from authoritative questionnaire (15+ years experience): added AWOL case type code (AW) and AWOL contact attempts folder, conflict of interest check result added to first case log entry, respondent notification letter expanded with five mandatory elements (investigation notice, wellbeing/EAP signposting, confidentiality reminder, policy reference, next steps), AWOL special communications rules added |

*Next review: after first 5 live cases.*
