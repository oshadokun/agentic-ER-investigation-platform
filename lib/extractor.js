'use strict';
/**
 * lib/extractor.js
 *
 * Local-only text extraction for assisted intake.
 *
 * Supported inputs:
 *   - Pasted plain text (no filename or no extension)
 *   - .txt  — returned as-is after line-ending normalisation
 *   - .md   — Markdown syntax stripped; text content preserved
 *   - .eml  — MIME headers stripped; text/plain body extracted;
 *             quoted-printable decoded; multipart handled
 *
 * SECURITY CONTRACT:
 *   Raw content is NEVER written to disk, database, logs, or audit events.
 *   It exists in memory only for the duration of this call.
 *   The caller (api/intake-assist.js) must discard it after anonymisation.
 *
 * No external dependencies. Node.js built-ins only.
 */

const SUPPORTED_EXTENSIONS = new Set(['', '.txt', '.md', '.eml']);

/**
 * Extract plain text from raw input.
 *
 * @param {string} rawText    - Raw text content (client-side file read or paste)
 * @param {string} [filename] - Original filename, used only for format detection
 * @returns {{ text: string, sourceFormat: 'paste'|'txt'|'md'|'eml' }}
 * @throws {Error} On empty input or unsupported extension
 */
function extract(rawText, filename = '') {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new Error(
      'No text content provided. Paste referral text or upload a supported file (.txt, .md, .eml).'
    );
  }

  const ext = filename && filename.includes('.')
    ? '.' + filename.split('.').pop().toLowerCase()
    : '';

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file format "${ext}". Supported formats are: .txt, .md, .eml, or pasted text.`
    );
  }

  if (ext === '.eml') {
    return { text: _extractFromEml(rawText), sourceFormat: 'eml' };
  }

  if (ext === '.md') {
    return { text: _extractFromMarkdown(rawText), sourceFormat: 'md' };
  }

  return { text: _normalise(rawText), sourceFormat: ext === '.txt' ? 'txt' : 'paste' };
}

// ── Format handlers ──────────────────────────────────────────────────────────

/**
 * Strip MIME headers from an .eml file and return the plain-text body.
 * Handles: single-part, multipart/alternative, quoted-printable encoding.
 * Attachments are ignored — text bodies only.
 */
function _extractFromEml(raw) {
  const text = _normalise(raw);

  // Split headers from body at first blank line
  const split = text.indexOf('\n\n');
  if (split === -1) return text.trim();

  const headers = text.slice(0, split);
  const body    = text.slice(split + 2);

  // Detect multipart boundary
  const boundaryMatch = headers.match(
    /Content-Type:\s*multipart\/[^;]+;\s*boundary="?([^"\r\n]+)"?/i
  );
  if (boundaryMatch) {
    return _extractMultipartTextPlain(body, boundaryMatch[1].trim());
  }

  // Single-part: decode if needed
  const encodingMatch = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
  const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : '';

  if (encoding === 'quoted-printable') {
    return _decodeQuotedPrintable(body).trim();
  }

  return body.trim();
}

/**
 * Extract the first text/plain part from a multipart MIME body.
 * Falls back to raw body if no text/plain part is found.
 */
function _extractMultipartTextPlain(body, boundary) {
  const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts   = body.split(new RegExp(`--${escaped}(?:--)?`));

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '--') continue;

    const partSplit = trimmed.indexOf('\n\n');
    if (partSplit === -1) continue;

    const partHeaders = trimmed.slice(0, partSplit);
    const partBody    = trimmed.slice(partSplit + 2);

    if (/Content-Type:\s*text\/plain/i.test(partHeaders)) {
      const encMatch = partHeaders.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
      const enc = encMatch ? encMatch[1].trim().toLowerCase() : '';
      return enc === 'quoted-printable'
        ? _decodeQuotedPrintable(partBody).trim()
        : partBody.trim();
    }
  }

  return body.trim();
}

/**
 * Strip Markdown syntax characters, preserving textual content.
 */
function _extractFromMarkdown(raw) {
  return _normalise(raw)
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/\*\*(.+?)\*\*/gs, '$1')         // bold
    .replace(/\*(.+?)\*/gs, '$1')             // italic
    .replace(/`{3}[\s\S]*?`{3}/g, '')         // fenced code blocks
    .replace(/`[^`]*`/g, '')                  // inline code
    .replace(/^\s*[-*+]\s+/gm, '')            // bullet lists
    .replace(/^\s*\d+\.\s+/gm, '')            // ordered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → link text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')     // images → removed
    .replace(/^[-_*]{3,}\s*$/gm, '')          // horizontal rules
    .replace(/\n{3,}/g, '\n\n')               // collapse extra blank lines
    .trim();
}

/**
 * Minimal quoted-printable decoder.
 */
function _decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Normalise line endings to LF.
 */
function _normalise(str) {
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

module.exports = { extract };
