'use strict';
/**
 * agents/intake-assist.js
 *
 * Assisted intake executor.
 *
 * Receives anonymised referral text (pre-processed by api/intake-assist.js)
 * and calls Claude to produce a structured intake suggestion.
 *
 * SECURITY CONTRACT:
 *   - This function only ever receives anonymised text. Raw referral content
 *     must have been discarded before this function is called.
 *   - This function does NOT create any case record, DB row, folder, or
 *     audit event. Case creation happens only via POST /api/cases after
 *     explicit investigator submission.
 *
 * RETRY POLICY:
 *   - One Claude call is made. If JSON parsing fails, exactly one retry is
 *     attempted with a reinforced instruction.
 *   - If both attempts fail, ASSIST_FAILED is returned with canRetry: true
 *     and fallbackToManual: true.
 *
 * @param {string} anonymisedText - Anonymised referral text (no raw PII)
 * @param {object} entityLog      - Count-only log from pre-intake anonymiser
 * @param {object} [deps]         - Dependency overrides (for testing)
 * @param {Function} [deps.callClaude] - Override for lib/anthropic callClaude
 * @returns {Promise<object>} Job result object
 */

const { callClaude: _defaultCallClaude } = require('../lib/anthropic');
const { checkOutputForPii }              = require('../lib/pre-intake-anonymiser');

const SKILL_FILE = 'SKILL_intake_assist.md';

async function assistIntake(anonymisedText, entityLog, { callClaude = _defaultCallClaude } = {}) {
  const prompt =
    'Please structure the following anonymised referral text into the intake JSON schema:\n\n' +
    anonymisedText;

  // ── First attempt ─────────────────────────────────────────────────────────
  let raw;
  try {
    raw = await callClaude(SKILL_FILE, prompt);
  } catch (err) {
    console.error('[intake-assist] callClaude failed — status:', err.status, '| message:', err.message);
    return _fail('Could not reach the AI service. Please try again or fall back to manual intake.');
  }

  let parsed = _tryParseJson(raw);

  // ── One controlled retry on parse failure ─────────────────────────────────
  if (!parsed) {
    const retryPrompt =
      prompt +
      '\n\nCRITICAL: Your previous response could not be parsed as JSON. ' +
      'Return ONLY a valid JSON object. Begin with { and end with }. No other text.';
    let retryRaw;
    try {
      retryRaw = await callClaude(SKILL_FILE, retryPrompt);
    } catch (err) {
      return _fail('The AI service became unavailable during a retry. Please try again or use manual intake.');
    }
    parsed = _tryParseJson(retryRaw);
  }

  if (!parsed) {
    return _fail(
      'The AI returned a response that could not be parsed as valid JSON after two attempts. ' +
      'Please try again with a shorter or clearer input, or fall back to manual intake.'
    );
  }

  // ── Schema sanity check ───────────────────────────────────────────────────
  if (!parsed.extracted_fields || typeof parsed.extracted_fields !== 'object') {
    return _fail(
      'The AI response did not match the expected intake structure. ' +
      'Please try again or fall back to manual intake.'
    );
  }

  // ── Post-response PII check (condition 9) ─────────────────────────────────
  // Flags fields in the output that contain surviving PII-like patterns.
  // Does NOT block — returns advisory flags for investigator review.
  const output_pii_flags = checkOutputForPii(parsed);

  return {
    status:               'ASSIST_COMPLETE',
    suggestions:          parsed.extracted_fields,
    missing_fields:       Array.isArray(parsed.missing_fields)       ? parsed.missing_fields       : [],
    low_confidence_fields: Array.isArray(parsed.low_confidence_fields) ? parsed.low_confidence_fields : [],
    entity_log:           entityLog,
    output_pii_flags,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempt to parse a Claude response string as JSON.
 *
 * Steps applied in order:
 *   1. Trim whitespace from the raw response.
 *   2. Reject HTML responses immediately (triggers the caller's retry logic).
 *   3. Strip markdown code fences (```json...``` or ```...```).
 *   4. Attempt direct JSON.parse() on the cleaned string.
 *   5. Fall back to extracting the first {...} block and parsing that.
 *
 * Returns null on any failure so the caller triggers its existing retry.
 * Logs a safe 200-character snippet on failure for debugging visibility.
 * Never logs the full response — it may contain anonymised referral content.
 */
function _tryParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();

  // Step 2: Reject HTML early — do not attempt to parse browser error pages
  if (/<html|<!DOCTYPE|<body/i.test(trimmed)) {
    console.warn('[intake-assist] HTML response received instead of JSON. Snippet:', trimmed.slice(0, 200));
    return null;
  }

  // Step 3: Strip markdown code fences (```json ... ``` or ``` ... ```)
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  // Step 4: Direct parse on cleaned string
  try {
    return JSON.parse(cleaned);
  } catch (_) { /* fall through */ }

  // Step 5: Extract first {...} block (handles leading/trailing prose)
  // Only the first recoverable object is used — multiple objects are not merged.
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (_) { /* fall through */ }
  }

  console.warn('[intake-assist] Failed to parse JSON response. Snippet:', trimmed.slice(0, 200));
  return null;
}

function _fail(message) {
  return {
    status:          'ASSIST_FAILED',
    error:           message,
    canRetry:        true,
    fallbackToManual: true,
  };
}

module.exports = { assistIntake };
