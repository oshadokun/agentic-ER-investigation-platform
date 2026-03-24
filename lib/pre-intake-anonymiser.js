'use strict';
/**
 * lib/pre-intake-anonymiser.js
 *
 * Pre-intake anonymisation pass for assisted intake.
 *
 * Applies heuristic, pattern-based PII detection and replacement on free-form
 * referral text BEFORE it is sent to Claude. This is a best-effort pass.
 * It does not replace the investigator's review — it reduces the likelihood
 * of raw identifying information reaching the Claude API.
 *
 * SECURITY CONTRACT:
 *   - Raw input is NEVER persisted by this module.
 *   - The entity log records COUNTS only — never the actual detected values.
 *   - If residualPiiDetected is true, the Claude call MUST be blocked by the
 *     caller (api/intake-assist.js). This module enforces nothing itself.
 *
 * POST-RESPONSE CHECK:
 *   checkOutputForPii(parsed) scans Claude's structured JSON output for
 *   surviving PII-like patterns and returns flagged field paths. It does
 *   NOT block — it flags only, so the investigator can review in the UI.
 *
 * Known false positives (Title Case detection):
 *   - Geographic proper nouns not in the allowlist (e.g. "New York" if
 *     "New" or "York" are absent from the list)
 *   - Role combinations whose component words are not in the allowlist
 *   - Proper nouns from non-English contexts that happen to be Title Case
 *
 * Known false negatives (patterns not caught):
 *   - Names written in ALL CAPS (e.g. "JOHN SMITH")
 *   - Names written in lowercase (e.g. "john smith")
 *   - Single-word surnames without an honorific prefix
 *   - Organisation names without a recognised legal suffix
 *   - Non-UK phone number formats
 *   - Dates of birth in common formats (dd/mm/yyyy)
 *
 * The allowlist (TITLE_CASE_ALLOWLIST) is intentionally broad and is the
 * primary mechanism for reducing false positives. Add entries as needed
 * for new organisational contexts or case types — see the comment block
 * below the definition.
 */

