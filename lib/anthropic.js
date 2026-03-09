const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

function readSkillFile(skillFileName) {
  const skillPath = path.join(__dirname, '..', 'skills', skillFileName);
  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill file not found: ${skillFileName}`);
  }
  return fs.readFileSync(skillPath, 'utf8');
}

async function callClaude(skillFileName, userMessage) {
  const systemPrompt = readSkillFile(skillFileName);

  const response = await client.messages.create({
    model:      process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 8192,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userMessage }]
  });

  return response.content[0].text;
}

module.exports = { callClaude, readSkillFile };
