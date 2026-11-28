// node --test scripts/ci/__tests__/check-docs.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { countWords, expandBraces, globMatches } from '../check-docs.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = join(REPO, 'scripts', 'ci', 'check-docs.mjs');

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ') + '\n';

const BLOCK_AB = [
  '### `docs/A.md`, `docs/B.md` (EDITABLE)',
  '',
  '- **Answers:** what.',
  '- **Kept true by:** `src/a.js`; `src/lib/` (the lib, `x`); `src/{c,d}.js`.',
  '- **Size target:** 50 words.',
];

function mapText({ ab = BLOCK_AB, extra = [] } = {}) {
  return [
    '# Docs',
    '',
    '## Doc map',
    '',
    ...ab,
    '',
    '### `docs/F.md` (EDITABLE, frozen)',
    '',
    '- **Kept true by:** nothing; frozen.',
    '- **Size target:** frozen (must not grow).',
    '',
    '### `docs/T.md` (EDITABLE)',
    '',
    '- **Kept true by:** every plan (the outcome it closes).',
    '- **Size target:** 100 words.',
    '',
    '### `docs/g/*.md` (EDITABLE)',
    '',
    '- **Kept true by:** `src/g.js`.',
    '- **Size target:** 100 words.',
    '',
    '### `docs/README.md`, `README.md` (EDITABLE)',
    '',
    '- **Kept true by:** `src/b.js`.',
    '- **Size target:** `docs/README.md` 2,000 words; others 100.',
    '',
    ...extra,
    '### IMMUTABLE and append-only docs',
    '',
    '| Doc | What | Edit |',
    '| --- | ---- | ---- |',
    '| `docs/history/*.md` | records | IMMUTABLE |',
    '',
    '## After',
    '',
    'The `docs/history/*.md` records.',
    '',
  ].join('\n');
}

function baseFiles() {
  return {
    'docs/README.md': mapText(),
    'README.md': 'See [docs](docs/README.md) and [A](docs/A.md).\n',
    'docs/A.md': 'Alpha, see [B](B.md) and `docs/T.md:3`.\n',
    'docs/B.md': 'Beta.\n',
    'docs/F.md': 'Frozen.\n',
    'docs/T.md': 'Tasks.\n',
    'docs/g/1.md': 'One.\n',
    'docs/g/2.md': 'Two.\n',
    'docs/history/H.md': 'History, [dead](nowhere.md).\n',
    'src/a.js': 'a\n',
    'src/b.js': 'b\n',
    'src/c.js': 'c\n',
    'src/d.js': 'd\n',
    'src/g.js': 'g\n',
    'src/lib/x.js': 'x\n',
  };
}

const git = (root, ...args) => {
  const r = spawnSync(
    'git',
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      ...args,
    ],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(r.status, 0, r.stderr);
};

function write(root, files) {
  for (const [p, text] of Object.entries(files)) {
    const abs = join(root, p);
    if (text === null) {
      rmSync(abs, { force: true });
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
}

// A temp repo holding `files` (null deletes), every file staged.
function repo(t, files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'check-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  write(root, { ...baseFiles(), ...files });
  git(root, 'add', '-A');
  return root;
}

// PR mode: a committed base, then a committed candidate.
function pr(t, candidate, base = {}) {
  const root = repo(t, base);
  git(root, 'commit', '-qm', 'base');
  write(root, candidate);
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'candidate');
  return root;
}

function run(root, args = [], body) {
  const env = { ...process.env };
  delete env.PR_BODY;
  if (body !== undefined) env.PR_BODY = body;
  return spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], { encoding: 'utf8', env });
}