// ── Title Case allowlist ─────────────────────────────────────────────────────
//
// A sequence of 2–3 consecutive Title Case words is treated as a candidate
// person name UNLESS any word in the sequence appears in this set.
//
// Rationale: if ANY word in the sequence is a known ER term, role, month,
// day, or common English word, the sequence is unlikely to be a name.
//
// TO EXTEND: add words in alphabetical order within the relevant category.
// Do NOT add genuine given names or surnames — that defeats the purpose.
//
const TITLE_CASE_ALLOWLIST = new Set([
  // ── Common English words appearing Title Case ──────────────────────────
  'A', 'An', 'The', 'This', 'That', 'These', 'Those', 'There', 'Then', 'Than',
  'And', 'But', 'For', 'Nor', 'Yet', 'So', 'Or', 'As', 'At', 'By',
  'In', 'Of', 'On', 'To', 'Up', 'With', 'From', 'Into', 'About', 'Above',
  'After', 'Before', 'During', 'Since', 'While', 'Until', 'Unless', 'Between',
  'He', 'She', 'They', 'We', 'You', 'It', 'One', 'Who', 'What',
  'His', 'Her', 'Our', 'Their', 'Your', 'Its', 'My',
  'Where', 'When', 'Why', 'How',
  'Please', 'Thank', 'Dear', 'Regards', 'Sincerely', 'Yours', 'Kind',
  'Further', 'Also', 'However', 'Therefore', 'Regarding', 'Re',
  'Following', 'Above', 'Below', 'Attached', 'Enclosed', 'Herewith',
  'Is', 'Are', 'Was', 'Were', 'Be', 'Been', 'Being', 'Have', 'Has',
  'Do', 'Does', 'Did', 'Will', 'Would', 'Could', 'Should', 'May',
  'More', 'Some', 'Any', 'All', 'Both', 'Each', 'Every', 'Either', 'Neither',
  'Same', 'Other', 'Another', 'Such', 'No', 'Not',
  'Good', 'Best', 'Better', 'Bad', 'New', 'Old', 'Full', 'Part',
  'High', 'Low', 'Key', 'Main', 'Major', 'Minor', 'General', 'Special',
  'Current', 'Previous', 'Recent', 'Interim', 'Acting', 'Temporary', 'Permanent',
  'First', 'Second', 'Third', 'Last', 'Next', 'Final',
  'Internal', 'External', 'Formal', 'Informal', 'Joint', 'Independent',

  // ── Email header words ─────────────────────────────────────────────────
  'From', 'Sent', 'Date', 'Subject', 'Cc', 'To',

  // ── Days of the week ───────────────────────────────────────────────────
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',

  // ── Months ────────────────────────────────────────────────────────────
  'January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December',

  // ── ER process and case type terms ────────────────────────────────────
  'Grievance', 'Disciplinary', 'Whistleblowing', 'Discrimination',
  'Investigation', 'Investigator', 'Investigating', 'Investigated',
  'Complainant', 'Respondent', 'Witness', 'Claimant', 'Appellant',
  'Panel', 'Hearing', 'Appeal', 'Outcome', 'Finding', 'Decision', 'Conclusion',
  'Absence', 'Capability', 'Performance', 'Conduct', 'Misconduct',
  'Bullying', 'Harassment', 'Equality', 'Diversity', 'Inclusion',
  'Allegation', 'Allegations', 'Complaint', 'Counter', 'Referral',
  'Protected', 'Disclosure', 'Whistleblower',
  'Acas', 'Tribunal', 'Employment', 'Settlement', 'Conciliation',
  'Counter-Allegation', 'Multi-Party', 'Complex', 'Urgent',
  'Interim', 'Suspension', 'Dismissal', 'Warning', 'Sanction',
  'Reasonable', 'Reasonable Adjustments', 'Adjustments',

  // ── Job roles and titles ──────────────────────────────────────────────
  'Manager', 'Director', 'Officer', 'Advisor', 'Adviser', 'Consultant',
  'Specialist', 'Coordinator', 'Executive', 'President', 'Assistant',
  'Associate', 'Deputy', 'Principal', 'Lead', 'Head', 'Chief',
  'Senior', 'Junior', 'Line', 'Team', 'Regional', 'National', 'Global',
  'Human', 'Resources', 'Relations', 'People', 'Talent', 'Workforce',
  'Business', 'Partner', 'Employee', 'Employer', 'Worker', 'Staff',
  'Supervisor', 'Administrator', 'Analyst', 'Controller', 'Trainer',
  'Recruiter', 'Representative', 'Agent', 'Steward',

  // ── Departments and organisational units ─────────────────────────────
  'Finance', 'Marketing', 'Sales', 'Operations', 'Legal', 'Compliance',
  'Technology', 'Engineering', 'Product', 'Customer', 'Service',
  'Payroll', 'Procurement', 'Logistics', 'Commercial', 'Strategy',
  'Audit', 'Risk', 'Governance', 'Security', 'Facilities', 'Estates',
  'Communications', 'Corporate', 'Executive',

  // ── Organisational nouns ──────────────────────────────────────────────
  'Company', 'Organisation', 'Organization', 'Department', 'Division',
  'Branch', 'Office', 'Site', 'Unit', 'Group', 'Board', 'Committee',
  'Institution', 'Agency', 'Authority', 'Council', 'Trust', 'Foundation',
  'Charity', 'Partnership', 'Practice', 'Firm',

  // ── Policy and legal terms ────────────────────────────────────────────
  'Policy', 'Procedure', 'Process', 'Act', 'Contract', 'Terms',
  'Agreement', 'Regulation', 'Guidance', 'Framework', 'Code',
  'Standard', 'Requirement', 'Obligation', 'Duty', 'Right', 'Rights',
  'Section', 'Clause', 'Schedule', 'Appendix', 'Addendum',

  // ── UK locations (common) ─────────────────────────────────────────────
  'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh',
  'Bristol', 'Cardiff', 'Belfast', 'Sheffield', 'Liverpool', 'Newcastle',
  'Nottingham', 'Leicester', 'Coventry', 'Bradford', 'Stoke', 'Wolverhampton',
  'York', 'Oxford', 'Cambridge', 'Portsmouth', 'Southampton', 'Brighton',
  'North', 'South', 'East', 'West', 'Central', 'Greater', 'Upper', 'Lower',
  'Inner', 'Outer', 'United', 'Great', 'Northern', 'Southern', 'Western', 'Eastern',
  'Kingdom', 'England', 'Scotland', 'Wales', 'Ireland', 'Britain', 'British',
  'Street', 'Road', 'Avenue', 'Lane', 'Drive', 'Court', 'Park', 'Close',
  'House', 'Building', 'Floor', 'Suite', 'Campus', 'Centre', 'Center',
  'Bay', 'Hill', 'Vale', 'View', 'Green', 'Cross', 'Church', 'Market', 'Gate',
]);

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply pre-intake anonymisation to free-form referral text.
 *
 * Raw text is never logged or persisted by this function.
 * The entity log contains counts only — never raw detected values.
 *
 * @param {string} rawText
 * @returns {{
 *   anonymisedText: string,
 *   entityLog: {
 *     persons: number,
 *     orgs: number,
 *     emails: number,
 *     phones: number,
 *     postcodes: number,
 *     ni_numbers: number
 *   },
 *   residualPiiDetected: boolean
 * }}
 * @throws {Error} If input is empty or not a string
 */
