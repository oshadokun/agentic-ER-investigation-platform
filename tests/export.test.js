'use strict';
/**
 * tests/export.test.js
 *
 * Tests for the DOCX (lib/converter-docx.js) and PDF (lib/converter-pdf.js)
 * export converters. Both accept plain text and return a Buffer.
 *
 * These tests verify:
 *   - The returned value is a non-empty Buffer
 *   - DOCX output begins with the PK magic bytes (ZIP container)
 *   - PDF output begins with the %PDF magic bytes
 *   - Different content types (plain text, headings, bullets, blank lines,
 *     decorative rules, numbered sections) do not throw
 *   - Empty string input returns a valid (minimal) document
 *   - Very long documents do not throw
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { convertToDocx } = require('../lib/converter-docx');
const { convertToPdf }  = require('../lib/converter-pdf');

// ── Shared fixture text ───────────────────────────────────────────────────────

const FULL_DOCUMENT = `
INVESTIGATION REPORT

Case Reference: ER-2026-0001-GR

═══════════════════════════════════════

1. Executive Summary

This report sets out the findings of the investigation into the allegations raised
by [COMPLAINANT] against [RESPONDENT]. The investigation was conducted in
accordance with the organisation's Grievance Policy.

2. Background

The complaint was received on 15 January 2026. [COMPLAINANT] alleged that
[RESPONDENT] had engaged in conduct amounting to a grievance.

3. Methodology

- Document review
- Witness interviews
- Review of CCTV footage

4. Findings

Having considered all of the evidence available, the investigator finds as follows.

The allegations are SUBSTANTIATED.

5. Recommendations

It is recommended that the matter be referred to a formal disciplinary hearing.

Yours sincerely,
[INVESTIGATOR]
`.trim();

const MINIMAL_LETTER = `Dear [COMPLAINANT],

We write to invite you to an investigation meeting.

The meeting will take place on [DATE] at [TIME] at [LOCATION].

You have the right to be accompanied by a work colleague or trade union representative.

Yours sincerely,
[INVESTIGATOR]`;

// ── DOCX tests ────────────────────────────────────────────────────────────────

describe('DOCX converter (convertToDocx)', () => {
  test('returns a non-empty Buffer', async () => {
    const buf = await convertToDocx(FULL_DOCUMENT, 'Investigation Report', 'ER-2026-0001-GR');
    assert.ok(Buffer.isBuffer(buf), 'Should return a Buffer');
    assert.ok(buf.length > 0, 'Buffer should not be empty');
  });

  test('output starts with PK magic bytes (ZIP/DOCX container)', async () => {
    const buf = await convertToDocx(FULL_DOCUMENT, 'Test', 'ER-2026-0001-GR');
    // DOCX files are ZIP archives; all ZIP files start with 0x50 0x4B ('PK')
    assert.equal(buf[0], 0x50, 'First byte should be 0x50 (P)');
    assert.equal(buf[1], 0x4B, 'Second byte should be 0x4B (K)');
  });

  test('produces a document larger than a trivial buffer', async () => {
    const buf = await convertToDocx(FULL_DOCUMENT, 'Test', 'ER-2026-0001-GR');
    // A real DOCX with content is always > 2KB
    assert.ok(buf.length > 2048, `Buffer too small: ${buf.length} bytes`);
  });

  test('handles empty string without throwing', async () => {
    const buf = await convertToDocx('', 'Empty', 'ER-2026-0000-GR');
    assert.ok(Buffer.isBuffer(buf) && buf.length > 0, 'Should produce a valid (minimal) DOCX for empty input');
  });

  test('handles plain single-line text', async () => {
    const buf = await convertToDocx('Hello world.', 'Simple', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles ALL-CAPS heading lines', async () => {
    const text = 'EXECUTIVE SUMMARY\n\nSome body text here.';
    const buf = await convertToDocx(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles numbered section headers', async () => {
    const text = '1. Introduction\n\nThis is the introduction.';
    const buf = await convertToDocx(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles bullet points (- prefix)', async () => {
    const text = '- First item\n- Second item\n- Third item';
    const buf = await convertToDocx(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles bullet points (• prefix)', async () => {
    const text = '• First item\n• Second item';
    const buf = await convertToDocx(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles decorative rule lines (═ characters)', async () => {
    const text = 'Title\n\n════════════════════\n\nBody text.';
    const buf = await convertToDocx(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles blank lines (vertical spacing)', async () => {
    const text = 'Paragraph one.\n\n\nParagraph two after extra blank lines.';
    const buf = await convertToDocx(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles a realistic outcome letter', async () => {
    const buf = await convertToDocx(MINIMAL_LETTER, 'Outcome Letter A', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles a very long document without throwing', async () => {
    const longText = Array.from({ length: 200 }, (_, i) =>
      `${i + 1}. This is paragraph number ${i + 1}. It contains some body text to simulate a lengthy document.`
    ).join('\n\n');
    const buf = await convertToDocx(longText, 'Long Document', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('different content produces different output (not a fixed template)', async () => {
    const buf1 = await convertToDocx('Document one content here.', 'Title One', 'ER-2026-0001-GR');
    const buf2 = await convertToDocx('Completely different document two.', 'Title Two', 'ER-2026-0002-GR');
    assert.notEqual(buf1.length, buf2.length,
      'Documents with different content should produce different-sized DOCX files');
  });
});

// ── PDF tests ─────────────────────────────────────────────────────────────────

describe('PDF converter (convertToPdf)', () => {
  test('returns a non-empty Buffer', async () => {
    const buf = await convertToPdf(FULL_DOCUMENT, 'Investigation Report', 'ER-2026-0001-GR');
    assert.ok(Buffer.isBuffer(buf), 'Should return a Buffer');
    assert.ok(buf.length > 0, 'Buffer should not be empty');
  });

  test('output starts with %PDF magic bytes', async () => {
    const buf = await convertToPdf(FULL_DOCUMENT, 'Test', 'ER-2026-0001-GR');
    const header = buf.toString('ascii', 0, 5);
    assert.equal(header, '%PDF-', `PDF must start with %PDF-, got: ${header}`);
  });

  test('output ends with %%EOF marker', async () => {
    const buf = await convertToPdf(FULL_DOCUMENT, 'Test', 'ER-2026-0001-GR');
    // %%EOF may be followed by a newline; check the last 16 bytes
    const tail = buf.toString('ascii', Math.max(0, buf.length - 16));
    assert.ok(tail.includes('%%EOF'), `PDF must end with %%EOF, got: ${JSON.stringify(tail)}`);
  });

  test('produces a document larger than a trivial buffer', async () => {
    const buf = await convertToPdf(FULL_DOCUMENT, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 2048, `Buffer too small: ${buf.length} bytes`);
  });

  test('handles empty string without throwing', async () => {
    const buf = await convertToPdf('', 'Empty', 'ER-2026-0000-GR');
    assert.ok(Buffer.isBuffer(buf) && buf.length > 0, 'Should produce a valid (minimal) PDF for empty input');
  });

  test('handles plain single-line text', async () => {
    const buf = await convertToPdf('Hello world.', 'Simple', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles ALL-CAPS heading lines', async () => {
    const text = 'EXECUTIVE SUMMARY\n\nSome body text here.';
    const buf = await convertToPdf(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles numbered section headers', async () => {
    const text = '1. Introduction\n\nThis is the introduction.';
    const buf = await convertToPdf(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles bullet points (- prefix)', async () => {
    const text = '- First item\n- Second item\n- Third item';
    const buf = await convertToPdf(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles bullet points (• prefix)', async () => {
    const text = '• Alpha\n• Beta\n• Gamma';
    const buf = await convertToPdf(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles decorative rule lines (═ characters)', async () => {
    const text = 'Title\n\n════════════════════\n\nBody text.';
    const buf = await convertToPdf(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles decorative rule lines (─ characters)', async () => {
    const text = 'Title\n\n────────────────────\n\nBody text.';
    const buf = await convertToPdf(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles blank lines (vertical spacing)', async () => {
    const text = 'Paragraph one.\n\n\nParagraph two after extra blank lines.';
    const buf = await convertToPdf(text, 'Test', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles a realistic outcome letter', async () => {
    const buf = await convertToPdf(MINIMAL_LETTER, 'Outcome Letter A', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('handles a very long document without throwing', async () => {
    const longText = Array.from({ length: 200 }, (_, i) =>
      `${i + 1}. This is paragraph number ${i + 1}. It contains some body text to simulate a lengthy document that spans multiple pages in the PDF output.`
    ).join('\n\n');
    const buf = await convertToPdf(longText, 'Long Document', 'ER-2026-0001-GR');
    assert.ok(buf.length > 0);
  });

  test('caseRef appears in the page header (PDF content stream)', async () => {
    const buf = await convertToPdf('Body text.', 'My Title', 'ER-2026-HEADER-GR');
    // PDFkit embeds text in the content stream; the raw bytes contain the string
    const raw = buf.toString('latin1');
    assert.ok(raw.includes('ER-2026-HEADER-GR'), 'Case reference should appear in the PDF content stream');
  });
});