const fails = (r, ...needles) => {
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}\n${r.stdout}${r.stderr}`);
  for (const n of needles)
    assert.match(r.stderr, new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
};
const passes = (r) =>
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\n${r.stdout}${r.stderr}`);
const exit2 = (r, needle) => {
  assert.equal(r.status, 2, `expected exit 2, got ${r.status}\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, needle);
};
// Exit 0 with exactly the given `::warning::` lines and no `::error::` line.
const warns = (r, ...lines) => {
  passes(r);
  assert.deepEqual(
    r.stderr.split('\n').filter((l) => l.startsWith('::warning::')),
    lines.map((l) => `::warning::${l}`)
  );
  assert.doesNotMatch(r.stderr, /::error::/);
};
const pr0 = (t, candidate, body, base) => run(pr(t, candidate, base), ['--base', 'HEAD^1'], body);

// Tree mode

test('baseline fixture passes', (t) => passes(run(repo(t))));

test('an uncovered .md fails', (t) =>
  fails(run(repo(t, { 'notes/U.md': 'u\n' })), 'notes/U.md:coverage'));

test('a .md matched by two blocks fails', (t) => {
  const extra = [
    '### `docs/A.md` (EDITABLE)',
    '',
    '- **Kept true by:** `src/a.js`.',
    '- **Size target:** 50 words.',
    '',
  ];
  fails(run(repo(t, { 'docs/README.md': mapText({ extra }) })), 'docs/A.md:coverage: matched by 2');
});

test('a dead Kept-true-by path fails', (t) => {
  fails(run(repo(t, { 'src/a.js': null })), 'Kept true by `src/a.js` matches no tracked file');
});

test('a dead brace alternative fails', (t) => {
  fails(run(repo(t, { 'src/d.js': null })), '`src/{c,d}.js` (`src/d.js`) matches no tracked file');
});

test('a Kept-true-by file on disk but untracked fails', (t) => {
  const root = repo(t, { 'src/d.js': null });
  write(root, { 'src/d.js': 'd\n' });
  fails(run(root), '(`src/d.js`) matches no tracked file');
});

test('a doc exactly on its target passes, one word over warns and still exits 0', (t) => {
  warns(run(repo(t, { 'docs/B.md': words(50) })));
  warns(
    run(repo(t, { 'docs/B.md': words(51) })),
    'docs/B.md:size: 51 words, over its target of 50'
  );
});

test('an `others` entry applies, a per-file entry wins, frozen is skipped', (t) => {
  warns(run(repo(t, { 'README.md': words(100), 'docs/F.md': words(5000) })));
  warns(
    run(repo(t, { 'README.md': words(101) })),
    'README.md:size: 101 words, over its target of 100'
  );
});

test('an over-target doc beside a dead link exits 1 and prints both', (t) => {
  const r = run(repo(t, { 'docs/B.md': words(51), 'docs/A.md': 'See [x](x.md).\n' }));
  fails(
    r,
    '::warning::docs/B.md:size: 51 words, over its target of 50',
    '::error::docs/A.md:links'
  );
});

test('a live doc no Size target entry matches fails', (t) => {
  const ab = BLOCK_AB.with(-1, '- **Size target:** `docs/A.md` 50 words.');
  fails(
    run(repo(t, { 'docs/README.md': mapText({ ab }) })),
    '::error::docs/B.md:size: no Size target entry of block line 5 matches it'
  );
});

test('a dead link fails', (t) => {
  fails(run(repo(t, { 'docs/B.md': 'See [x](x.md).\n' })), 'docs/B.md:links: line 1', 'docs/x.md');
});

test('a dead backticked docs cite fails', (t) => {
  fails(
    run(repo(t, { 'docs/B.md': 'See `docs/X.md:12`.\n' })),
    'docs/B.md:links: line 1',
    'docs/X.md'
  );
});

test('external, anchor, parent and fenced links pass', (t) => {
  const text = [
    '[w](https://example.com/x.md) [m](mailto:a@b.c) [a](#a) [r](../README.md#a "t") [g](g/)',
    '',
    '```',
    '[d](dead.md) `docs/Dead.md`',
    '```',
    '',
  ].join('\n');
  passes(run(repo(t, { 'docs/B.md': text })));
});

test('a link target with balanced parentheses resolves', (t) => {
  const files = { 'docs/history/guide_(v2).md': 'Guide.\n' };
  passes(run(repo(t, { ...files, 'docs/B.md': 'See [guide](history/guide_(v2).md "t").\n' })));
  fails(
    run(repo(t, { ...files, 'docs/B.md': 'See [guide](history/guide_(v3).md).\n' })),
    'docs/B.md:links: line 1',
    'docs/history/guide_(v3).md'
  );
});

test('a dead cite on a git history line passes', (t) => {
  passes(run(repo(t, { 'docs/B.md': '`docs/Gone.md:4` (git history).\n' })));
});

test('a dead cite in a frozen doc passes', (t) => {
  passes(run(repo(t, { 'docs/F.md': '`docs/Gone.md` and [x](x.md).\n' })));
});

// Exit 2

test('prose residue in Kept true by exits 2', (t) => {
  const ab = BLOCK_AB.map((l) =>
    l.startsWith('- **Kept') ? '- **Kept true by:** the lib; `src/a.js`.' : l
  );
  exit2(
    run(repo(t, { 'docs/README.md': mapText({ ab }) })),
    /docs\/README\.md:8: Kept true by: prose/
  );
});

test('a missing Size target exits 2', (t) => {
  const ab = BLOCK_AB.filter((l) => !l.startsWith('- **Size'));
  exit2(
    run(repo(t, { 'docs/README.md': mapText({ ab }) })),
    /docs\/README\.md:5: missing "- \*\*Size target:\*\*"/
  );
});

