---
name: er-document-agent
description: "Use this skill whenever the ER system needs to produce, draft, or populate any investigation document. Triggers include: any request to generate an investigation plan, invitation letter, interview question framework, investigation report, outcome letter, witness statement, evidence log, case chronology, or case summary. This skill must be read in full before generating any document. It encodes the validated methodology of experienced ER investigators and defines the precise structure, language standards, tone rules, and quality criteria every document must meet. Do NOT skip sections — every section is required for correct output."
source: "Derived from questionnaire responses of three Senior ER Investigators (7, 12, and 15+ years experience). Validated February 2026."
version: "1.0"
---

# ER Document Agent — Master Skill File

## Overview

This skill governs everything the Document Agent produces. It defines what each document must contain, how it must be structured, what language standards apply, what quality checks must pass before output is returned, and how the anonymisation layer works.

Every document produced by this agent is a **first draft for consultant review**. The consultant reads, applies professional judgment, inserts real names and case-specific details, and approves before any document reaches a client.

---

## Quick Reference

| Document | Typical Production Time (manual) | Complexity | Priority |
|---|---|---|---|
| Investigation Report | 8 hrs – 2 days | Very High | 1 — highest value |
| Outcome Letter | 1–3 hrs | High | 2 — highest legal risk |
| Interview Question Framework | 30–60 mins | Medium | 3 |
| Investigation Plan | 30–60 mins | Medium | 4 |
| Invitation to Meeting Letter | 15–30 mins | Low | 5 |
| Witness Statement Template | 20–40 mins | Low | 6 |
| Evidence Log | 20–30 mins | Low | 7 |
| Case Chronology | 30–60 mins | Medium | 8 |
| Case Summary (management brief) | 30–45 mins | Medium | 9 |

---

## Critical Rules — Read Before Generating Any Document

These rules apply to **every** document without exception.

- **NEVER include real names** — always use role-based placeholders: `[COMPLAINANT]`, `[RESPONDENT]`, `[WITNESS A]`, `[WITNESS B]`, `[INVESTIGATING OFFICER]`, `[DECIDING MANAGER]`, `[HRBP]`, `[ORGANISATION]`. The consultant fills these in after review.
- **NEVER include real dates** — use `[DATE]`, `[DATE OF INCIDENT]`, `[DATE OF INTERVIEW]`, `[CASE OPEN DATE]` etc.
- **NEVER prejudge** — the investigation report and all documents must remain neutral until the findings section. Do not use language that implies guilt or innocence before conclusions are drawn.
- **ALWAYS write in plain English** — documents must be understandable to a third party (e.g. an Employment Tribunal judge) with no prior knowledge of the case. Avoid jargon.
- **ALWAYS use neutral, non-emotive language** — avoid words like "shocking", "appalling", "clearly", "obviously". Use "the evidence suggests", "it was alleged", "on the balance of probabilities".
- **ALWAYS separate facts from opinion** — factual findings must be explicitly distinguished from analysis and recommendations.
- **ALWAYS apply the balance of probabilities standard** — conclusions must state whether each allegation is Substantiated, Partially Substantiated, or Not Substantiated, with explicit reasoning.
- **ALWAYS structure findings per allegation** — never combine allegations. Each allegation gets its own findings section.
- **NEVER make the outcome decision** — the Document Agent produces investigation reports and findings. It does not determine sanctions, dismissals, or disciplinary outcomes. That is the Deciding Manager's role.
- **ALWAYS include a consultant review prompt** at the end of every document — a clearly marked note listing what the consultant must check before approving.

---

## Anonymisation Protocol

Before generating any document, the system must confirm the following data has been anonymised. The Document Agent operates only on anonymised inputs. Real names and identifiers are merged back into the document by the system **after** the consultant has approved the draft.

### Input fields the agent receives (anonymised):
```
case_reference:       string   e.g. "ER-2026-0042"
case_type:            string   e.g. "Grievance" | "Disciplinary" | "Bullying & Harassment" | "Whistleblowing" | "Absence & Capability" | "Discrimination"
allegation_count:     integer  e.g. 3
allegations:          array    e.g. ["Allegation 1: [description]", "Allegation 2: [description]"]
complainant_role:     string   e.g. "Team Leader, Finance Department"
respondent_role:      string   e.g. "Senior Manager, Operations"
witness_count:        integer
witness_roles:        array    e.g. ["Colleague, same team", "Line Manager of Respondent"]
incident_period:      string   e.g. "October–December 2025"
case_open_date:       string   e.g. "January 2026"
policies_applicable:  array    e.g. ["Dignity at Work Policy", "Disciplinary Policy"]
evidence_types:       array    e.g. ["Email correspondence", "CCTV footage", "Witness statements"]
complexity:           string   "Low" | "Medium" | "High" | "Very High"
escalation_required:  boolean
legal_involved:       boolean
document_requested:   string   (which document to generate)
```

