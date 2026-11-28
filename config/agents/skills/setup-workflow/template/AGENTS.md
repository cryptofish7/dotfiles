# AGENTS.md

Context for every AI coding agent session in {{PROJECT_NAME}}. It is harness-agnostic; `CLAUDE.md` imports it and adds Claude Code deltas.

## Project overview

{{PROJECT_NAME}}: {{ONE_LINE}}

[`docs/README.md`](docs/README.md) is the doc map: every doc's contract and where new content goes. This file is orientation only.

## Workflow

An orchestrator session coordinates and never writes a review: `planner` writes the plan, `reviewer` audits plans and diffs, and `implementer` writes the code. The orchestrator acts directly only for git, running commands and trivial 1-2 line fixes (typo, import, formatting); any fix that changes behaviour goes to `implementer`.

Any session that orchestrates a task, or that fetches, checks out, runs, reviews, pushes or merges work it did not write, MUST load `.claude/skills/project-workflow/SKILL.md` first; it holds the phases, the review model and the post-task pipeline. Agents read it at that path. A subagent started with a brief follows its brief and its role body (`.omp/agents/`) instead; "Leaving it clean" still binds it.

Only the owner, or a session the owner names, merges.

## Risk tiers

Every task is `routine` or `high-risk`, decided by what the change can do, not by its folder or language. A change is `high-risk` when it changes how the system:

- handles money: payments, billing, refunds, balances, pricing;
- decides who may do what: authentication, sessions, permissions, roles;
- handles secrets: keys, tokens, credentials, how they are loaded, stored or logged;
- reads, stores, exports or deletes personal or user data;
- runs destructive data operations: migrations, backfills, bulk deletes;
- deploys or configures production: infrastructure, deploy pipelines, production settings;
- does anything else irreversible or hard to roll back.

A comment-, doc- or test-only edit is `routine`. Unclear means `high-risk`; a disputed tier takes the higher one.

### High-risk here

{{HIGH_RISK_AREAS}}

### Reviews

- `reviewer` audits every plan that needs an audit and every diff.
- `high-risk` work adds an independent second review: a fresh session that never sees the first verdict, on a different model where one is available.
- Specialised reviewers (security, accessibility, performance, a domain auditor) are added here when the project needs them, each as an agent in `.omp/agents/` with the tier or paths it covers. None yet.

## Quality standards

- Prove it works: run it and show the output. A check you did not run is "not run".
- Fix the root cause; never add a guard that only silences the symptom. Fix every instance of the pattern.
- Test behaviour, not implementation: a test that still passes when the code under test returns nothing is rewritten or deleted.
- Subtract before you add: delete dead code, redundant validators and stale references first.
- Reuse and extend what exists before building something new.

## Documentation discipline

- **Doc map.** `docs/README.md` holds each doc's contract (Answers, Must contain, Must not contain, Kept true by, Size target) and the routing table "Where content goes". Read a doc's contract before editing it. A new doc gets a map block in the same PR and opens with a Purpose / Not for line.
- **Live docs.** A doc the map marks EDITABLE is edited in place: no changelog, dated entry or amendment section, because git log is the history. A contract (types, fields, defaults, env vars, schemas) is stated once, by the code or the doc that owns it; every other doc cites the owner. A change that adds to a doc deletes what it supersedes in the same PR.
- **No finished work in active docs.** Finished plans, run logs and incident write-ups never land in the repo; git history and the PR keep what matters.
- **PR body.** The orchestrator composes the `Docs:` and `Doc words:` lines (`.github/pull_request_template.md`) from the diff at PR time: every mapped doc the PR edits, and every doc whose Kept-true-by paths it touches, gets `update` or `still true`. CI (`scripts/ci/check-docs.mjs`) checks the map, the links and the `Docs:` line, and warns on a doc over its Size target.

## Commands

Run from the repo root.

{{COMMANDS}}

Agent and doc checks (Node, independent of the app's stack; CI runs them in `.github/workflows/agent-checks.yml`):

```bash
node scripts/ci/check-docs.mjs                 # doc map, links, sizes
node scripts/ci/gen-claude-agents.mjs          # regenerate .claude/agents from .omp/agents
node scripts/ci/gen-claude-agents.mjs --check  # fail on drift
node --test scripts/ci/__tests__/*.test.mjs   # tests of both scripts
```

## Git

- `{{DEFAULT_BRANCH}}` is always releasable. Branches: `feat/*`, `fix/*`, `chore/*`, `docs/*`, `ci/*`, `refactor/*`, `test/*`.
- Conventional commits: `type(scope): summary`. Squash-merge PRs.
- A PR body follows `.github/pull_request_template.md`, never `--fill`.

## Working folders

A task keeps its own storage in exactly these places:

- **Worktrees** next to the main checkout (`../<repo>-<slug>`), one per task or PR, created from `origin/{{DEFAULT_BRANCH}}`. Another session may be using the main checkout: every write and script run uses an absolute path inside the task's worktree.
- **`.evidence/`** in the main checkout (gitignored, each user's own): plans, review reports, briefs and non-secret run records, one folder per topic. A task in a worktree writes there by absolute path.
- **`/tmp`**: throwaway scratch, deleted when the task ends.

Never put a secret in `.evidence/`, the repo or `/tmp`. Never presume other untracked files disposable.

## Leaving it clean

- Cleanup is part of done on every exit path: stop your background jobs and watchers, delete your `/tmp` files, and delete untracked files you created in the main checkout.
- Delete a worktree and its branches only when its PR is merged or closed, or the work is abandoned. Before deleting unmerged work, push an `archive/<name>` tag at its tip and confirm it exists on origin.
- Never touch what another session owns: an open PR, or a worktree with uncommitted changes.
- The final report lists what was cleaned.

## Mistakes to avoid

Add a rule here only if all three hold: the failure is silent (review and tests miss it); the rule fits in three sentences; it states the durable invariant, not the incident. Otherwise the lesson goes in the PR, a code comment or a doc.

- **Don't trust a green status alone.** Check the actual outcome: a deploy is live, a migration applied, a job ran. Tell a dry run from a real one.
