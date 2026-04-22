---
name: codex-loop
description: Iteratively review and refine a plan file OR a PR/branch diff using OpenAI Codex CLI until no blocking issues remain. Use when the user says "/codex-loop" (with or without an argument) or asks to loop Codex review. Auto-detects plan-loop vs PR-loop mode from the argument and conversation context. Each round, Codex reviews as lead architect, Claude addresses blockers, then re-submits — until Codex signals ready or max iterations hit.
---

# Codex Loop — Iterative Review

Run Codex as a lead-architect reviewer in a convergence loop: Codex flags blockers, Claude fixes them, repeat until the target is approved or the loop stops.

Two modes:
- **Plan mode** — iteratively refine a plan file before implementation.
- **PR mode** — iteratively refine a PR / branch diff after implementation (Claude edits the working tree between rounds).

## Usage

```
/codex-loop                    # infer target from context (plan file OR current branch diff)
/codex-loop <filepath.md>      # plan-loop on a specific plan file
/codex-loop <PR#>              # PR-loop by number (e.g. /codex-loop 123 or /codex-loop #123)
/codex-loop pr                 # PR-loop on the current branch vs main
```

## Picking the mode

- Argument is a path to an existing `.md` file → **plan mode**
- Argument is a number, `#<num>`, `pr`, or `pr <num>` → **PR mode**
- No argument:
  1. If the user and Claude were just working on a specific plan file → **plan mode** with that file.
  2. Else if the current branch has commits ahead of `main` → **PR mode** on the branch diff.
  3. Else fall through to plan-file resolution (see Plan mode below). If still nothing, ask.

Never invent a target. Never run the loop against a file or branch you just created for this purpose.

## Termination rules (both modes)

Stop the loop when **any** of these are true:

1. **Approved**: Codex returns verdict `APPROVED`, or the only remaining `BLOCKER:` items are ones you've deliberately dismissed with reasoning.
2. **Max iterations**: 5 rounds completed.
3. **Repeated blocker**: A BLOCKER in round N substantively matches one already raised in a prior round *and* wasn't dismissed by you — your edit didn't resolve it. Needs human.
4. **No progress**: Round N's count of un-dismissed blockers ≥ round N-1's (loop isn't converging).

On any stop condition other than #1, surface the reason to the user and ask whether to continue manually.

## Shared round loop

Each round, regardless of mode:

1. **Build the prompt** (see mode-specific templates), injecting:
   - Current target (plan contents OR diff + PR description)
   - Codebase context (gathered once in round 0; don't re-scan)
   - Prior rounds' blockers (short summary) so Codex can detect repetition
2. **Run Codex non-interactively**:
   ```bash
   cat <<'PROMPT' | codex exec -
   <prompt body>
   PROMPT
   ```
3. **Parse output**: extract verdict line and all `BLOCKER:` items. Ignore `SUGGESTION:` and `NIT:` in the loop (but keep them for the final summary).
4. **Triage blockers**: for each BLOCKER, decide whether you actually agree. Codex is an advisor, not an authority. Classify as:
   - **Accept** — you agree; fix it (edit the plan or the code, depending on mode).
   - **Dismiss** — you disagree; record a one-line rationale and carry it forward in "Prior Review History" so Codex sees *why*. Dismissed blockers don't count toward termination rules 3 or 4.
   - **Defer to user** — legitimate concern but needs a human decision. Stop the loop and ask.
   Don't dismiss casually.
5. **Check termination**. If stopping, skip to "Final report."
6. **Address accepted blockers** (mode-specific — see below).
7. Log the round and continue.

### Final report

- Why the loop stopped (approved / max iterations / repeated blocker / no progress / user-decision needed)
- Per-round summary: blockers raised → accepted / dismissed / deferred
- Dismissed blockers with rationale (so the user can overrule you)
- Unaddressed SUGGESTIONs and NITs from the final round
- In plan mode: path to the updated plan file
- In PR mode: summary of code changes made across rounds (leave them uncommitted for the user to review)

---

## Plan mode

### Resolving the plan file

If no filepath is given and no plan is in conversation context, find one in this order — stop at the first match:

1. **Repo conventions**: glob for `plan.md`, `PLAN.md`, `plans/*.md`, `docs/plan*.md`, `.plans/*.md` in the cwd. If exactly one match, use it. If multiple, ask.
2. **Most recently modified markdown in `plans/` or `docs/plans/`**: offer the newest as the likely target.
3. **None found**: ask. Do not guess.

### Round 0 — setup (plan mode)

1. Resolve the filepath from cwd. Read the plan file. Error out if it doesn't exist.
2. Scan the plan for file paths, function names, module references. Read 5–10 directly-referenced files. Also read `CLAUDE.md` if present.

### Addressing accepted blockers (plan mode)

Edit the plan file to fix each accepted BLOCKER. Don't rewrite structure, don't address suggestions/nits. Don't edit code — plan mode refines the plan, not the implementation.

### Codex prompt — plan mode

```
You are the LEAD ARCHITECT of this project, reviewing an implementation plan before work begins. You own the technical direction and have veto authority over what ships.

Your job: find issues that will cause the implementation to fail, waste time, or produce the wrong thing. Be direct. Assume the author is a competent engineer who wants real feedback, not reassurance.

## The Plan

<INSERT PLAN CONTENTS>

## Codebase Context

<INSERT RELEVANT FILE CONTENTS AND CLAUDE.MD CONVENTIONS>

## Prior Review History (for context — do not re-raise resolved or dismissed issues)

<INSERT SHORT SUMMARY OF PRIOR ROUNDS' BLOCKERS (resolved) AND DISMISSED BLOCKERS WITH THE AUTHOR'S RATIONALE, OR "none — this is round 1">

If you still believe a dismissed blocker matters, say so once with a stronger argument — don't re-raise it verbatim.

## Review Dimensions

1. **Missing steps** — migrations, config, deps, build, rollback
2. **Wrong assumptions** — files/functions/APIs that don't exist or behave differently
3. **Ordering** — steps that depend on later steps
4. **Side effects** — tests, types, schemas, env vars, docs, callers
5. **Integration** — interface mismatches, missing wiring
6. **Edge cases** — failure modes the plan ignores
7. **Scope** — too much in one pass, or missing work that blocks completion
8. **Verification** — how will we know it worked?
9. **Architectural fit** — does this match the project's existing patterns and conventions? Would you, as lead architect, approve this direction?

## Severity tags (REQUIRED)

- `BLOCKER:` — the plan will fail, produce wrong behavior, or violate architectural standards if this isn't fixed.
- `SUGGESTION:` — the plan works as-is, but there's a clearly better approach.
- `NIT:` — minor polish; safe to ignore.

If you can't decide between BLOCKER and SUGGESTION, it's a SUGGESTION.

## Output Format

Line 1 — verdict, exactly one of:
- `APPROVED`
- `CHANGES REQUIRED`

Then, grouped by severity:

```
BLOCKER: <one-line summary>
  Where: <file/section of plan>
  Problem: <what's wrong>
  Fix: <concrete change to make>

SUGGESTION: ...
NIT: ...
```

Skip any severity with zero items. Do not pad with "this looks fine." If the plan is ready, output `APPROVED` on line 1 and stop.
```

---

## PR mode

### Resolving the diff

- **PR number given** (`/codex-loop 123` or `/codex-loop #123`):
  ```bash
  gh pr view <#> --json title,body,baseRefName,headRefName
  gh pr diff <#>
  ```
  If the PR is on a remote branch that isn't checked out locally, stop and ask the user to check it out first — you'll need to edit files between rounds.
- **`/codex-loop pr` or inferred**: use the current branch against its base.
  ```bash
  git log --oneline main..HEAD
  git diff main...HEAD
  ```
  If the base isn't `main`, detect via `gh pr view --json baseRefName` or ask.

### Round 0 — setup (PR mode)

1. Capture the base branch and diff. Confirm the working tree is clean (no uncommitted changes) — if not, stop and ask the user, since the loop will make edits.
2. List changed files. For files with heavy changes or context-critical ones, plan to read full contents (not just hunks). Cap at ~10.
3. Read `CLAUDE.md` if present.
4. Re-read the diff at the *start of each subsequent round* — it changes as you commit fixes. (See "Addressing accepted blockers" below.)

### Addressing accepted blockers (PR mode)

Edit the working tree to fix each accepted BLOCKER. Commit each round's fixes as a separate commit on the current branch with a message like `fix: address codex-loop round N blockers`. This keeps the loop auditable and lets the user revert a round if they disagree with your fixes. Do **not** force-push or amend prior commits.

Don't act on SUGGESTIONs or NITs in the loop. Don't refactor beyond what blockers require.

### Codex prompt — PR mode

```
You are the LEAD ARCHITECT of this project, reviewing a pull request before it merges. You own the technical direction and have veto authority over what ships.

Your job: find issues that will cause bugs, regressions, security problems, or merge of wrong behavior. Be direct. Assume the author is a competent engineer who wants real feedback, not reassurance.

## PR Description

<INSERT PR TITLE AND BODY, OR "Local branch, no PR description" IF NONE>

## Diff (current state — reflects any fixes from prior rounds)

<INSERT CURRENT DIFF>

## Relevant File Contents

<INSERT FULL CONTENTS OF HEAVILY-CHANGED OR CONTEXT-CRITICAL FILES>

## Project Conventions

<INSERT CLAUDE.MD CONTENTS IF PRESENT>

## Prior Review History (for context — do not re-raise resolved or dismissed issues)

<INSERT SHORT SUMMARY OF PRIOR ROUNDS' BLOCKERS (resolved) AND DISMISSED BLOCKERS WITH THE AUTHOR'S RATIONALE, OR "none — this is round 1">

If you still believe a dismissed blocker matters, say so once with a stronger argument — don't re-raise it verbatim.

## Review Dimensions

1. **Correctness / bugs** — logic errors, off-by-one, null handling, wrong operators, race conditions, incorrect async
2. **Regressions** — breaks existing callers, tests, or behavior; removed code that was still in use
3. **Security** — input validation, injection, auth/authz, secrets, unsafe deserialization, SSRF, path traversal
4. **Error handling** — swallowed exceptions, ignored returns, wrong error types, missing cleanup
5. **API / interface correctness** — breaking changes to public APIs, typos, mismatched types across module boundaries
6. **Missing tests** — new behavior without coverage, or tests that don't exercise the change
7. **Performance red flags** — N+1 queries, unbounded loops, sync work in hot paths, O(n²)
8. **Convention violations** — contradicts CLAUDE.md or established patterns in surrounding code
9. **Dead / suspicious code** — unused imports, commented-out blocks, stale TODOs, AI-slop comments
10. **Architectural fit** — does this match the project's direction? Would you, as lead architect, approve merge?

## Severity tags (REQUIRED)

- `BLOCKER:` — merging this causes bugs, regressions, security issues, or violates architectural standards. Must be fixed before merge.
- `SUGGESTION:` — works as-is, but there's a clearly better approach.
- `NIT:` — minor polish; safe to ignore.

If you can't decide between BLOCKER and SUGGESTION, it's a SUGGESTION.

## Output Format

Line 1 — verdict, exactly one of:
- `APPROVED`
- `CHANGES REQUIRED`

Then, grouped by severity:

```
BLOCKER: <one-line summary>
  Where: <file:line>
  Problem: <what's wrong>
  Fix: <concrete change to make>

SUGGESTION: ...
NIT: ...
```

Skip any severity with zero items. Do not pad with "this looks fine." If the PR is ready, output `APPROVED` on line 1 and stop.
```

---

## Notes

- If `codex` or `gh` is not installed or a command fails, stop and tell the user.
- Keep the codebase context identical across rounds in plan mode. In PR mode, re-read the diff each round (it changes) but keep the read-files set stable unless a fix adds a new relevant file.
- Plan mode: never edit code. PR mode: only edit code, never edit the plan.
- Hard cap: 5 rounds. Don't make this configurable without a real reason.
- PR mode commits fixes to the current branch but never pushes, never force-pushes, and never amends prior commits. The user reviews and pushes when ready.