function anonymise(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Pre-intake anonymiser received empty or invalid input.');
  }

  const counters = {
    persons:    0,
    orgs:       0,
    emails:     0,
    phones:     0,
    postcodes:  0,
    ni_numbers: 0,
  };

  // Order matters: most-specific patterns first to prevent partial mangling.
  let text = rawText;
  text = _replaceNiNumbers(text,              counters);
  text = _replaceEmails(text,                 counters);
  text = _replacePhones(text,                 counters);
  text = _replacePostcodes(text,              counters);
  text = _replaceOrgs(text,                   counters);
  text = _replaceNamesWithHonorifics(text,    counters);
  text = _replaceTitleCaseNames(text,         counters);

  const residualPiiDetected = _hasResidualPii(text);

  return {
    anonymisedText: text,
    entityLog:      { ...counters },
    residualPiiDetected,
  };
}

/**
 * Scan Claude's structured JSON output for surviving PII-like patterns.
 *
 * Returns an array of dot-notation field paths where patterns were found.
 * The result is advisory — it does NOT block; the UI must surface these
 * fields for investigator review.
 *
 * @param {object} parsed - Parsed JSON object from Claude
 * @returns {string[]} Field paths with suspected PII
 */
function checkOutputForPii(parsed) {
  const flaggedFields = [];
  const SUSPECT = [
    /[A-Za-z0-9]@[A-Za-z]/,                             // email
    /\b07\d{3}[\s\-.]?\d{3}[\s\-.]?\d{3}\b/,           // UK mobile
    /\+44[\s\-.]?\d/,                                    // international UK
    /\b0[1238]\d{2,3}[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}\b/, // landline
    /\b[A-Z]{2}\s*\d{2}\s*\d{2}\s*\d{2}\s*[A-D]\b/i,  // NI number
    /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/,           // postcode
  ];

  function scan(value, path) {
    if (typeof value === 'string') {
      if (SUSPECT.some(p => p.test(value))) flaggedFields.push(path);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => scan(item, `${path}[${i}]`));
    } else if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        scan(v, path ? `${path}.${k}` : k);
      }
    }
  }

  scan(parsed, '');
  return flaggedFields;
}

// ── Replacement functions ────────────────────────────────────────────────────