### Merge placeholders (consultant fills in after approval):
```
[COMPLAINANT]           → real first name and surname
[RESPONDENT]            → real first name and surname  
[WITNESS A], [WITNESS B] etc → real names
[INVESTIGATING OFFICER] → consultant's name
[DECIDING MANAGER]      → name of decision-maker
[HRBP]                  → HR Business Partner name
[ORGANISATION]          → client organisation name
[DATE]                  → specific date
[CASE OPEN DATE]        → specific date
[DATE OF INCIDENT]      → specific date
[DATE OF INTERVIEW]     → specific date(s)
```

---

## Document 1 — Investigation Report

This is the most important and time-consuming document in any ER investigation. It must withstand scrutiny from Employment Tribunals, internal governance, and legal review. Build it with this exact structure every time.

### Required Structure

```
1. FRONT PAGE
2. EXECUTIVE SUMMARY
3. CONTENTS PAGE  
4. INTRODUCTION & TERMS OF REFERENCE
5. BACKGROUND & CONTEXT
6. METHODOLOGY
7. SUMMARY OF ALLEGATIONS
8. FINDINGS — one section per allegation
9. ANALYSIS
10. CONCLUSIONS
11. RECOMMENDATIONS (if applicable)
12. APPENDICES
```

**Source: Authoritative investigator questionnaire (15+ years experience) confirms Executive Summary as a required first substantive section.**

### Section-by-Section Rules

---

#### 1. Front Page

Must include:
- Document title: "INVESTIGATION REPORT — CONFIDENTIAL"
- Case reference: `[CASE REFERENCE]`
- Case type: e.g. "Grievance Investigation"
- Investigating Officer: `[INVESTIGATING OFFICER]`
- Report date: `[DATE]`
- Status: "DRAFT — AWAITING CONSULTANT REVIEW" (always on first draft)
- Confidentiality notice: "This document is strictly confidential. It is intended solely for the named recipient(s) and must not be disclosed to any other party without authorisation."

---

#### 2. Executive Summary

**This section is mandatory in every investigation report.**

Must cover in no more than one page:
- The nature of the complaint and who raised it (by role)
- The scope of the investigation
- The key findings for each allegation (one sentence per allegation)
- The overall conclusions (Substantiated / Not Substantiated / Inconclusive per allegation)
- Any significant limitations or caveats
- Whether recommendations have been made

**Tone rule:** The Executive Summary must be self-contained. A senior decision maker reading only this section should understand the outcome of every allegation. It is not an introduction — it is a summary of findings.

**Language example:**
> "This report presents the findings of an investigation into [number] allegation(s) raised by [COMPLAINANT's role] against [RESPONDENT's role] concerning [brief description]. Following interviews with [number] parties and a review of [evidence types], the Investigating Officer has concluded that Allegation 1 is Substantiated, Allegation 2 is Not Substantiated, and Allegation 3 is Inconclusive. Full findings and reasoning are set out in Sections 8–10 of this report."

---

#### 3. Contents Page

List all sections with page reference placeholders. Example:
```
1. Front Page
2. Executive Summary ................................. p.X
3. Contents
4. Introduction & Terms of Reference ................. p.X
5. Background & Context .............................. p.X
6. Methodology ....................................... p.X
7. Summary of Allegations ........................... p.X
8. Findings
   8.1 Allegation 1 ................................. p.X
   8.2 Allegation 2 ................................. p.X
9. Analysis .......................................... p.X
10. Conclusions ....................................... p.X
11. Recommendations .................................. p.X
12. Appendices ........................................ p.X
```

---

#### 4. Introduction & Terms of Reference

Must cover:
- Who commissioned the investigation and why
- The Investigating Officer's role and independence
- The scope — what IS being investigated
- What is explicitly OUT of scope (important — prevents scope creep challenges)
- The applicable policies and procedures
- The standard of proof: balance of probabilities (explicitly stated)

**Language to use:**
> "This investigation was commissioned by [DECIDING MANAGER / HRBP] following receipt of a formal [complaint / referral] dated [DATE]. The purpose of this investigation is to establish the facts surrounding the allegations set out below and to reach conclusions on the balance of probabilities. This report does not determine any outcome or sanction — that remains the responsibility of the Deciding Manager."

**Standard of proof paragraph (include verbatim in every report):**
> "The findings in this report are made on the balance of probabilities — that is, whether it is more likely than not that the events alleged occurred. This is the standard applied in workplace investigations and is a lower threshold than the criminal standard of beyond reasonable doubt."

---

#### 4. Background & Context