test('a missing doc map exits 2', (t) => {
  exit2(run(repo(t, { 'docs/README.md': '# Docs\n' })), /no "## Doc map" section/);
});

// PR mode, must fail

const BOTH = 'Docs: `docs/A.md` — still true: no change; `docs/B.md` — still true: no change';

test('a changed Kept-true-by path with an empty body fails', (t) => {
  fails(
    pr0(t, { 'src/a.js': 'a2\n' }, ''),
    'docs/A.md:docs-line',
    'docs/B.md:docs-line',
    '`src/a.js`'
  );
});

test('the template placeholder fails', (t) => {
  const body = 'Docs: `<doc>` — update: … (supersedes …) / still true: …; …';
  fails(pr0(t, { 'src/lib/x.js': 'x2\n' }, body), 'docs/A.md:docs-line', 'docs/B.md:docs-line');
});

test('an entry naming every doc but keeping an unfilled template field fails', (t) => {
  const tails = [
    'update: … (supersedes …) / still true: …',
    'update: (supersedes ) / still true:',
    'update: new path (supersedes )',
    'update: new path (supersedes ...)',
    'update: … (supersedes the old path)',
    'still true:',
    'still true: ...',
    'still true: no change / update: new path',
    'still true: see <reason>',
    'update: <text> (supersedes the old path)',
    'still true: `<doc>` holds',
  ];
  for (const tail of tails) {
    const body = `Docs: \`docs/A.md\`, \`docs/B.md\` — ${tail}; …`;
    fails(
      pr0(t, { 'src/a.js': `a ${tail}\n` }, body),
      'docs/A.md:docs-line',
      'docs/B.md:docs-line'
    );
  }
});

test('a filled reason may quote text containing an ellipsis', (t) => {
  const reasons = [
    'update: names src/a.js (supersedes the old path)',
    'update: one combined comment (supersedes the comment "Before: … after: … An absent side counts as 0 …")',
    'still true: the line "keeps it ... as is" holds',
  ];
  for (const reason of reasons) {
    const body = `Docs: \`docs/A.md\`, \`docs/B.md\` — ${reason}`;
    passes(pr0(t, { 'src/a.js': `a ${reason}\n` }, body));
  }
});

test('a filled reason may name a generic type', (t) => {
  const reasons = [
    'still true: `Vec<T>` is unchanged',
    'update: returns Option<u64> (supersedes the Result<T> row)',
    'still true: List<List<u8>> layout holds',
  ];
  for (const reason of reasons) {
    const body = `Docs: \`docs/A.md\`, \`docs/B.md\` — ${reason}`;
    passes(pr0(t, { 'src/a.js': `a ${reason}\n` }, body));
  }
});

test('an entry lacking a disposition fails', (t) => {
  fails(
    pr0(t, { 'src/a.js': 'a2\n' }, 'Docs: `docs/A.md`, `docs/B.md` — fine'),
    'docs/A.md:docs-line'
  );
  fails(
    pr0(t, { 'src/a.js': 'a2\n' }, 'Docs: `docs/A.md`, `docs/B.md` — update: …'),
    'docs/B.md:docs-line'
  );
});

test('a PR that edits the triggered doc still needs its entry', (t) => {
  const body = 'Docs: `docs/B.md` — still true: no change';
  fails(pr0(t, { 'src/a.js': 'a2\n', 'docs/A.md': 'Alpha two.\n' }, body), 'docs/A.md:docs-line');
});

test('partial block coverage fails naming the missing doc', (t) => {
  const r = pr0(t, { 'src/a.js': 'a2\n' }, 'Docs: `docs/A.md` — still true: no change');
  fails(r, 'docs/B.md:docs-line');
  assert.doesNotMatch(r.stderr, /docs\/A\.md:docs-line/);
});

test('a Kept-true-by file renamed out of every glob triggers through the base map', (t) => {
  const root = repo(t);
  git(root, 'commit', '-qm', 'base');
  // The candidate map keeps no `src/a.js`, so only the base map can trigger the deletion.
  const ab = BLOCK_AB.map((l) => l.replace('`src/a.js`; ', ''));
  write(root, { 'docs/README.md': mapText({ ab }) });
  renameSync(join(root, 'src/a.js'), join(root, 'other.js'));
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'candidate');
  fails(
    run(root, ['--base', 'HEAD^1'], 'Docs: `docs/README.md` — update: drops src/a.js'),
    'docs/A.md:docs-line',
    '`src/a.js`'
  );
});

// PR mode, must pass

test('each disposition passes', (t) => {
  for (const d of ['update: names the new path', 'still true: no change']) {
    passes(pr0(t, { 'src/a.js': `a ${d}\n` }, `Docs: \`docs/A.md\`, \`docs/B.md\` — ${d}`));
  }
});

