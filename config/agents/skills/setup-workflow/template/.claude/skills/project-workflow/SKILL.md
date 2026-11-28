---
name: project-workflow
description: Use when orchestrating a task in this repo, or when fetching, checking out, running, reviewing, pushing or merging work (a branch, PR, commit, patch or plan) you did not write — planning, delegating to planner/implementer/reviewer, risk tiers and review layers, the post-task pipeline, merging and cleanup.
---

# Project workflow

The agent workflow for this repo. `AGENTS.md` still applies in full; its "Risk tiers" and "High-risk here" decide every tier below.

## Roles

- **Orchestrator**: the session the owner talks to. It coordinates, routes data between subagents, runs git and commands, and makes trivial 1-2 line fixes (typo, import, formatting). It never writes a review and never writes behaviour; a fix that changes behaviour goes to `implementer`, whatever its length.
- **`planner`** writes the plan; **`implementer`** writes the code; **`reviewer`** audits plans and diffs. Bodies: `.omp/agents/` (Claude Code twins in `.claude/agents/`, generated).
- **Models.** Bind per-role models in the harness (omp: a `model:` line in the agent or `modelRoles` in `.omp/config.yml`). The reviewer should run on a different model family than the implementer where one is available. No prose doc names a model.

## Briefs

Every subagent brief has three parts:

- **Target**: the outcome, the role, the worktree (absolute path), writable and forbidden paths, the output.
- **Change**: the sources, the settled decisions, the base SHA, the plan it designates (absolute path).
- **Acceptance**: done predicates, allowed commands, the report format, and "stop and report" on any surprise.

The designated plan governs every phase. Plans live at `<main checkout>/.evidence/plans/<topic>.md`; the main checkout is the first entry of `git worktree list`.

## Phases

- **Start.** From a clean, updated `{{DEFAULT_BRANCH}}` (`git fetch origin {{DEFAULT_BRANCH}}`), take the task from the owner, the tracker or an issue. A bug fix starts from its issue and puts `Fixes #N` in the PR body.
- **Phase 0 — owner questions first.** List the task's open product, risk, wall-clock and cost questions and ask the owner once, in one message. The answers travel in the planner brief's Change as decisions. With no open question, record that and ask nobody.
- **Phase 1 — plan.** Designate the plan path; `planner` writes it, tagging each task `routine` or `high-risk` with the effect that decides it.
- **Phase 2 — design audit, by risk.** `reviewer` audits the plan when any of these holds: a task is `high-risk`; the work is long-running or irreversible (a data migration, a production deploy, a multi-day run); a routine task adds or changes a guard, a CI check or a workflow rule. High-risk plans also get the independent second review ("Review model"). Before skipping an audit, check the tags against these triggers; unclear means audit, a disputed tier takes the higher.
  - **Rounds.** At most 2. After round 1, the orchestrator records either small, concrete fixes (`planner` applies them; for a routine plan nobody re-audits) or redesign (`planner` rewrites; round 2 re-audits only the blockers and the changed text, with the previous verdict and the plan diff in its brief). The previous revision is kept as `<topic>.r<N>.md`.
  - **After round 2** with blockers still open, the orchestrator either asks the owner or starts faster mode (below), recording every open blocker in the PR and in the code review brief.
  - **Prerequisites stop the build.** In every branch (round-1 fixes, round 2, faster mode), an unresolved owner prerequisite, or one a required specialised reviewer sets (`AGENTS.md` "Reviews"), goes to the owner and no build starts until it is resolved.
  - Every open `DETAIL` and every round-1 `BLOCKER` fixed without a re-audit goes into the build brief and the code review brief.
- **Scope change restarts.** A different goal or a materially larger task set (a new high-risk task, a new area), even when an audit finding prompted it, restarts at Phase 0 with a fresh plan, round count and full first audit; the orchestrator records what changed. A fix that keeps the goal, the tiers and the reach is no scope change. Unclear: ask the owner.
- **Phase 3 — build.** On a feature branch in its own worktree, `implementer` builds. Each brief names a bounded set of the plan's tasks and the open `DETAIL`s. Parallel briefs get disjoint writable paths; a caller of a changed function goes to whoever changes that function; a needed file outside a brief's set is stop-and-report.
- **Phase 4 — code review.** One review round per head (pipeline Step 5). `CODE FAIL` → `implementer` fixes, then re-review. At most 3 rounds, then stop and ask the owner.

### Faster mode

The orchestrator may compress the flow, recording the choice in the PR:

- after the plan-audit round cap, build with the open blockers recorded, so the code review judges them on the code;
- for a routine plan that Phase 2 does not trigger, go straight from plan to build;
- give parallel implementers disjoint task sets.

Faster mode never skips a code review, the second review of high-risk work, an unresolved owner or specialised-reviewer prerequisite, or the merge gate.

## Review model

Procedural, not enforced by tooling.

| Tier | Plan audit (when Phase 2 triggers) | Code review |
| --- | --- | --- |
| `routine` | `reviewer` | `reviewer` |
| `high-risk` | `reviewer` + independent second review | `reviewer` + independent second review |

