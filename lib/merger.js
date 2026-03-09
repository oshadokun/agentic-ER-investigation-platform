function mergeNames(documentText, nameMap) {
  let merged = documentText;
  for (const [placeholder, realValue] of Object.entries(nameMap)) {
    if (realValue && realValue.length > 0) {
      const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      merged = merged.replace(new RegExp(escaped, 'g'), realValue);
    }
  }
  return merged;
}

function findUnmergedPlaceholders(documentText) {
  const pattern = /\[([A-Z][A-Z\s]+[A-Z])\]/g;
  const found   = [];
  let match;
  while ((match = pattern.exec(documentText)) !== null) {
    const datePlaceholders = ['DATE', 'CASE OPEN DATE', 'DATE OF INCIDENT', 'DATE OF INTERVIEW'];
    if (!datePlaceholders.some(d => match[1].includes(d))) {
      found.push(match[0]);
    }
  }
  return [...new Set(found)];
}

module.exports = { mergeNames, findUnmergedPlaceholders };
