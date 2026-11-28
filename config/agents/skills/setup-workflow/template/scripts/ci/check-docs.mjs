#!/usr/bin/env node
// Checks the doc map (docs/README.md "Doc map") against the tree, and the PR body's `Docs:` line.
// Dependency-free; needs only Node and git. Paths are relative to the repo root.
//
//   node scripts/ci/check-docs.mjs [--root DIR] [--base REV]
//
// Checks 1 to 4 always run on the tracked files (`git ls-files`); check 5 runs with --base:
//   1 every tracked `.md` matches exactly one map block, or no block and at least one IMMUTABLE row.
//   2 every expansion of every heading, IMMUTABLE-table and Kept-true-by glob matches a tracked file.
//   3 every live doc (one a block with a numeric Size target matches) is within its target
//     (`LC_ALL=C wc -w` words); one over it is a warning (`::warning::`), never a failure, and a
//     live doc no Size target entry of its block matches is a failure.
//   4 in live docs, outside fenced blocks, each `](target)` outside inline code and each
//     `docs/….md` cite inside inline code resolves to a tracked file, a folder holding one, or a
//     glob match. Links resolve from the doc's folder (a leading `/` from the repo root), cites from
//     the repo root; `#…`, `?…` and a quoted title are stripped; `scheme:` targets, `#`-only
//     targets, targets holding `<` and lines containing the words `git history` are skipped.
//     Anchors are not verified.
//   5 (--base REV) every mapped doc the PR adds or edits, and every doc whose Kept-true-by path the
//     PR changes (`git diff --name-status --no-renames REV HEAD`), has its own entry on the PR
//     body's `Docs:` line (env PR_BODY). An added or modified path is matched against the
//     candidate map, a deleted path against the base map (`git show REV:docs/README.md`, read
//     only then). A doc only an IMMUTABLE row covers needs no entry.
// Exit 0 pass, size warnings included; 1 check failure (each printed as `::error::`); 2
// map-format or usage error, or a needed base map that is unreadable or invalid.
//
// Map format. Under `## Doc map`, each `### ` heading is one block, except
// `### IMMUTABLE and append-only docs`, whose table's column 1 holds backticked globs.
//   Heading: every backticked token before the first `(` is a doc glob; the parenthesised text is
//     the class.
//   `- **Kept true by:**` one of: `nothing; frozen.` | `every plan (<note>).` | backticked globs.
//     After deleting backticked spans and parenthesised notes (backticks inside a note are ignored,
//     no nested parentheses) only `;`, `,`, `and`, whitespace and the final `.` may remain.
//   `- **Size target:**` one of: `frozen (must not grow).` | `<N> words.` | `;`-separated entries
//     `` `<repo-relative glob>` <N> `` or `others <N>` (`words` and `each` optional, `1,000` = 1000),
//     ending in `.`; the first entry matching a doc wins.
// Glob dialect: `{a,b}` alternation (an empty alternative allowed, several groups, no nesting),
// `*` (no `/`), `**/` (zero or more folders), a final `**` (anything under), a trailing `/`
// (everything under). Each brace expansion is matched on its own.
// `Docs:` line: a line starting `Docs:` after an optional bullet, `>` quotes and `**`. Entries split
// on `;`; an entry's docs are its backticked tokens before its first disposition, `update:` or
// `still true:`, followed by at least 3 real characters.
// An entry with an unfilled template field has no disposition: a standalone `<placeholder>` (its
// `<` not after an identifier character or `>`, so `Vec<T>` is filled text), a disposition
// whose reason is empty or only `…`/`...`, a `(supersedes …)` holding nothing else, or the
// template's alternatives chain (a disposition, ` / `, another disposition). A filled reason may
// quote text that contains `…`.
// A token names a doc when it equals the doc's path or a heading glob that matches it.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAP_PATH = 'docs/README.md';
const IMMUTABLE_HEADING = 'IMMUTABLE and append-only docs';
const DISPOSITION_FORMS =
  'Docs: `<doc>` — update: <text> (supersedes <text>) | still true: <text> (every template field filled, one disposition per entry)';

