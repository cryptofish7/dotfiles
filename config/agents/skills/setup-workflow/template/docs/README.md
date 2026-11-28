# {{PROJECT_NAME}} documentation

**Purpose:** the doc map: one contract per doc, the edit classes, the reading order and the routing table. **Not for:** the topics themselves (the owning doc in the map) or agent workflow ([`AGENTS.md`](../AGENTS.md) and the workflow skill).

## Reading order

1. [README](../README.md): what the project is and how to set it up.
2. [AGENTS.md](../AGENTS.md): what every agent session must know.
3. This map, then the doc that owns your topic.

## Edit classes

- **EDITABLE**: edited in place in the PR that changes what it describes (AGENTS.md "Documentation discipline"). No `(PR #N)` or `branch:` qualifiers, no "new in vN" markers, no tombstones (a one-line pointer is fine), no finished work, and no line-number citations into other editable docs (cite a section).
- **IMMUTABLE**: a signed or historical record; existing content is never edited, and append-only files take appends only.

## Doc map

Each doc has one block below: the question it answers, what it must and must not contain, the paths whose change can make a sentence of it false (a folder matches everything under it), and its size target. A PR that edits a mapped doc, or touches one of its Kept-true-by paths, gives the doc a disposition on the PR body's `Docs:` line. CI reads the headings, Kept true by and Size target (`scripts/ci/check-docs.mjs`; its header states the format), checks every tracked `.md` is covered, and warns on a doc over its target without failing.

### `README.md` (EDITABLE)

- **Answers:** What is this project, and how do I set it up and run it?
- **Must contain:** the project in one paragraph, prerequisites, setup and run steps, the project-layout table (one row per top-level folder, one for `.evidence/`), the documentation pointer, the license.
- **Must not contain:** agent workflow (`AGENTS.md`), per-command reference (`AGENTS.md` "Commands").
- **Kept true by:** `.gitignore`.
- **Size target:** 1,000 words.

### `AGENTS.md`, `CLAUDE.md` (EDITABLE)

- **Answers:** What must every agent session know to work in this repository?
- **Must contain:** overview, workflow, risk tiers and the high-risk areas, reviews, quality standards, documentation discipline, commands, git, working folders, leaving it clean, mistakes to avoid; `CLAUDE.md`: the Claude Code deltas.
- **Must not contain:** workflow procedure (the workflow skill), domain knowledge (the owning doc in this map).
- **Kept true by:** `.omp/agents/`; `.claude/skills/`; `scripts/ci/`; `.github/`.
- **Size target:** `AGENTS.md` 1,500 words; `CLAUDE.md` 300 words.

### `docs/README.md` (EDITABLE)

- **Answers:** Which doc owns what, and what is each doc's contract?
- **Must contain:** the reading order, the edit classes, one block per doc, the IMMUTABLE table, the routing table.
- **Must not contain:** the topics themselves.
- **Kept true by:** `scripts/ci/check-docs.mjs`.
- **Size target:** 1,500 words.

### `.github/pull_request_template.md` (EDITABLE)

- **Answers:** What must a PR body carry?
- **Must contain:** the Summary, Docs, Verification and Risk tier sections, with the `Docs:` line form CI accepts and the `Doc words:` line.
- **Must not contain:** review rules (the workflow skill).
- **Kept true by:** `scripts/ci/check-docs.mjs`; `.github/workflows/agent-checks.yml`.
- **Size target:** 300 words.

### `.omp/agents/*.md`, `.claude/agents/*.md` (EDITABLE; `.claude/agents` is generated)

- **Answers:** What does each agent role do?
- **Must contain:** each role's prompt. Edit the `.omp/agents` source; `scripts/ci/gen-claude-agents.mjs` writes the `.claude/agents` twins of the managed roles (planner, implementer, reviewer) and CI runs it with `--check`.
- **Must not contain:** workflow procedure (the workflow skill), project facts (`AGENTS.md`).
- **Kept true by:** `scripts/ci/gen-claude-agents.mjs`; `.claude/skills/project-workflow/SKILL.md`; `AGENTS.md`.
- **Size target:** `{.omp,.claude}/agents/reviewer.md` 1,000 words; others 500 words.

### `.claude/skills/**/*.md` (EDITABLE)

- **Answers:** How does an orchestrator run a task from plan to merge, and what does each repo skill do?
- **Must contain:** the workflow skill: phases, review model, post-task pipeline, cleanup; any other repo skill's procedure.
- **Must not contain:** project facts (`AGENTS.md`), role prompts (`.omp/agents`).
- **Kept true by:** `.omp/agents/`; `.github/pull_request_template.md`; `scripts/ci/`; `.github/workflows/agent-checks.yml`.
- **Size target:** 2,500 words.

### IMMUTABLE and append-only docs

One row per IMMUTABLE doc or glob (column 1, backticked). None yet.

| Doc | What it is | Edit |
| --- | ---------- | ---- |

## Where content goes

| Content | Goes to |
| ------- | ------- |
| What the project is, setup, layout | `README.md` |
| A rule every agent session needs | `AGENTS.md` |
| Workflow procedure | the workflow skill (`.claude/skills/project-workflow/SKILL.md`) |
| A role's prompt | `.omp/agents/<role>.md` |
| Product scope and decisions | a product doc, if the project keeps one (add its block to this map) |
| Why a past decision was made | a short decision record (add an IMMUTABLE row for its folder) |
| How code works | a code comment |
| What changed | the PR body and git log |
| Plans, reviews and non-secret run records | the main checkout's `.evidence/`, never the repo |
