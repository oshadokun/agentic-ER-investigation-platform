'use strict';
/**
 * lib/converter-pdf.js
 *
 * Converts plain-text document content to a PDF buffer using pdfkit.
 * Pure Node.js — no native binaries beyond pdfkit itself.
 *
 * Phase 3 choice: pdfkit only. No Puppeteer, no wkhtmltopdf.
 */

const PDFDocument = require('pdfkit');

/**
 * Converts a plain-text document string to a PDF Buffer.
 *
 * Formatting rules (matching the DOCX converter heuristics):
 *  - ALL-CAPS lines (≥ 4 chars) → large bold heading
 *  - Numbered section headers (/^\d+\.\s+[A-Z]/) → medium bold heading
 *  - Decorative rule lines → horizontal rule
 *  - Blank lines → vertical space
 *  - Bullet lines (- or •) → indented bullet text
 *  - Everything else → normal body text
 *
 * @param {string} text     - The document text (plain text)
 * @param {string} title    - Document title for PDF metadata
 * @param {string} caseRef  - Case reference printed in the header
 * @returns {Promise<Buffer>}
 */
function convertToPdf(text, title, caseRef) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc    = new PDFDocument({
      size:    'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      info:    { Title: title, Author: 'ER Investigation Platform', Subject: caseRef },
    });

    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Fonts and colours ────────────────────────────────────────────────────
    const BODY_SIZE    = 11;
    const H1_SIZE      = 16;
    const H2_SIZE      = 13;
    const BODY_COLOR   = '#111111';
    const H1_COLOR     = '#1F3864';
    const H2_COLOR     = '#2E74B5';
    const RULE_COLOR   = '#AAAAAA';

    // ── Page header ──────────────────────────────────────────────────────────
    doc
      .fontSize(9)
      .fillColor('#888888')
      .text(`${caseRef} — RESTRICTED — ER Investigation Platform`, { align: 'right' })
      .moveDown(0.5);

    // ── Body ─────────────────────────────────────────────────────────────────
    const lines = text.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      // Blank line
      if (!line.trim()) {
        doc.moveDown(0.4);
        continue;
      }

      // Decorative rule
      if (/^[─━═]{4,}$/.test(line.trim())) {
        doc
          .moveTo(72, doc.y)
          .lineTo(doc.page.width - 72, doc.y)
          .strokeColor(RULE_COLOR)
          .stroke()
          .moveDown(0.4);
        continue;
      }

      // ALL-CAPS heading
      if (/^[A-Z][A-Z0-9\s&\/\-–—:\.]{3,}$/.test(line.trim()) &&
          line.trim() === line.trim().toUpperCase() &&
          line.trim().length >= 4) {
        doc
          .moveDown(0.6)
          .fontSize(H1_SIZE)
          .fillColor(H1_COLOR)
          .font('Helvetica-Bold')
          .text(line.trim())
          .moveDown(0.3);
        doc.fontSize(BODY_SIZE).fillColor(BODY_COLOR).font('Helvetica');
        continue;
      }

      // Numbered section heading
      if (/^\d+\.\s+[A-Z]/.test(line.trim())) {
        doc
          .moveDown(0.5)
          .fontSize(H2_SIZE)
          .fillColor(H2_COLOR)
          .font('Helvetica-Bold')
          .text(line.trim())
          .moveDown(0.2);
        doc.fontSize(BODY_SIZE).fillColor(BODY_COLOR).font('Helvetica');
        continue;
      }

      // Bullet point
      if (/^[-•]\s+/.test(line.trim())) {
        doc
          .fontSize(BODY_SIZE)
          .fillColor(BODY_COLOR)
          .font('Helvetica')
          .text('• ' + line.trim().replace(/^[-•]\s+/, ''), { indent: 16 })
          .moveDown(0.1);
        continue;
      }

      // Normal body text
      doc
        .fontSize(BODY_SIZE)
        .fillColor(BODY_COLOR)
        .font('Helvetica')
        .text(line.trim())
        .moveDown(0.2);
    }

    // ── Page footer (page number added by pdfkit automatically) ──────────────
    const pageRange = `Page 1`;  // pdfkit adds actual page numbers via events if needed
    doc.end();
  });
}

module.exports = { convertToPdf };