export class MapError extends Error {
  constructor(line, message) {
    super(`${MAP_PATH}:${line}: ${message}`);
    this.line = line;
  }
}

export function expandBraces(glob) {
  const open = glob.indexOf('{');
  if (open === -1) {
    if (glob.includes('}')) throw new Error(`unbalanced } in ${glob}`);
    return [glob];
  }
  const close = glob.indexOf('}', open);
  if (close === -1) throw new Error(`unbalanced { in ${glob}`);
  const inner = glob.slice(open + 1, close);
  if (inner.includes('{')) throw new Error(`nested braces in ${glob}`);
  const head = glob.slice(0, open);
  if (head.includes('}')) throw new Error(`unbalanced } in ${glob}`);
  const tails = expandBraces(glob.slice(close + 1));
  return inner.split(',').flatMap((alt) => tails.map((t) => head + alt + t));
}

// One brace-free glob to an anchored RegExp.
export function globToRegExp(glob) {
  if (/[{}]/.test(glob)) throw new Error(`braces in ${glob}: expand first`);
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else if (i + 2 === glob.length) {
        re += '.*';
        i += 1;
      } else {
        throw new Error(`** must be followed by / or end the glob: ${glob}`);
      }
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '/' && i === glob.length - 1) {
      re += '/.+';
    } else {
      re += c.replace(/[.+?^$()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

const globCache = new Map();
function matcher(glob) {
  let rs = globCache.get(glob);
  if (!rs) {
    rs = expandBraces(glob).map(globToRegExp);
    globCache.set(glob, rs);
  }
  return rs;
}
export const globMatches = (glob, path) => matcher(glob).some((r) => r.test(path));

export function countWords(buf) {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  let n = 0;
  let inWord = false;
  for (const c of b) {
    const space = c === 0x20 || (c >= 0x09 && c <= 0x0d);
    if (!space && !inWord) n++;
    inWord = !space;
  }
  return n;
}

// Backticked tokens outside parentheses and the residue left outside both.
function splitTokens(text) {
  const tokens = [];
  let residue = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '`') {
      const end = text.indexOf('`', i + 1);
      if (end === -1) return { tokens, residue: residue + text.slice(i) };
      tokens.push(text.slice(i + 1, end));
      i = end;
    } else if (c === '(') {
      const end = text.indexOf(')', i + 1);
      const inner = end === -1 ? '' : text.slice(i + 1, end);
      if (end === -1 || inner.includes('(')) return { tokens, residue: residue + text.slice(i) };
      i = end;
    } else {
      residue += c;
    }
  }
  return { tokens, residue };
}

function parseKeptTrueBy(value, line) {
  if (value === 'nothing; frozen.') return { kind: 'frozen', globs: [] };
  if (/^every plan \([^()]+\)\.$/.test(value)) return { kind: 'everyPlan', globs: [] };
  const { tokens, residue } = splitTokens(value);
  const rest = residue
    .replace(/\.\s*$/, '')
    .replace(/\band\b/g, '')
    .replace(/[;,\s]/g, '');
  if (rest) throw new MapError(line, `Kept true by: prose outside backticks and notes: "${rest}"`);
  if (!tokens.length) throw new MapError(line, 'Kept true by: no path');
  return { kind: 'paths', globs: tokens };
}

const NUMBER = /^(?:\d{1,3}(?:,\d{3})+|\d+)$/;
const toNumber = (s) => Number(s.replace(/,/g, ''));

function parseSize(value, line) {
  if (value === 'frozen (must not grow).') return { kind: 'frozen', entries: [] };
  if (!value.endsWith('.')) throw new MapError(line, `Size target: must end with "."`);
  const entries = value
    .slice(0, -1)
    .split(';')
    .map((raw) => {
      const e = raw.trim();
      let m = /^`([^`]+)`\s+(\S+)((?:\s+(?:words|each))*)$/.exec(e);
      if (m && NUMBER.test(m[2])) return { glob: m[1], words: toNumber(m[2]) };
      m = /^(?:others\s+)?(\S+)((?:\s+(?:words|each))*)$/.exec(e);
      if (m && NUMBER.test(m[1]) && (e.startsWith('others') || m[2].includes('words'))) {
        return { glob: null, words: toNumber(m[1]) };
      }
      throw new MapError(line, `Size target: cannot parse "${e}"`);
    });
  for (const e of entries) if (e.glob) checkGlob(e.glob, line);
  return { kind: 'targets', entries };
}

function checkGlob(glob, line) {
  try {
    matcher(glob);
  } catch (err) {
    throw new MapError(line, err.message);
  }
}

export function parseMap(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const start = lines.indexOf('## Doc map');
  if (start === -1) throw new MapError(1, 'no "## Doc map" section');
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end === -1) end = lines.length;

  const blocks = [];
  const immutable = [];
  let block = null;
  let inImmutable = false;
  const finish = () => {
    if (!block) return;
    if (!block.keptTrueBy) throw new MapError(block.line, 'missing "- **Kept true by:**" bullet');
    if (!block.size) throw new MapError(block.line, 'missing "- **Size target:**" bullet');
    blocks.push(block);
    block = null;
  };

  for (let i = start + 1; i < end; i++) {
    const l = lines[i];
    const n = i + 1;
    if (l.startsWith('### ')) {
      finish();
      const heading = l.slice(4).trim();
      inImmutable = heading === IMMUTABLE_HEADING;
      if (inImmutable) continue;
      const { tokens } = splitTokens(heading.replace(/\(.*$/, ''));
      if (!heading.includes('(')) throw new MapError(n, 'heading has no "(class)"');
      if (!tokens.length) throw new MapError(n, 'heading names no backticked doc');
      for (const g of tokens) checkGlob(g, n);
      block = { line: n, docs: tokens, keptTrueBy: null, size: null };
      continue;
    }
    if (inImmutable) {
      if (!l.startsWith('|') || /^\|[\s:|-]+\|?$/.test(l)) continue;
      const cell = l.split('|')[1];
      if (cell.trim() === 'Doc') continue;
      const { tokens } = splitTokens(cell);
      if (!tokens.length) throw new MapError(n, 'IMMUTABLE row names no backticked doc');
      for (const g of tokens) {
        checkGlob(g, n);
        immutable.push({ glob: g, line: n });
      }
      continue;
    }
    if (!block) continue;
    let m = /^- \*\*Kept true by:\*\*\s*(.*)$/.exec(l);
    if (m) {
      if (block.keptTrueBy) throw new MapError(n, 'second Kept true by bullet');
      block.keptTrueBy = { ...parseKeptTrueBy(m[1].trim(), n), line: n };
      for (const g of block.keptTrueBy.globs) checkGlob(g, n);
      continue;
    }
    m = /^- \*\*Size target:\*\*\s*(.*)$/.exec(l);
    if (m) {
      if (block.size) throw new MapError(n, 'second Size target bullet');
      block.size = { ...parseSize(m[1].trim(), n), line: n };
    }
  }
  finish();
  if (!blocks.length) throw new MapError(start + 1, 'Doc map has no block');
  return { blocks, immutable };
}

const blocksOf = (map, file) => map.blocks.filter((b) => b.docs.some((g) => globMatches(g, file)));

function targetOf(block, file) {
  return block.size.entries.find((e) => e.glob === null || globMatches(e.glob, file));
}

// Code spans of one line as [start, end) ranges, delimiters included.
function codeSpans(line) {
  const spans = [];
  const re = /`+/g;
  let m;
  while ((m = re.exec(line))) {
    const tick = m[0];
    const close = new RegExp(`(?<!\`)${tick}(?!\`)`, 'g');
    close.lastIndex = m.index + tick.length;
    const c = close.exec(line);
    if (!c) continue;
    spans.push([m.index, c.index + tick.length]);
    re.lastIndex = c.index + tick.length;
  }
  return spans;
}

function makeResolver(files) {
  const tracked = new Set(files);
  const folders = new Set();
  for (const f of files) {
    for (let i = f.indexOf('/'); i !== -1; i = f.indexOf('/', i + 1)) folders.add(f.slice(0, i));
  }
  return (path) => {
    if (path === '' || path === '.') return true;
    if (path === '..' || path.startsWith('../')) return false;
    if (tracked.has(path) || folders.has(path.replace(/\/$/, ''))) return true;
    if (/[*{]/.test(path)) {
      try {
        return files.some((f) => globMatches(path, f));
      } catch {
        return false;
      }
    }
    return false;
  };
}

function checkLinks(doc, text, resolves, out) {
  const lines = text.replace(/\r/g, '').split('\n');
  let fence = null;
  lines.forEach((line, idx) => {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (
        f &&
        f[1][0] === fence[0] &&
        f[1].length >= fence.length &&
        !/\S/.test(line.slice(f[0].length))
      )
        fence = null;
      return;
    }
    if (f) {
      fence = f[1];
      return;
    }
    if (/git history/i.test(line)) return;
    const spans = codeSpans(line);
    let outside = line;
    for (const [s, e] of spans)
      outside = outside.slice(0, s) + ' '.repeat(e - s) + outside.slice(e);
    const dead = (what) => out.push(`${doc}:links: line ${idx + 1}: ${what}`);

    for (const target of linkTargets(outside)) {
      let t = target.trim().replace(/\s+("[^"]*"|'[^']*')$/, '');
      if (!t || t.includes('<') || t.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(t)) continue;
      t = t.replace(/[#?].*$/, '');
      try {
        t = decodeURI(t);
      } catch {
        /* keep the raw target */
      }
      const path = t.startsWith('/')
        ? posix.normalize(t.slice(1))
        : posix.join(posix.dirname(doc), t);
      if (!resolves(path)) dead(`link "${target}" resolves to "${path}", which is not tracked`);
    }
    for (const [s, e] of spans) {
      for (const m of line.slice(s, e).matchAll(/(?<![\w./{},*-])docs\/[\w./{},*-]+\.md/g)) {
        if (!resolves(posix.normalize(m[0]))) dead(`cite "${m[0]}" is not tracked`);
      }
    }
  });
}

// Each `](target)` target; parentheses inside the target nest, so `](guide_(v2).md)` is one target.
function linkTargets(text) {
  const targets = [];
  for (let i = text.indexOf(']('); i !== -1; i = text.indexOf('](', i + 1)) {
    let depth = 1;
    let j = i + 2;
    for (; j < text.length && depth; j++) {
      if (text[j] === '(') depth++;
      else if (text[j] === ')') depth--;
    }
    if (depth === 0) targets.push(text.slice(i + 2, j - 1));
  }
  return targets;
}

// Checks 1 to 4: `errors` fail the run, `warnings` (over-target docs) do not.
export function checkTree({ files, read, map }) {
  const out = [];
  const warnings = [];
  const md = files.filter((f) => f.endsWith('.md'));

  // 1
  for (const f of md) {
    const bs = blocksOf(map, f);
    if (bs.length > 1) {
      out.push(
        `${f}:coverage: matched by ${bs.length} doc-map blocks (lines ${bs.map((b) => b.line).join(', ')})`
      );
    } else if (!bs.length && !map.immutable.some((r) => globMatches(r.glob, f))) {
      out.push(`${f}:coverage: matched by no doc-map block and no IMMUTABLE row of ${MAP_PATH}`);
    }
  }

  // 2
  const dead = (glob, line, what) => {
    for (const exp of expandBraces(glob)) {
      const re = globToRegExp(exp);
      if (!files.some((f) => re.test(f))) {
        out.push(
          `${MAP_PATH}:paths: line ${line}: ${what} \`${glob}\`${exp === glob ? '' : ` (\`${exp}\`)`} matches no tracked file`
        );
      }
    }
  };
  for (const b of map.blocks) {
    for (const g of b.docs) dead(g, b.line, 'heading glob');
    for (const g of b.keptTrueBy.globs) dead(g, b.keptTrueBy.line, 'Kept true by');
  }
  for (const r of map.immutable) dead(r.glob, r.line, 'IMMUTABLE row');

  // 3 and 4
  const resolves = makeResolver(files);
  for (const f of md) {
    const [b] = blocksOf(map, f);
    if (!b || b.size.kind !== 'targets') continue;
    const target = targetOf(b, f);
    const buf = read(f);
    if (!target) {
      out.push(`${f}:size: no Size target entry of block line ${b.line} matches it`);
    } else {
      const words = countWords(buf);
      if (words > target.words)
        warnings.push(`${f}:size: ${words} words, over its target of ${target.words}`);
    }
    checkLinks(f, buf.toString('utf8'), resolves, out);
  }
  return { errors: out, warnings };
}

const realText = (s) => s.replace(/…|\.\.\./g, '').replace(/[\s*]/g, '');
const KEYWORD = 'update:|still true:';
const DISPOSITION = new RegExp(KEYWORD, 'g');
const ALTERNATIVES = new RegExp(`(?:${KEYWORD})(?:(?!${KEYWORD}).)*? / (?:${KEYWORD})`);
const PLACEHOLDER = /(?<![\w>])<[^<>\s]+>/;

// Whether `raw`, whose disposition keywords are `all`, still holds an unfilled template field.
function unfilled(raw, all) {
  if (PLACEHOLDER.test(raw) || ALTERNATIVES.test(raw)) return true;
  for (const m of raw.matchAll(/\(supersedes\b([^)]*)\)/g)) if (!realText(m[1])) return true;
  return all.some((k, i) => {
    const end = all[i + 1] ? all[i + 1].index : raw.length;
    const reason = raw
      .slice(k.index + k[0].length, end)
      .replace(/\(supersedes\b[^)]*\)/g, '')
      .replace(/\s\/\s*$/, '');
    return realText(reason).length < 3;
  });
}

export function parseDocsLine(body) {
  const entries = [];
  for (const line of String(body ?? '')
    .replace(/\r/g, '')
    .split('\n')) {
    const m = /^\s*(?:[-*+]\s+)?(?:>\s*)*(?:\*\*)?Docs:(?:\*\*)?\s*(.*)$/.exec(line);
    if (!m) continue;
    for (const raw of splitOutsideTicks(m[1], ';')) {
      DISPOSITION.lastIndex = 0;
      const all = [...raw.matchAll(DISPOSITION)];
      const first = all[0];
      const before = first ? raw.slice(0, first.index) : raw;
      const tokens = [...before.matchAll(/`([^`]+)`/g)].map((t) => t[1]);
      const disposition = first && !unfilled(raw, all) ? first[0].replace(/:$/, '') : null;
      entries.push({ tokens, disposition });
    }
  }
  return entries;
}

function splitOutsideTicks(s, sep) {
  const parts = [];
  let cur = '';
  let inTick = false;
  for (const c of s) {
    if (c === '`') inTick = !inTick;
    if (c === sep && !inTick) {
      parts.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  return parts;
}

export function checkStale({ baseMap, map, files, changes, body }) {
  const md = files.filter((f) => f.endsWith('.md'));
  const triggered = new Map(); // doc -> { why, globs }
  for (const { status, path } of changes) {
    if (status.startsWith('D') || !md.includes(path)) continue;
    const [b] = blocksOf(map, path);
    if (b) triggered.set(path, { why: 'edits it', globs: b.docs });
  }
  for (const { status, path } of changes) {
    const deleted = status.startsWith('D');
    const source = deleted ? baseMap : map;
    if (deleted && !source) throw new Error(`deleted path ${path} needs the base map`);
    for (const b of source.blocks) {
      if (b.keptTrueBy.kind !== 'paths') continue;
      if (!b.keptTrueBy.globs.some((g) => globMatches(g, path))) continue;
      for (const doc of md) {
        if (triggered.has(doc) || !b.docs.some((g) => globMatches(g, doc))) continue;
        triggered.set(doc, { why: `changes \`${path}\` (Kept true by)`, globs: b.docs });
      }
    }
  }
  if (!triggered.size) return [];
  const entries = parseDocsLine(body).filter((e) => e.disposition);
  const headingGlobs = map.blocks.flatMap((b) => b.docs);
  const out = [];
  for (const [doc, { why, globs }] of triggered) {
    const named = entries.some((e) =>
      e.tokens.some(
        (t) => t === doc || ((globs.includes(t) || headingGlobs.includes(t)) && globMatches(t, doc))
      )
    );
    if (!named) {
      out.push(
        `${doc}:docs-line: the PR ${why}, but no entry of the PR body's Docs: line names \`${doc}\` with a disposition. Add: ${DISPOSITION_FORMS}`
      );
    }
  }
  return out;
}

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'buffer', maxBuffer: 1 << 30 });
  if (r.status !== 0) {
    throw new Error(
      `git ${args.join(' ')}: ${(r.stderr || Buffer.alloc(0)).toString().trim() || `exit ${r.status}`}`
    );
  }
  return r.stdout;
}

function main(argv) {
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  let base = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) root = resolve(argv[++i]);
    else if (argv[i] === '--base' && argv[i + 1]) base = argv[++i];
    else {
      console.error(`::error::usage: check-docs.mjs [--root DIR] [--base REV] (got "${argv[i]}")`);
      return 2;
    }
  }

  let map;
  let files;
  try {
    files = git(root, ['ls-files', '-z']).toString('utf8').split('\0').filter(Boolean);
    map = parseMap(readFileSync(join(root, MAP_PATH), 'utf8'));
  } catch (err) {
    console.error(`::error::${err.message}`);
    return 2;
  }

  const { errors: failures, warnings } = checkTree({
    files,
    read: (f) => readFileSync(join(root, f)),
    map,
  });

  if (base) {
    let changes;
    let baseMap = null;
    try {
      const parts = git(root, ['diff', '--name-status', '--no-renames', '-z', base, 'HEAD'])
        .toString('utf8')
        .split('\0')
        .filter(Boolean);
      changes = [];
      for (let i = 0; i + 1 < parts.length; i += 2)
        changes.push({ status: parts[i], path: parts[i + 1] });
    } catch (err) {
      console.error(`::error::${err.message}`);
      return 2;
    }
    if (changes.some((c) => c.status.startsWith('D'))) {
      try {
        baseMap = parseMap(git(root, ['show', `${base}:${MAP_PATH}`]).toString('utf8'));
      } catch (err) {
        console.error(
          `::error::the PR deletes a path, so the base map at ${base} is needed, but: ${err.message}`
        );
        return 2;
      }
    }
    failures.push(...checkStale({ baseMap, map, files, changes, body: process.env.PR_BODY ?? '' }));
  }

  for (const w of warnings) console.error(`::warning::${w}`);
  for (const f of failures) console.error(`::error::${f}`);
  if (failures.length) return 1;
  console.log(
    `check-docs: ${map.blocks.length} map blocks, ${files.filter((f) => f.endsWith('.md')).length} tracked .md files: OK`
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