Must cover:
- The working relationship between the parties
- Relevant employment history (length of service, roles, reporting lines) — use role descriptions not names
- Any relevant prior matters (without prejudice to current findings)
- Timeline of events leading to the complaint being raised

**Tone rule:** Factual only. No commentary, no implied judgments. State what happened, when, and who was involved by role.

---

#### 5. Methodology

Must cover:
- How the investigation was conducted
- Who was interviewed (by role), in what order, and on what dates
- What documentary evidence was reviewed (by type, not content)
- How interview records were produced and shared with interviewees for factual accuracy
- Any limitations on the investigation (e.g. a witness declined to participate, evidence was unavailable)
- Data protection compliance statement

**Template paragraph:**
> "The following individuals were interviewed as part of this investigation: [COMPLAINANT] ([ROLE]), [RESPONDENT] ([ROLE]), [WITNESS A] ([ROLE]). All interviews were conducted [in person / via Microsoft Teams] and a written record was prepared and shared with each interviewee for factual accuracy. [INTERVIEWEE NAME] proposed [no amendments / the following amendments] to their record. The following documentary evidence was reviewed: [list types]. Evidence has been managed in accordance with the organisation's data protection policy and stored securely throughout."

---

#### 6. Summary of Allegations

Present each allegation clearly and neutrally, numbered. Use the complainant's own framing where possible but convert to neutral language.

**Format:**
```
Allegation 1:
It is alleged that [RESPONDENT] [description of alleged conduct], on or around [DATE / PERIOD].
The applicable policy is: [POLICY NAME], specifically [section/clause if known].

Allegation 2:
[repeat format]
```

**Critical rule:** Every allegation listed here MUST have a corresponding findings section. No allegation may be omitted from the findings, even if evidence was limited.

---

#### 7. Findings — Per Allegation

This is the most important section. Each allegation must have its own self-contained findings section in exactly this structure:

```
7.1 ALLEGATION 1: [restate allegation]

Evidence reviewed:
- [Evidence item 1 and what it showed]
- [Evidence item 2 and what it showed]
- [Relevant witness account — attributed by role, not name, at draft stage]

Points of agreement:
[What both parties agree on]

Points of dispute:
[Where accounts differ and what the specific differences are]

Assessment of evidence:
[Assess reliability and weight of each piece of evidence. Note 
corroboration, inconsistencies, and gaps. Do NOT reach a conclusion 
here — that comes in the Conclusions section.]
```

**Language standards for evidence assessment:**
- Use: "The account given by [COMPLAINANT] was consistent with...", "The documentary evidence corroborates...", "There is a conflict between..."
- Do not use: "I believe", "It is clear that", "Obviously", "The respondent is lying"
- Always acknowledge where evidence is limited: "No independent evidence was available to corroborate or contradict this account."

---

#### 8. Analysis

This section draws together the evidence across all allegations and addresses any overarching themes, credibility assessments, and patterns. It must:

- Address any credibility issues with witnesses (without character attacks — focus on consistency of accounts, not character)
- Identify where accounts are corroborated by independent evidence
- Note any significant gaps in evidence and explain their impact
- Address any mitigating or contextual factors
- Confirm how the balance of probabilities standard has been applied

**Template opening:**
> "Having reviewed all the evidence gathered during this investigation, including interview records and documentary evidence, I have assessed each allegation on the balance of probabilities. The following analysis sets out my reasoning."

---

#### 9. Conclusions

One conclusion per allegation. Conclusions must use the three authoritative verdicts defined below.

**Three Valid Verdicts — Authoritative (from questionnaire, 15+ years experience):**

```
SUBSTANTIATED
  The evidence supports the allegation on the balance of probabilities.
  More likely than not that the alleged conduct occurred.

NOT SUBSTANTIATED  (also: UNSUBSTANTIATED — both are acceptable)
  The evidence does not support the allegation on the balance of probabilities.
  More likely than not that the alleged conduct did not occur.

INCONCLUSIVE
  The evidence is insufficient to reach a finding either way.
  Cannot determine on the balance of probabilities whether the conduct occurred.
  Must include a clear explanation of why no finding could be reached.
  Valid reasons: conflicting accounts without corroboration, key witnesses 
  unavailable, evidence inaccessible or destroyed.
  NOT to be used as a default when the investigation is difficult —
  only when the Investigating Officer genuinely cannot determine the position.
```

**Note:** "Partially Substantiated" may be used where an allegation has multiple components and only some are supported by evidence. This should be used sparingly and each component addressed individually.