- **Independent second review.** A second `reviewer` run in a fresh session whose brief carries neither the first verdict nor its findings and says it is the second review, on a different model family where the harness offers one (otherwise a fresh session of the same model). The record names both models. Both must pass.
- **Specialised reviewers.** Added in `AGENTS.md` "Reviews" with the tier or paths they cover; they review in parallel with `reviewer` and count like it.
- **Review sessions.** The reviewing session fetches `origin/{{DEFAULT_BRANCH}}`, records the SHA, and launches the reviewer from a clean checkout at exactly that SHA, never the PR worktree. For a diff review, CAND is the PR head and BASE is the merge-base of CAND and that SHA. The brief names the worktree, BASE, CAND, the slice paths, the plan file and a local snapshot of the PR body (`gh pr view <n> -R "$REPO" --json headRefOid,body`). A PR never reviews its own new or changed roles.
- **Classification.** Before a code review, the orchestrator checks the actual diff (`git diff --name-only <BASE> <CAND>`, then the hunks) against the plan's tags, splits it into slices by tier, and gives each review its slice paths. A hunk with a high-risk effect goes to the high-risk slice whatever its task's tag.
- **Docs claims.** The orchestrator puts the PR body's `Docs:` line in each code review brief, and the Must-not-contain list of each doc the slice edits.
- **Blockers, details and notes.** Reviewers label findings as their body defines. Only a `BLOCKER` holds a merge. A `NOTE` is fixed only if the owner asks; the notes go to the owner as one short list. The orchestrator adjudicates disagreements between the two reviews: a security or correctness `BLOCKER` from either is acted on unless a recorded command disproves it ("not run" disproves nothing).
- **Containment.** No review brief allows a request to any host. Reviewers never run candidate code; a check that needs it is "not run" until the orchestrator has read the code and has `implementer` run it.

## Accepting results

- Accept a subagent's result only when it completed and returned the full report its body defines. A failed, aborted or partial result, and anything it sent before stopping, yields no verdict, pass or completion.
- Where the harness shows a subagent's resolved model, compare it with the binding; a review that silently ran on a fallback model is reported to the owner, and a "different model" second review that ran on the first review's model counts as same-model.
- A rejected writer's changes are saved as a diff outside the worktree and taken out of it, so the retry starts clean. One retry, then stop for the owner.

## After completing a task — pipeline

- **Step 1 — verify.** `implementer` runs lint, format, typecheck and tests (`AGENTS.md` "Commands") and reports each as pass, fail or "not run". The orchestrator re-runs the full verify set itself.
- **Step 2 — helpers.** For a large diff, parallel general-purpose helpers check what the plan calls for (CI cost of a workflow change, a deploy's config). The orchestrator does it itself for a small diff.
- **Step 3 — commit** with hooks on.
- **Step 4 — PR.** Resolve the repository once: `ORIGIN_URL="$(git remote get-url origin)" && [ -n "$ORIGIN_URL" ]`, then `REPO="$(gh repo view "$ORIGIN_URL" --json nameWithOwner -q .nameWithOwner)" && [ -n "$REPO" ]`; if either fails, stop. Every `gh` command names `-R "$REPO"`. Push and open the PR with a body from `.github/pull_request_template.md`, never `--fill`. The orchestrator composes `Docs:` and `Doc words:` from the diff's name list against the doc map, and fills Risk tier.
- **Step 5 — review and CI in parallel.** Each slice's code review by tier ("Review model"); CI is every check `gh pr checks <n> -R "$REPO"` lists.
- **Handling results.** Every push re-runs every required review; a review of an older head does not count, except after a note-only push: if the diff from the reviewed head only fixes listed notes and touches no high-risk behaviour, the orchestrator records that in the PR and the new head counts as reviewed once CI is green. CI retry cap: 3.
- **Merge gate.** On the head being merged: every slice's required reviews passed (high-risk: both); no `BLOCKER` open; the notes went to the owner; every faster-mode blocker is fixed or the owner accepted it in the PR thread; CI green; the live `Docs:` line equals the snapshot the review read (a changed line is re-reviewed or restored). Immediately before merging, fetch `origin/{{DEFAULT_BRANCH}}`; if it changed `AGENTS.md`, `CLAUDE.md`, `.omp/**`, `.claude/**` or `docs/README.md` since the review's SHA, rebase and repeat the reviews.
- **Merge record.** One PR comment before merging: the reviewed head SHA, each review's verdict and model, the second review's independence (different model or same model), the notes sent to the owner, faster-mode choices and how each open blocker was settled.
- **Step 6 — merge.** `gh pr merge <n> -R "$REPO" --squash --delete-branch --match-head-commit <reviewed head>`. Done when CI on `{{DEFAULT_BRANCH}}` for the merged SHA is green and any deploy it triggers succeeded; never deploy by hand outside the project's pipeline. On a merge conflict: confirm the worktree tip is the reviewed CAND, rebase on fresh `origin/{{DEFAULT_BRANCH}}`, push with `--force-with-lease=<branch>:<CAND>`, and review the new head. One retry, then ask the owner.
- **Step 7 — cleanup** (`AGENTS.md` "Leaving it clean"): once the PR is merged, delete the worktree folder, then `git worktree prune` and `git branch -D <branch>`; stop jobs, delete `/tmp` files, and list what was cleaned.

## Docs review

Every 14 days, or when the owner asks, one helper with no task context reads `{{DEFAULT_BRANCH}}` at a pinned SHA and judges each live doc against its own map block: it answers its Answers question; it holds no Must-not-contain item; five claims taken from it match the code under Kept true by. It returns one cut/fix list for the owner, including every doc over its Size target. Nothing is cut without the owner's decision; then the trims land in one PR.

## Worktrees and leaving it clean

- One worktree per task or PR, next to the main checkout, created from `origin/{{DEFAULT_BRANCH}}`. Every write and script run uses an absolute path inside it; another session may be using the main checkout.
- Plans, briefs and review reports go to the main checkout's `.evidence/` by absolute path; nothing secret goes there.
- Blocked or handed-off work keeps its worktree and branch; the hand-off names them. Before deleting unmerged work, push `archive/<name>` at its tip and confirm it on origin.
- Never touch an open PR or a worktree with uncommitted changes that another session owns.
