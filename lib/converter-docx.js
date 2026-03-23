'use strict';
/**
 * lib/converter-docx.js
 *
 * Converts plain-text document content to a DOCX buffer using the
 * `docx` library with programmatic styles. No template files required.
 *
 * Phase 3 choice: programmatic docx styles are defined here. If a richer
 * template-based approach is needed in a future phase, this is the file to replace.
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} = require('docx');

/**
 * Converts a plain-text document string to a DOCX Buffer.
 *
 * Formatting rules (simple heuristics applied to plain text):
 *  - Lines in ALL CAPS (≥ 4 chars, no trailing colon) → Heading 1
 *  - Lines matching /^\d+\.\s+[A-Z]/ → Heading 2 (numbered section)
 *  - Lines starting with ─ or ═ or ━ (decorative rule) → horizontal rule paragraph
 *  - Blank lines → empty paragraph (spacing)
 *  - Everything else → normal paragraph text
 *
 * @param {string} text       - The document text (plain text, not HTML)
 * @param {string} title      - Document title for metadata
 * @param {string} caseRef    - Case reference for the header
 * @returns {Promise<Buffer>}
 */
async function convertToDocx(text, title, caseRef) {
  const lines     = text.split('\n');
  const children  = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Blank line → spacing paragraph
    if (!line.trim()) {
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      continue;
    }

    // Decorative rule line (─ ━ ═ repeated)
    if (/^[─━═]{4,}$/.test(line.trim())) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '666666' } },
        spacing: { after: 160 },
      }));
      continue;
    }

    // ALL-CAPS line (4+ chars) → Heading 1
    if (/^[A-Z][A-Z0-9\s&\/\-–—:\.]{3,}$/.test(line.trim()) &&
        line.trim() === line.trim().toUpperCase() &&
        line.trim().length >= 4) {
      children.push(new Paragraph({
        text:    line.trim(),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }));
      continue;
    }

    // Numbered section header e.g. "1. Executive Summary"
    if (/^\d+\.\s+[A-Z]/.test(line.trim())) {
      children.push(new Paragraph({
        text:    line.trim(),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
      }));
      continue;
    }

    // Bullet point (- or • at start)
    if (/^[-•]\s+/.test(line.trim())) {
      children.push(new Paragraph({
        text:   line.trim().replace(/^[-•]\s+/, ''),
        bullet: { level: 0 },
        spacing: { after: 60 },
      }));
      continue;
    }

    // Normal paragraph
    children.push(new Paragraph({
      children: [new TextRun({ text: line.trim(), size: 22 })],
      spacing:  { after: 120 },
    }));
  }

  const doc = new Document({
    creator:     'ER Investigation Platform',
    title,
    description: `${caseRef} — generated document`,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
      paragraphStyles: [
        {
          id:   'Heading1',
          name: 'Heading 1',
          run:  { bold: true, size: 28, color: '1F3864', font: 'Calibri' },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id:   'Heading2',
          name: 'Heading 2',
          run:  { bold: true, size: 24, color: '2E74B5', font: 'Calibri' },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { convertToDocx };