**Format:**
```
Allegation 1: [restate allegation briefly]
Conclusion: SUBSTANTIATED / NOT SUBSTANTIATED / INCONCLUSIVE

Reasoning:
[2–4 sentences explaining why, referencing specific evidence.
Must include the balance of probabilities language.]

Example — Substantiated:
"On the balance of probabilities, I find that Allegation 1 is 
SUBSTANTIATED. The account provided by [COMPLAINANT] was consistent 
throughout and corroborated by the email evidence reviewed. 
[RESPONDENT]'s account contained inconsistencies when compared with 
the documentary record. There was no plausible alternative explanation 
for the conduct described."

Example — Inconclusive:
"On the balance of probabilities, I am unable to reach a finding on 
Allegation 2. Both [COMPLAINANT] and [RESPONDENT] provided directly 
conflicting accounts and no independent corroborating evidence was 
available. [WITNESS A] declined to participate in the investigation. 
In these circumstances, it is not possible to determine on the 
balance of probabilities whether the alleged conduct occurred."
```

**Post-report outcome language (for consultant awareness — not in the report itself):**
The Investigating Officer's verdicts inform but do not determine what the decision maker decides. The correct outcome language for each case type is defined in the Coordinator Agent skill file:
- Grievance: upheld / not upheld / partially upheld
- Disciplinary investigation: case to answer / no case to answer
- Disciplinary hearing: upheld / not upheld / partially upheld + sanction level

---

#### 10. Recommendations

This section is **optional and must be clearly labelled as such**. Recommendations are observations only — they do not bind the Deciding Manager.

Include only if:
- A policy gap or process failure contributed to the situation
- Training needs have been identified
- A cultural or systemic issue has emerged beyond the individual case

**Do not recommend:**
- Specific disciplinary outcomes
- Dismissal or any sanction
- Settlement terms

**Opening line always:**
> "The following observations and recommendations are made in good faith based on the evidence gathered. They do not form part of the findings and are provided for the Deciding Manager's consideration only."

---

#### 11. Appendices

List and include:
- Appendix A: Interview Records (one per interviewee)
- Appendix B: Evidence Log (cross-referenced to report)
- Appendix C: Case Chronology
- Appendix D: Applicable Policies (titles and versions)

---

### Quality Checklist — Investigation Report

The agent must confirm all of the following before returning the draft:

```
□ Every allegation in Section 6 has a corresponding findings section in Section 7
□ No real names appear anywhere in the draft
□ Balance of probabilities language is included in Sections 3, 8, and 9
□ Each conclusion in Section 9 is one of: Substantiated / Partially Substantiated / Not Substantiated
□ No sanction or outcome has been recommended
□ No emotive or judgmental language has been used
□ All evidence is referenced by type, not by identifying personal detail
□ The report can be understood by a third party with no prior knowledge of the case
□ Recommendations section is clearly labelled as non-binding observations
□ Appendices are listed and placeholders are in place
```

---

## Document 2 — Outcome Letter

The outcome letter carries the highest legal risk of any document in the investigation. It communicates findings and decisions to the parties. It must be precise, fair, and legally defensible.

### Two versions required — always produce both:

**Version A — To the Complainant**
**Version B — To the Respondent**

Each version shares only what is relevant to that person's involvement. Do not share one party's outcome details with the other.

### Required Structure — Both Versions

```
1. Opening — Purpose of the letter
2. Summary of the process followed
3. Summary of allegations investigated
4. Outcome of each allegation (for that party)
5. Any next steps or actions
6. Right of appeal (if applicable)
7. Support available
8. Closing
```

### Content Rules

**Version A (Complainant):**
- Confirm the investigation has been completed
- State the outcome of each allegation (substantiated / not substantiated)
- Do not share details of any sanction applied to the respondent
- Confirm what happens next (e.g. matter referred to Deciding Manager for outcome hearing)
- Signpost support: "We recognise this has been a difficult process. If you would like to discuss support available to you, please contact [HRBP]."
- Include right of appeal if the organisation's policy provides for it

**Version B (Respondent):**
- Confirm the investigation has been completed
- State the outcome of each allegation as it relates to them
- Do not disclose the full investigation report
- Confirm what happens next (e.g. outcome hearing, no further action)
- Include right of appeal if applicable
- Maintain neutral tone throughout — do not use language implying guilt before any outcome hearing has taken place

### Language Standards

**Always use:**
- "Following a thorough investigation..."
- "Having considered all available evidence on the balance of probabilities..."
- "The investigation has concluded that..." (not "I have decided that...")
- "You have the right to appeal this outcome..."

**Never use:**
- "You are guilty of..."
- "It has been proven that..."
- "We are disappointed / shocked / concerned by your conduct..."
- "This is unacceptable behaviour..."

---

## Document 3 — Interview Question Framework

A tailored set of questions for each person to be interviewed, based on their role in the case. Not a rigid script — a structured framework the consultant adapts during the interview.

### Always produce three versions:
- Framework A — Complainant
- Framework B — Respondent  
- Framework C — Witness (one per witness, adapted to their specific knowledge)

