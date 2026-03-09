const fs   = require('fs-extra');
const path = require('path');
require('dotenv').config();

const BASE_PATH = process.env.CASE_FILES_PATH || './cases';

async function createCaseStructure(caseReference, caseType) {
  const folders = [
    '00_CASE_LOG',
    '01_INTAKE',
    '02_INVESTIGATION_PLAN',
    '03_CORRESPONDENCE/Outgoing',
    '03_CORRESPONDENCE/Incoming',
    '04_INTERVIEWS/Complainant',
    '04_INTERVIEWS/Respondent',
    '04_INTERVIEWS/Witnesses',
    '05_EVIDENCE',
    '06_WITNESS_STATEMENTS',
    '07_CHRONOLOGY',
    '08_REPORT/Drafts',
    '09_OUTCOME',
    '10_CLOSURE'
  ];

  const sensitiveTypes = {
    'Whistleblowing':       '05_EVIDENCE/RESTRICTED_Whistleblower_Identity',
    'Discrimination':       '05_EVIDENCE/SENSITIVE_Medical_or_Protected_Data',
    'Absence & Capability': '05_EVIDENCE/SENSITIVE_Medical_Evidence',
    'AWOL':                 '01_INTAKE/AWOL_Contact_Attempts'
  };

  if (sensitiveTypes[caseType]) folders.push(sensitiveTypes[caseType]);

  for (const folder of folders) {
    await fs.ensureDir(path.join(BASE_PATH, caseReference, folder));
  }

  return path.join(BASE_PATH, caseReference);
}

function buildFileName(caseReference, documentType, options = {}) {
  const parts = [caseReference, documentType];
  if (options.party)   parts.push(options.party);
  if (options.date)    parts.push(options.date.replace(/-/g, ''));
  if (options.version) parts.push(options.version);
  return parts.join('_') + '.' + (options.ext || 'txt');
}

async function saveDocument(caseReference, folder, fileName, content) {
  const filePath = path.join(BASE_PATH, caseReference, folder, fileName);
  await fs.ensureDir(path.dirname(filePath));
  typeof content === 'string'
    ? await fs.writeFile(filePath, content, 'utf8')
    : await fs.writeFile(filePath, content);
  return filePath;
}

async function readDocument(caseReference, folder, fileName) {
  return fs.readFile(path.join(BASE_PATH, caseReference, folder, fileName), 'utf8');
}

function getCasePath(caseReference) {
  return path.join(BASE_PATH, caseReference);
}

module.exports = { createCaseStructure, buildFileName, saveDocument, readDocument, getCasePath };
