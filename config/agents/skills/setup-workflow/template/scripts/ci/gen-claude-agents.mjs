#!/usr/bin/env node
// Generates the Claude Code agent twins `.claude/agents/<name>.md` from their single source
// `.omp/agents/<name>.md`. The two harnesses use different frontmatter, so each twin is Claude
// frontmatter derived from the omp frontmatter, the generated-file line (GENERATED below), then
// the omp body unchanged.
//
//   node scripts/ci/gen-claude-agents.mjs [--root DIR] [--check]
//
// Managed roles: exactly MANAGED below (planner, implementer, reviewer); setup, generation and
// --check use only this list. Any other `.omp/agents/*.md` (an omp-only role) needs no twin, and
// any other `.claude/agents/*.md` (a Claude-only agent) is ignored. A managed role's twin that
// lacks its generated-file line is the owner's own: never written or checked.
// Default: write the managed twins. --check: write nothing; exit 1 when a managed role's omp
// source is missing, or its twin is missing or differs from its generated form.
// Exit 2: an omp source without frontmatter, `name` (equal to its file name), `description` or
// `tools`, an unknown tool or thinking level, or a usage error.
//
// Frontmatter mapping (omp -> Claude):
//   name, description           copied
//   tools                       read, edit, write, bash, glob, grep -> Read, Edit, Write, Bash, Glob, Grep
//   thinking-level              off -> (none); minimal, low -> low; medium; high; xhigh
//   model                       `anthropic/<id>[:<level>]` -> `<id>`; any other value (a role alias
//                               such as `@reviewer`, another provider) -> no `model:`, so Claude
//                               Code runs the twin on the session's model
// Every other omp key stays omp-only.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = {
  read: 'Read',
  edit: 'Edit',
  write: 'Write',
  bash: 'Bash',
  glob: 'Glob',
  grep: 'Grep',
};

const EFFORT = { off: null, minimal: 'low', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' };

export const GENERATED = (name) =>
  `<!-- Generated from .omp/agents/${name}.md by scripts/ci/gen-claude-agents.mjs: edit the source, not this file. -->`;

export class GenError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2');

function splitFrontmatter(file, src) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(src);
  if (!m) throw new GenError(2, `${file}: no frontmatter block`);
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (!kv) throw new GenError(2, `${file}: unparsed frontmatter line: ${line}`);
    fields[kv[1]] = kv[2];
  }
  return { fields, body: m[2] };
}

export function renderTwin(name, src) {
  const file = `.omp/agents/${name}.md`;
  const { fields, body } = splitFrontmatter(file, src.replaceAll('\r\n', '\n'));
  if (unquote(fields.name ?? '') !== name) {
    throw new GenError(2, `${file}: name is ${fields.name ?? '(missing)'}, expected ${name}`);
  }
  if (!unquote(fields.description ?? '').trim()) throw new GenError(2, `${file}: missing description`);
  const tools = unquote(fields.tools ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (!tools.length) throw new GenError(2, `${file}: missing tools`);
  const unknown = tools.filter((t) => !Object.hasOwn(TOOLS, t));
  if (unknown.length) throw new GenError(2, `${file}: unknown tool(s) ${unknown.join(', ')}`);

  let effort = null;
  if (fields['thinking-level'] !== undefined) {
    const level = unquote(fields['thinking-level']);
    if (!Object.hasOwn(EFFORT, level)) throw new GenError(2, `${file}: unknown thinking-level ${level}`);
    effort = EFFORT[level];
  }
  const model = /^anthropic\/([^:\s]+)(?::\S+)?$/.exec(unquote(fields.model ?? ''))?.[1] ?? null;

  const fm = [
    `name: ${name}`,
    `description: ${fields.description.trim()}`,
    ...(model ? [`model: ${model}`] : []),
    ...(effort ? [`effort: ${effort}`] : []),
    `tools: ${tools.map((t) => TOOLS[t]).join(', ')}`,
  ];
  return `---\n${fm.join('\n')}\n---\n${GENERATED(name)}\n${body}`;
}

export const MANAGED = ['planner', 'implementer', 'reviewer'];

export function run({ root, check, log = console.error }) {
  const ompDir = join(root, '.omp', 'agents');
  const claudeDir = join(root, '.claude', 'agents');
  let failed = false;
  let managed = 0;
  for (const name of MANAGED) {
    const src = join(ompDir, `${name}.md`);
    if (!existsSync(src)) {
      log(`.omp/agents/${name}.md: missing omp source of a managed role`);
      failed = true;
      continue;
    }
    const dest = join(claudeDir, `${name}.md`);
    const cur = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
    if (cur !== null && !cur.includes(GENERATED(name))) {
      log(`.claude/agents/${name}.md: no generated-file line, kept as the owner's own`);
      continue;
    }
    managed++;
    const out = renderTwin(name, readFileSync(src, 'utf8'));
    if (check) {
      if (cur !== out) {
        log(`.claude/agents/${name}.md: ${cur === null ? 'missing' : 'differs from its generated form'} (run node scripts/ci/gen-claude-agents.mjs)`);
        failed = true;
      }
    } else if (cur !== out) {
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(dest, out);
    }
  }
  if (!failed) log(`gen-claude-agents: ${managed} managed twin(s) ${check ? 'match their omp sources' : 'up to date'}: OK`);
  return failed ? 1 : 0;
}

function main(argv) {
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') check = true;
    else if (argv[i] === '--root' && i + 1 < argv.length) root = resolve(argv[++i]);
    else {
      console.error('usage: gen-claude-agents.mjs [--root DIR] [--check]');
      return 2;
    }
  }
  try {
    return run({ root, check });
  } catch (e) {
    if (e instanceof GenError) {
      console.error(e.message);
      return e.code;
    }
    throw e;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