### Structure for Each Framework

```
PART 1 — OPENING (standard for all)
PART 2 — BACKGROUND (role, relationship, general context)
PART 3 — CORE ALLEGATIONS (tailored per role)
PART 4 — EVIDENCE EXPLORATION (documents, witnesses, timeline)
PART 5 — CLOSING (anything to add, wellbeing check)
```

### Part 1 — Opening (include verbatim in all three versions)

> "Thank you for attending today. As I explained in my letter, I am [INVESTIGATING OFFICER] and I have been appointed to conduct this investigation independently. The purpose of today is to hear your account of events. This is an opportunity for you to share anything you feel is relevant.
>
> A few things to note: this conversation is confidential, which means I will not share the specific content of what you tell me with the parties, although I am required to share the key points of your account with relevant decision-makers as part of the process. You have the right to be accompanied by a trade union representative or work colleague. We will take notes / this meeting will be [recorded with your consent / summarised in a written record I will share with you for accuracy]. Do you have any questions before we start?"

### Part 2 — Background Questions (all versions)

```
- Can you describe your role and how long you have been in it?
- Can you describe your working relationship with [COMPLAINANT / RESPONDENT] — how closely do you work together, how long have you known them?
- How would you describe the general working environment in [TEAM / DEPARTMENT]?
```

### Part 3 — Core Questions by Role

**Complainant framework:**
```
- Can you tell me in your own words what happened? Please start from the beginning and take your time.
- When did this first occur? Was this a one-off incident or did it happen on more than one occasion?
- Can you describe specifically what was said or done? [probe for detail without leading]
- How did this make you feel at the time?
- Were there any witnesses present? If so, who?
- Did you say or do anything in response?
- Did you tell anyone about this at the time? If so, who and what did you tell them?
- Why did you decide to raise a formal complaint at this point?
- Is there anything else you would like me to know?
```

**Respondent framework:**
```
- I need to put the following allegation(s) to you and ask for your response: [read Allegation 1]
- What is your response to that allegation?
- Can you describe what happened from your perspective?
- Is there any context or background you think is important for me to understand?
- Are there any witnesses who could support your account?
- Is there any documentary evidence you would like me to consider?
- Have you had any previous discussions with [COMPLAINANT] or management about this matter?
- Is there anything else you would like to add?
```

**Witness framework (adapt per witness):**
```
- Can you describe your relationship with [COMPLAINANT] and [RESPONDENT]?
- Were you present on [DATE / PERIOD] when [general description of alleged events without prejudging]?
- Can you describe what you saw or heard?
- Did either party say or do anything specific that you recall?
- Have either party spoken to you about this matter since? If so, what did they say?
- Is there anything else you think is relevant that I should know?
```

### Part 5 — Closing (all versions)

```
- Is there anything else you would like to add that you feel is important?
- Is there anyone else you think I should speak to, or any evidence you think I should review?
- I will prepare a written record of today's conversation and share it with you for factual accuracy. You will have [X] days to review it and propose any amendments.
- Thank you for your time. I want to check in — how are you feeling? Are you aware of the support available to you? [signpost EAP / occupational health / wellbeing hub if relevant]
```

### Interview Notes Standard

**Source: Authoritative investigator questionnaire (15+ years experience). This standard is authoritative.**

```
Notes are taken contemporaneously during the interview.
Notes are NOT verbatim — do not attempt word-for-word transcription.
Notes MUST be an accurate summary of the discussion.
Notes should capture:
  → The substance of each question and answer
  → Key phrases or direct quotes where particularly significant
  → The tone or manner of responses where relevant to credibility
  → Any documents referred to during the interview
  → Any follow-up actions agreed

After the interview:
  → The Investigating Officer prepares a written record
  → The record is shared with the interviewee for accuracy confirmation
  → The interviewee has a defined period to review and propose amendments
  → Any amendments are noted — the IO retains the original and records any changes
  → The accuracy-confirmed record forms part of the case evidence

The interview record is not a transcript. It is an accurate,
contemporaneous summary. Both things must be true.
```

**Note for Document Agent:** When generating the Interview Framework, include a note at the top reminding the consultant of this standard. When generating the Witness Statement template, note that it should align with but not replace the interview record.

---

## Document 4 — Investigation Plan

Produced at the start of every case. Sets out the roadmap for the investigation.

### Required Structure

```
1. Case Reference and Overview
2. Allegations (numbered)
3. Applicable Policies
4. Key Issues to Determine
5. Evidence to be Gathered
6. Witnesses to be Interviewed (by role)
7. Proposed Interview Order and Rationale
8. Indicative Timeline
9. Escalation / Legal Involvement
10. Confidentiality and Data Protection Approach
11. Sign-off
```

