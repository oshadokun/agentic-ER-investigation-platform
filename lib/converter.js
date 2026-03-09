/**
 * Converts Claude's markdown output to styled HTML
 * suitable for opening in Word or importing to Google Docs.
 */

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  const output = [];
  let inList    = false;
  let listType  = null;
  let inCode    = false;
  let codeLines = [];

  const closeList = () => {
    if (inList) {
      output.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
      listType = null;
    }
  };

  const escHtml = s => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const inlineFormat = s => s
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/`(.+?)`/g,           '<code>$1</code>');

  for (let i = 0; i < lines.length; i++) {
    const raw  = lines[i];
    const line = raw.trimEnd();

    // Fenced code blocks
    if (line.startsWith('```')) {
      if (!inCode) {
        closeList();
        inCode = true;
        codeLines = [];
      } else {
        output.push('<pre><code>' + escHtml(codeLines.join('\n')) + '</code></pre>');
        inCode = false;
        codeLines = [];
      }
      continue;
    }
    if (inCode) { codeLines.push(raw); continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      closeList();
      output.push('<hr>');
      continue;
    }

    // Headings
    const h4 = line.match(/^#### (.+)/);
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h4) { closeList(); output.push(`<h4>${inlineFormat(escHtml(h4[1]))}</h4>`); continue; }
    if (h3) { closeList(); output.push(`<h3>${inlineFormat(escHtml(h3[1]))}</h3>`); continue; }
    if (h2) { closeList(); output.push(`<h2>${inlineFormat(escHtml(h2[1]))}</h2>`); continue; }
    if (h1) { closeList(); output.push(`<h1>${inlineFormat(escHtml(h1[1]))}</h1>`); continue; }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[*\-] (.+)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') { closeList(); output.push('<ul>'); inList = true; listType = 'ul'; }
      output.push(`<li>${inlineFormat(escHtml(ulMatch[2]))}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\. (.+)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') { closeList(); output.push('<ol>'); inList = true; listType = 'ol'; }
      output.push(`<li>${inlineFormat(escHtml(olMatch[2]))}</li>`);
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      closeList();
      output.push('<br>');
      continue;
    }

    // Normal paragraph line
    closeList();
    output.push(`<p>${inlineFormat(escHtml(line))}</p>`);
  }

  closeList();
  return output.join('\n');
}

function wrapInHtmlDocument(bodyHtml, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="Generator" content="ER Investigation Platform">
<title>${title || 'ER Investigation Document'}</title>
<style>
  body {
    font-family: 'Calibri', 'Arial', sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 740px;
    margin: 40px auto;
    padding: 0 40px 60px 40px;
  }
  h1 {
    font-size: 16pt;
    font-weight: bold;
    color: #1a1a1a;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 6px;
    margin-top: 28px;
    margin-bottom: 10px;
  }
  h2 {
    font-size: 13pt;
    font-weight: bold;
    color: #1a1a1a;
    margin-top: 22px;
    margin-bottom: 8px;
  }
  h3 {
    font-size: 11pt;
    font-weight: bold;
    color: #333;
    margin-top: 16px;
    margin-bottom: 6px;
  }
  h4 {
    font-size: 11pt;
    font-weight: bold;
    font-style: italic;
    color: #444;
    margin-top: 12px;
    margin-bottom: 4px;
  }
  p {
    margin: 0 0 6px 0;
  }
  ul, ol {
    margin: 6px 0 10px 0;
    padding-left: 24px;
  }
  li {
    margin-bottom: 4px;
  }
  hr {
    border: none;
    border-top: 1px solid #ccc;
    margin: 18px 0;
  }
  pre {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 3px;
    padding: 12px 16px;
    font-family: 'Courier New', monospace;
    font-size: 9.5pt;
    white-space: pre-wrap;
    margin: 10px 0;
  }
  code {
    font-family: 'Courier New', monospace;
    font-size: 9.5pt;
    background: #f0f0f0;
    padding: 1px 4px;
    border-radius: 2px;
  }
  strong { font-weight: bold; }
  em     { font-style: italic; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function convertToHtml(markdownText, title) {
  const body = markdownToHtml(markdownText);
  return wrapInHtmlDocument(body, title);
}

module.exports = { convertToHtml };
