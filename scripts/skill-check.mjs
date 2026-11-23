import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';

// The writing skills of Paolo scrive (ADR 0023).
const suite = Object.freeze(['racconti', 'lettura-critica']);

function parseFrontmatter(source, filePath) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`${filePath}: YAML frontmatter is required.`);
  }
  return parse(match[1]);
}

const errors = [];
const packageDocument = JSON.parse(await readFile('package.json', 'utf8'));
for (const name of suite) {
  const skillDirectory = path.join('.agents', 'skills', name);
  const skillFile = path.join(skillDirectory, 'SKILL.md');
  const agentFile = path.join(skillDirectory, 'agents', 'openai.yaml');
  const skillSource = await readFile(skillFile, 'utf8');
  const metadata = parseFrontmatter(skillSource, skillFile);
  if (metadata.name !== name) {
    errors.push(`${skillFile}: name must be ${name}.`);
  }
  if (
    typeof metadata.description !== 'string' ||
    metadata.description.trim() === ''
  ) {
    errors.push(`${skillFile}: description is required.`);
  }
  if (/TODO:\s*(?:add|complete|describe|replace)/i.test(skillSource)) {
    errors.push(`${skillFile}: generated TODO text remains.`);
  }
  if (!skillSource.includes('Finish')) {
    errors.push(`${skillFile}: explicit finish criteria are required.`);
  }
  for (const match of skillSource.matchAll(/\bpnpm ([a-z0-9:-]+)/g)) {
    const command = match[1];
    if (!(command in packageDocument.scripts)) {
      errors.push(`${skillFile}: pnpm command ${command} is not defined.`);
    }
  }

  const agent = parse(await readFile(agentFile, 'utf8'));
  if (agent?.policy?.allow_implicit_invocation !== false) {
    errors.push(`${agentFile}: implicit invocation must be disabled.`);
  }
  if (!agent?.interface?.default_prompt?.includes(`$${name}`)) {
    errors.push(`${agentFile}: default_prompt must name $${name}.`);
  }
}

const documentation = await readFile('docs/workspace.md', 'utf8');
for (const name of suite) {
  if (!documentation.includes(`$${name}`)) {
    errors.push(`docs/workspace.md: must document $${name}.`);
  }
}

if (errors.length > 0) {
  throw new Error(
    `Skill validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`,
  );
}
console.log(`Validated ${suite.length} writing skills.`);