### Proposed Interview Order Rule

Always interview in this sequence unless there is a documented reason to deviate:
1. Complainant (first — to understand the full allegation)
2. Respondent (second — to put allegations and hear response)
3. Witnesses with direct first-hand knowledge
4. Contextual or character witnesses (if needed)
5. Any follow-up interviews if new information emerges

Include the rationale: "This order is intended to ensure the Investigating Officer has a clear understanding of the allegations before putting them to the Respondent, and to minimise the risk of evidence contamination."

### Indicative Timeline Template

```
Week 1: Case review, investigation plan, send invitation letters
Week 2: Complainant interview
Week 2–3: Respondent interview
Week 3–4: Witness interviews
Week 4–5: Evidence review and analysis
Week 5–6: Report drafting
Week 6: Report review and handover
```

Adjust based on `complexity` field:
- Low: compress to 3–4 weeks
- Medium: 4–6 weeks (as above)
- High: 6–10 weeks
- Very High: 10–14 weeks, note that timeline is indicative and subject to review

---

## Document 5 — Invitation to Investigation Meeting Letter

The most frequent letter produced. Must be legally compliant and include all required information.

### Required Elements (all must be present)

```
□ Case reference
□ Purpose of the meeting (investigation interview — NOT disciplinary)
□ Date, time, and location / dial-in details
□ Minimum 48 hours notice — letter must be sent at least 48 hours before 
  the meeting date. Flag to consultant if timeline does not allow this.
□ Right to be accompanied (trade union rep or work colleague — state this explicitly)
□ What will be discussed (general description — do not disclose other parties' accounts)
□ Confidentiality requirement
□ Request to keep the matter confidential during the process
□ Who will be present (Investigating Officer + note-taker if applicable)
□ Instruction to contact [HRBP] if the date is not convenient
□ Support signpost (EAP / occupational health / wellbeing hub)
```

**Source: Authoritative investigator questionnaire confirms minimum 48 hours notice as standard practice. This is a mandatory element — not advisory.**

### Critical legal note

The letter must NOT state the outcome of the investigation in advance. It must NOT say "you are required to attend a disciplinary hearing." Investigation meetings are separate from disciplinary hearings. Getting this wrong is one of the most common sources of procedural challenge.

**Always include this paragraph:**
> "Please note that this is an investigation meeting, not a disciplinary hearing. The purpose is to gather information to assist the investigation. No decisions will be made at this meeting."

### Template

```
[DATE]

Private and Confidential

Dear [NAME — consultant inserts]

Re: Investigation Meeting — [CASE REFERENCE]

I am writing to invite you to an investigation meeting in connection with [brief description of matter — e.g. "a formal grievance raised within the organisation"].

Meeting details:
Date:     [DATE]
Time:     [TIME]
Location: [LOCATION / Teams link]

You have the right to be accompanied at this meeting by a trade union representative or a work colleague of your choice. Please let me know in advance if you intend to bring a companion so that I can make appropriate arrangements.

Please note that this is an investigation meeting, not a disciplinary hearing. The purpose is to gather information to assist the investigation. No decisions will be made at this meeting.

I would ask that you treat this matter with discretion and do not discuss the subject of this investigation with colleagues, as this could affect the integrity of the process.

If the date or time is not convenient, please contact [HRBP] as soon as possible so that an alternative can be arranged.

If you would like to speak to someone in confidence about how you are feeling, the Employee Assistance Programme is available [contact details — consultant inserts].

Yours sincerely,

[INVESTIGATING OFFICER]
[TITLE]
```

---

## Document 6 — Witness Statement Template

Used to formalise the account of a witness. Produced after the interview and shared with the witness for accuracy confirmation.

### Structure

```
WITNESS STATEMENT

Case Reference: [CASE REFERENCE]
Statement of: [WITNESS — role only at draft stage]
Date of Interview: [DATE]
Investigating Officer: [INVESTIGATING OFFICER]

1. Introduction
   [Witness's role, length of service, relationship to parties]

2. Account
   [Chronological account of what the witness said, written in 
   first person as if the witness is speaking. 
   E.g. "I have worked in the [DEPARTMENT] team for [X] years. 
   On [DATE], I was present when..."]

3. Key Points Confirmed
   [Bullet list of the key factual points the witness confirmed]

4. Amendments / Clarifications
   [Space for witness to note any corrections after review]

5. Declaration
   "I confirm that the above is an accurate record of the account 
   I gave during my investigation interview on [DATE] and that, 
   to the best of my knowledge, the information provided is true 
   and accurate."

   Signed: _________________ Date: _____________
   [WITNESS NAME — consultant inserts]
```

---

## Document 7 — Evidence Log

A structured register of all evidence gathered during the investigation.

### Required Columns

