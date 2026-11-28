// node --test scripts/ci/__tests__/gen-claude-agents.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GENERATED, MANAGED, renderTwin } from '../gen-claude-agents.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GEN = join(REPO, 'scripts', 'ci', 'gen-claude-agents.mjs');

const gen = (root, ...args) =>
  spawnSync(process.execPath, [GEN, '--root', root, ...args], { encoding: 'utf8' });

const omp = (root, name) => join(root, '.omp', 'agents', `${name}.md`);
const twin = (root, name) => join(root, '.claude', 'agents', `${name}.md`);

const AGENT = (fm) => `---\n${fm}\n---\n\n# Role\n\nBody line.\n`;

// A temp root holding this repo's omp agents, then `agents` written over them.
function fixture(t, agents = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gen-claude-agents-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(REPO, '.omp', 'agents'), join(root, '.omp', 'agents'), { recursive: true });
  for (const [name, src] of Object.entries(agents)) writeFileSync(omp(root, name), src);
  return root;
}

test('generates the exact twin for a managed role', (t) => {
  const root = fixture(t, {
    planner: AGENT(
      "name: planner\ndescription: 'Fixture agent.'\nthinking-level: low\ntools: read, edit, write, bash, glob, grep"
    ),
  });
  const r = gen(root);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(
    readFileSync(twin(root, 'planner'), 'utf8'),
    `---\nname: planner\ndescription: 'Fixture agent.'\neffort: low\ntools: Read, Edit, Write, Bash, Glob, Grep\n---\n${GENERATED('planner')}\n\n# Role\n\nBody line.\n`
  );
  assert.equal(gen(root, '--check').status, 0);
});

test('the managed roles are planner, implementer and reviewer', () => {
  assert.deepEqual(MANAGED, ['planner', 'implementer', 'reviewer']);
});

test('an omp-only extra role needs no twin and passes --check', (t) => {
  const root = fixture(t, { designer: AGENT('name: designer\ndescription: d\ntools: read') });
  assert.equal(gen(root).status, 0);
  assert.ok(!existsSync(twin(root, 'designer')));
  const r = gen(root, '--check');
  assert.equal(r.status, 0, r.stderr);
});

test('--check exits 1 on a missing managed omp source', (t) => {
  const root = fixture(t);
  assert.equal(gen(root).status, 0);
  rmSync(omp(root, 'reviewer'));
  const r = gen(root, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /reviewer\.md: missing omp source of a managed role/);
});

test('thinking levels map to Claude effort', () => {
  const cases = { off: null, minimal: 'low', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' };
  for (const [level, effort] of Object.entries(cases)) {
    const out = renderTwin('a', AGENT(`name: a\ndescription: d\nthinking-level: ${level}\ntools: read`));
    const fm = out.split('\n---\n')[0];
    if (effort) assert.match(fm, new RegExp(`^effort: ${effort}$`, 'm'), level);
    else assert.doesNotMatch(fm, /^effort:/m, level);
  }
});

test('an anthropic model is mirrored, an alias or another provider is not', () => {
  const fmOf = (model) =>
    renderTwin('a', AGENT(`name: a\ndescription: d\nmodel: ${model}\ntools: read`)).split('\n---\n')[0];
  assert.match(fmOf('anthropic/claude-x-1:high'), /^model: claude-x-1$/m);
  assert.match(fmOf("'anthropic/claude-x-1'"), /^model: claude-x-1$/m);
  for (const m of ["'@reviewer'", 'openai/gpt-x', 'claude-x-1']) assert.doesNotMatch(fmOf(m), /^model:/m, m);
});

test('the twin is the generated-file line and the omp body', () => {
  const src = readFileSync(omp(REPO, 'reviewer'), 'utf8');
  const body = src.slice(src.indexOf('\n---\n') + 5);
  assert.ok(renderTwin('reviewer', src).endsWith(`\n---\n${GENERATED('reviewer')}\n${body}`));
});

test('--check exits 1 on drift', (t) => {
  const root = fixture(t);
  assert.equal(gen(root).status, 0);
  writeFileSync(twin(root, 'planner'), `${readFileSync(twin(root, 'planner'), 'utf8')}drift\n`);
  const r = gen(root, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /planner\.md: differs/);
});

test('--check exits 1 on a missing twin', (t) => {
  const root = fixture(t);
  assert.equal(gen(root).status, 0);
  rmSync(twin(root, 'implementer'));
  const r = gen(root, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /implementer\.md: missing/);
});

test('a Claude-only agent with no omp source is ignored', (t) => {
  const root = fixture(t);
  assert.equal(gen(root).status, 0);
  writeFileSync(twin(root, 'claude-only'), '---\nname: claude-only\n---\n');
  const r = gen(root, '--check');
  assert.equal(r.status, 0, r.stderr);
});

test("a twin without the generated-file line is the owner's own: never written or checked", (t) => {
  const root = fixture(t);
  mkdirSync(join(root, '.claude', 'agents'), { recursive: true });
  const own = '---\nname: reviewer\ndescription: mine\ntools: Read\n---\n\nMy reviewer.\n';
  writeFileSync(twin(root, 'reviewer'), own);
  const w = gen(root);
  assert.equal(w.status, 0, w.stderr);
  assert.match(w.stderr, /reviewer\.md: no generated-file line, kept/);
  assert.equal(readFileSync(twin(root, 'reviewer'), 'utf8'), own);
  assert.equal(gen(root, '--check').status, 0);
});

test('a re-run does not rewrite up-to-date twins', (t) => {
  const root = fixture(t);
  assert.equal(gen(root).status, 0);
  const old = new Date('2000-01-01T00:00:00Z');
  utimesSync(twin(root, 'planner'), old, old);
  assert.equal(gen(root).status, 0);
  assert.equal(statSync(twin(root, 'planner')).mtimeMs, old.getTime());
});

test('a source with a bad frontmatter is rejected with code 2', () => {
  const cases = [
    ['name: b\ndescription: d\ntools: read', /name is b, expected a/],
    ['description: d\ntools: read', /name is \(missing\)/],
    ['name: a\ntools: read', /missing description/],
    ["name: a\ndescription: ''\ntools: read", /missing description/],
    ['name: a\ndescription: d', /missing tools/],
    ['name: a\ndescription: d\ntools: read, teleport', /unknown tool\(s\) teleport/],
    ['name: a\ndescription: d\nthinking-level: huge\ntools: read', /unknown thinking-level huge/],
    ['name: a\ndescription: d\n  indented: x\ntools: read', /unparsed frontmatter line/],
  ];
  for (const [fm, needle] of cases) {
    assert.throws(() => renderTwin('a', AGENT(fm)), (e) => e.code === 2 && needle.test(e.message), fm);
  }
  assert.throws(() => renderTwin('a', '# no frontmatter\n'), /no frontmatter block/);
});

test('a bad managed source exits 2 from the CLI', (t) => {
  const r = gen(fixture(t, { implementer: AGENT('name: implementer\ndescription: d\ntools: teleport') }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /implementer\.md: unknown tool\(s\) teleport/);
});

test('a usage error exits 2', () => {
  assert.equal(spawnSync(process.execPath, [GEN, '--bogus'], { encoding: 'utf8' }).status, 2);
});

test('the committed twins match the generator', () => {
  const r = spawnSync(process.execPath, [GEN, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