test('bold, bullet, quote and CRLF line forms pass', (t) => {
  for (const body of [
    `## Docs\r\n\r\n**Docs:** \`docs/A.md\` — still true: abc; \`docs/B.md\` — still true: abc\r\n`,
    `- ${BOTH}`,
    `> ${BOTH}`,
    `* **Docs:** \`docs/A.md\` — still true: abc\n- Docs: \`docs/B.md\` — still true: abc`,
  ]) {
    passes(pr0(t, { 'src/a.js': `a ${body.length}\n` }, body));
  }
});

test('a heading-glob token covers every file it matches', (t) => {
  passes(pr0(t, { 'src/g.js': 'g2\n' }, 'Docs: `docs/g/*.md` — still true: no change'));
  fails(
    pr0(t, { 'src/g.js': 'g3\n' }, 'Docs: `docs/g/1.md` — still true: no change'),
    'docs/g/2.md:docs-line'
  );
});

test('a deleted Kept-true-by path covered by an entry passes', (t) => {
  const ab = BLOCK_AB.map((l) => l.replace('`src/a.js`; ', ''));
  passes(
    pr0(
      t,
      { 'src/a.js': null, 'docs/README.md': mapText({ ab }) },
      `${BOTH}\nDocs: \`docs/README.md\` — update: drops it`
    )
  );
});

test('a PR that edits a mapped doc must name it, even touching no Kept-true-by path', (t) => {
  const r = pr0(t, { 'docs/A.md': 'Alpha again.\n' }, '');
  fails(r, 'docs/A.md:docs-line: the PR edits it');
  assert.doesNotMatch(r.stderr, /docs\/B\.md:docs-line/);
  passes(pr0(t, { 'docs/A.md': 'Alpha again.\n' }, 'Docs: `docs/A.md` — update: reworded the intro'));
});

test('a PR that adds a mapped doc must name it', (t) => {
  fails(pr0(t, { 'docs/g/3.md': 'Three.\n' }, ''), 'docs/g/3.md:docs-line: the PR edits it');
});

test('a doc only an IMMUTABLE row covers needs no entry', (t) => {
  passes(pr0(t, { 'docs/history/H2.md': 'Appended record.\n' }, ''));
});

// Base-map branches

const INVALID_MAP = mapText({
  ab: BLOCK_AB.map((l) =>
    l.startsWith('- **Kept') ? '- **Kept true by:** the lib; `src/a.js`.' : l
  ),
});

test('an invalid base map is not read when nothing is deleted', (t) => {
  passes(
    pr0(
      t,
      { 'docs/README.md': mapText(), 'src/a.js': 'a2\n', 'src/new.js': 'n\n' },
      `${BOTH}\nDocs: \`docs/README.md\` — update: format`,
      { 'docs/README.md': INVALID_MAP }
    )
  );
});

test('an invalid base map exits 2 when a path is deleted', (t) => {
  const r = pr0(t, { 'docs/README.md': mapText(), 'docs/history/H.md': null }, BOTH, {
    'docs/README.md': INVALID_MAP,
  });
  exit2(r, /base map at HEAD\^1 is needed.*Kept true by: prose/);
});

test('a base without docs/README.md exits 2 when a path is deleted', (t) => {
  const r = pr0(t, { 'docs/README.md': mapText(), 'docs/history/H.md': null }, BOTH, {
    'docs/README.md': null,
  });
  exit2(r, /base map at HEAD\^1 is needed.*git show/);
});

// Units

test('countWords equals LC_ALL=C wc -w', () => {
  const buf = Buffer.from('a\tb  c\u00a0d\r\ne\u000bf\u000cg   \n\n h\u00a0 \r\n');
  const wc = spawnSync('wc', ['-w'], {
    input: buf,
    env: { ...process.env, LC_ALL: 'C' },
    encoding: 'utf8',
  });
  assert.equal(wc.status, 0);
  assert.equal(countWords(buf), Number(wc.stdout.trim()));
  assert.equal(countWords(buf), 7);
});

test('expandBraces expands several groups with an empty alternative', () => {
  assert.deepEqual(expandBraces('a{,-b}/{x/,y.z}'), ['a/x/', 'a/y.z', 'a-b/x/', 'a-b/y.z']);
});

test('`**/` matches direct and nested children', () => {
  const g = 'research/run_*/**/*.md';
  assert.ok(globMatches(g, 'research/run_a/X.md'));
  assert.ok(globMatches(g, 'research/run_a/s/t/X.md'));
  assert.ok(!globMatches(g, 'research/run_a/X.txt'));
  assert.ok(globMatches('src/', 'src/a/b.js'));
  assert.ok(!globMatches('src/*.js', 'src/a/b.js'));
});

test("this repo's doc map passes", () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
});