```
| Ref | Type | Description | Source | Date Obtained | Relevance | Location in Case File |
```

### Evidence Reference Convention

Use: `E001`, `E002`, `E003` etc. These references must be used consistently throughout the investigation report when citing evidence.

### Example Entries

```
| E001 | Email chain | Correspondence between [COMPLAINANT] and [RESPONDENT], [PERIOD] | IT / HR records request | [DATE] | Directly relevant to Allegation 1 | Appendix B |
| E002 | Witness statement | Account of [WITNESS A] | Investigation interview | [DATE] | Corroborates account of [COMPLAINANT] re: Allegation 2 | Appendix A |
| E003 | HR records | Attendance record for [RESPONDENT], [PERIOD] | HR system | [DATE] | Relevant to Allegation 3 | Appendix B |
```

### Evidence Reliability Assessment

For each item rated High / Medium / Low reliability. Include this column if `complexity` = High or Very High.

---

## Document 8 — Case Chronology

A timeline of key events, produced as both a narrative and a table.

### Table Format

```
| Date | Event | Source | Notes |
|---|---|---|---|
| [DATE] | Incident alleged by [COMPLAINANT] | Complainant interview, E001 | First of [X] alleged incidents |
| [DATE] | [COMPLAINANT] raises concern informally with [LINE MANAGER] | Complainant interview | Informal resolution attempted |
| [DATE] | Formal complaint submitted | HR records | Triggers investigation |
| [DATE] | Investigation commissioned | [DECIDING MANAGER] | [INVESTIGATING OFFICER] appointed |
```

**Rule:** Every date must be sourced — never include a date without noting where it came from.

---

## Document 9 — Case Summary (Management Brief)

A short, non-technical summary for senior management or governance forums. Maximum 1 page.

### Structure

```
CASE SUMMARY — CONFIDENTIAL

Case Reference:   [CASE REFERENCE]
Case Type:        [CASE TYPE]
Status:           [Open / Investigation complete / Outcome pending]
Date Opened:      [DATE]
Investigating Officer: [INVESTIGATING OFFICER]

Summary of Allegations:
[2–3 sentences — plain English, no legal jargon]

Current Status:
[Where the case is in the process]

Key Risks:
[Any legal, reputational, or wellbeing risks — flag clearly]

Anticipated Completion:
[Date or timeframe]

Escalation Required:
[Yes / No — and brief reason if Yes]
```

---

## Document 10 — Appeal Correspondence

**Used in complex cases where a formal appeal is lodged following an outcome.**

Appeal correspondence includes two documents:

**Appeal Acknowledgement Letter** — sent when an appeal is received:
```
□ Confirm appeal received and reference number
□ State the grounds of appeal as received (do not comment on merit)
□ Confirm the appeal panel or appeal manager appointed
□ Confirm date and process for appeal hearing
□ Confirm right to be accompanied
□ Confirm minimum 48 hours notice will be given for the appeal hearing
□ Signpost support (EAP / wellbeing hub)
```

**Appeal Outcome Letter** — sent after the appeal hearing:
```
□ Confirm the appeal hearing took place
□ State the grounds of appeal considered
□ State the appeal decision: Upheld / Not Upheld / Partially Upheld
□ If upheld: state what changes to the original outcome are made
□ If not upheld: confirm original outcome stands
□ Confirm this decision is final (unless further policy provisions exist)
□ Signpost support
```

**Note:** Appeal correspondence is produced in complex cases. Flag to consultant that appeal correspondence requires careful legal review before issue.

---

## Document 11 — Senior Leadership / Governance Brief

**Used in complex, high-risk, or prolonged cases to keep senior stakeholders informed without breaching investigation confidentiality.**

```
SENIOR LEADERSHIP BRIEF — STRICTLY CONFIDENTIAL
NOT FOR DISTRIBUTION BEYOND NAMED RECIPIENTS

Case Reference:     [CASE REFERENCE]
Prepared by:        [INVESTIGATING OFFICER]
Date:               [DATE]
Recipients:         [Senior HR / Legal / Board — as appropriate]

PURPOSE OF THIS BRIEF
[One sentence — why this brief is being produced]

CASE OVERVIEW
[3–4 sentences — nature of allegation, parties by role, timeline]

CURRENT STATUS
[Where the investigation is — phase, key milestones completed]

KEY RISKS
[Legal / reputational / regulatory / wellbeing risks — plain English]

TIMELINE
[Expected completion date — and any factors that may affect this]

ACTIONS REQUIRED FROM RECIPIENTS
[Specific decisions or approvals required, if any]

NEXT UPDATE
[When the next brief will be issued]
```

**Tone:** Executive. Factual. No investigation conclusions — this is a status brief, not a findings document.

---

## Output Format Guidance