function _replaceNiNumbers(text, c) {
  // Pattern: two letters, six digits, one letter A–D, optional spaces
  return text.replace(
    /\b([A-CEGHJ-PR-TW-Z]{2})\s*(\d{2})\s*(\d{2})\s*(\d{2})\s*([A-D])\b/gi,
    () => { c.ni_numbers++; return `[NI_NUMBER ${c.ni_numbers}]`; }
  );
}

function _replaceEmails(text, c) {
  return text.replace(
    /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    () => { c.emails++; return `[EMAIL ${c.emails}]`; }
  );
}

function _replacePhones(text, c) {
  // UK mobile: 07xxx xxxxxx (with optional separators)
  text = text.replace(
    /\b07\d{3}[\s\-.]?\d{3}[\s\-.]?\d{3}\b/g,
    () => { c.phones++; return `[PHONE ${c.phones}]`; }
  );
  // UK landline: 01xxx, 02x, 03xx, 08xx formats
  text = text.replace(
    /\b0[1238]\d{2,3}[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}\b/g,
    () => { c.phones++; return `[PHONE ${c.phones}]`; }
  );
  // International UK: +44
  text = text.replace(
    /\+44[\s\-.]?\d{2,4}[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}\b/g,
    () => { c.phones++; return `[PHONE ${c.phones}]`; }
  );
  return text;
}

function _replacePostcodes(text, c) {
  // UK postcode formats: AN NAA, ANN NAA, AAN NAA, AANN NAA
  // Optional space between the outward and inward codes
  return text.replace(
    /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/gi,
    () => { c.postcodes++; return `[POSTCODE ${c.postcodes}]`; }
  );
}

function _replaceOrgs(text, c) {
  // Organisation names: Title Case words followed by a legal suffix
  return text.replace(
    /\b[A-Z][A-Za-z&,\s]{0,50}(?:Ltd|Limited|PLC|plc|LTD|Inc|LLC|LLP|Incorporated|Corp|Corporation)\b/g,
    () => { c.orgs++; return `[ORG ${c.orgs}]`; }
  );
}

function _replaceNamesWithHonorifics(text, c) {
  // Honorific followed by 1–2 Title Case words: "Mr John Smith", "Dr Jones"
  return text.replace(
    /\b(Mr|Mrs|Ms|Miss|Dr|Prof|Rev|Sir|Dame|Lord|Lady)\.?\s+([A-Z][a-z]{1,20})(?:\s+([A-Z][a-z]{1,20}))?\b/g,
    () => { c.persons++; return `[PERSON ${c.persons}]`; }
  );
}

function _replaceTitleCaseNames(text, c) {
  // Match sequences of exactly 2–3 consecutive Title Case words.
  // Each word: one uppercase letter followed by 1–20 lowercase letters.
  // Skip the sequence if ANY word is in the allowlist.
  return text.replace(
    /\b([A-Z][a-z]{1,20})(?:\s+([A-Z][a-z]{1,20}))(?:\s+([A-Z][a-z]{1,20}))?\b/g,
    (match, w1, w2, w3) => {
      const words = [w1, w2, w3].filter(Boolean);
      if (words.some(w => TITLE_CASE_ALLOWLIST.has(w))) return match;
      c.persons++;
      return `[PERSON ${c.persons}]`;
    }
  );
}

// ── Residual PII check ───────────────────────────────────────────────────────

/**
 * Scan text for obvious surviving PII patterns after replacement.
 * If any match, the Claude call must be blocked by the caller.
 */
function _hasResidualPii(text) {
  return [
    /[A-Za-z0-9]@[A-Za-z]/,           // surviving email (@ between word chars)
    /\b07\d{9}\b/,                     // compact UK mobile
    /\+44\d{9,10}/,                    // compact international UK
    /\b[A-Z]{2}\d{6}[A-D]\b/i,        // compact NI number
    /\b[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}\b/, // compact postcode (no space)
  ].some(p => p.test(text));
}

module.exports = { anonymise, checkOutputForPii, TITLE_CASE_ALLOWLIST };