**Source: Authoritative investigator questionnaire confirms multiple output formats are used in practice.**

The Document Agent generates document text. The format in which documents are saved and issued depends on their purpose:

```
Word (.docx)  — default for all draft documents
              — Investigation Reports, Investigation Plans,
                Interview Frameworks, Witness Statements

PDF           — for formal letters ready to issue
              — Invitation Letters (when finalised and approved)
              — Outcome Letters (when finalised and approved)
              — Appeal Letters (when finalised and approved)
              — Converts from approved .docx — consultant action

Excel (.xlsx) — Evidence Log, Case Chronology (tracker format)
              — Case tracker / dashboard
              — Built by Case Management Agent, not Document Agent

PowerPoint    — Senior Leadership Briefs when presented in meetings
              — Built by consultant from Case Summary content
              — Not generated by Document Agent
```

**Rule:** The Document Agent generates content. Format conversion (docx → PDF) is a consultant action after approval. Flag the intended format on each document so the consultant knows which need converting before issue.

---

## Language and Tone Standards

These apply across all documents. Validated against the standards described by all three investigators.

### Always use:
- Plain English — short sentences, active voice
- Neutral attribution: "It was alleged that...", "The evidence suggests...", "On the balance of probabilities..."
- Role-based references in drafts: [COMPLAINANT], [RESPONDENT], [WITNESS A]
- Precise dates and timeframes (placeholders at draft stage)
- UK English spelling throughout (organisation, recognise, practise/practice, etc.)

### Never use:
- Emotive adjectives: shocking, appalling, distressing, horrific
- Certainty language before conclusions: clearly, obviously, undoubtedly, it is evident
- First-person opinion: "I think", "I feel", "In my view" — use "The evidence indicates"
- Character attacks: "dishonest", "manipulative", "unstable"
- Outcome language in findings: "guilty", "misconduct is proven", "should be dismissed"
- Acronyms without explanation on first use

### Tone calibration by document:

| Document | Tone |
|---|---|
| Investigation Report | Formal, analytical, impartial |
| Outcome Letter | Formal, clear, empathetic but measured |
| Invitation Letter | Professional, informative, non-threatening |
| Interview Framework | Structured but conversational — questions should feel natural |
| Case Summary | Concise, factual, executive-level |

---

## Escalation Triggers

If any of the following are present in the case inputs, flag to the Coordinator Agent before generating documents. The consultant must be informed and legal advice may be required.

```
□ Case type = Whistleblowing / Protected Disclosure
□ legal_involved = true
□ Allegations involve a protected characteristic (age, disability, race, religion, sex, sexual orientation, pregnancy, marriage)
□ Senior leadership figures involved (Director level or above)
□ Cross-border elements (different jurisdictions)
□ Parallel criminal investigation indicated
□ Complainant has indicated they are seeking legal advice
□ Media or regulatory risk indicated
```

When escalation is flagged, prepend this notice to all documents:

> **⚠ ESCALATION FLAG — CONSULTANT REVIEW REQUIRED BEFORE PROCEEDING**
> This case has been flagged for escalation. Please review the case details and confirm whether legal input is required before progressing the investigation or issuing any documents.

---

## Consultant Review Prompt

Append to the end of every document generated. Never omit this.

```
---
CONSULTANT REVIEW CHECKLIST — [DOCUMENT NAME]

Before approving this document, please confirm:

□ All [PLACEHOLDER] fields have been replaced with accurate information
□ All dates have been verified against the case file
□ The tone is appropriate for the recipient and the sensitivity of the case
□ No information has been included that should not be shared with this recipient
□ The document reflects your professional judgment and any case-specific nuances
□ If this document is an investigation report: all allegations are addressed and 
  conclusions are based on your assessment of the evidence
□ If this document is an outcome letter: no sanction details for one party 
  have been included in the other party's letter

Sign off: _________________________ Date: __________
---
```

---

## Dependencies

- **Coordinator Agent SKILL** — provides case inputs and case type routing to this agent
- **Case Management Agent SKILL** — handles file storage and naming after documents are approved
- **Quality Agent SKILL** — runs secondary review on Investigation Reports and Outcome Letters before returning to consultant
- **docx SKILL** — handles the technical generation of .docx files from the content this agent produces

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0 | February 2026 | Initial version — derived from three investigator questionnaire responses |
| 1.1 | March 2026 | Updated from authoritative questionnaire (15+ years experience): added Executive Summary as mandatory report section, updated conclusions to three authoritative verdicts (Substantiated / Not Substantiated / Inconclusive), added 48-hour minimum notice for invitation letters, authoritative interview notes standard (not verbatim but accurate summary), added appeal correspondence and senior briefing as document types, added output format guidance (Word/PDF/Excel/PowerPoint) |

*Next review: after first live case testing.*
