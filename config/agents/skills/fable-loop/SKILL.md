---
name: fable-loop
description: Iteratively review and refine a plan file OR a PR/branch diff using a fresh Codex subagent pinned to the Fable model, until no blocking issues remain. Use when the user says "/fable-loop" (with or without an argument) or asks to loop Fable review. Auto-detects plan-loop vs PR-loop mode from the argument and conversation context. Each round, a Fable subagent reviews as lead architect, Codex addresses blockers, then re-submits — until Fable signals ready or max iterations hit.
---

# Fable Loop — Iterative Review

Run a Fable subagent as a lead-architect reviewer in a convergence loop: Fable flags blockers, Codex fixes them, repeat until the target is approved or the loop stops. Each round spawns a **fresh** Fable subagent (clean context, independent perspective).

Two modes:
- **Plan mode** — iteratively refine a plan file before implementation.
- **PR mode** — iteratively refine a PR / branch diff after implementation (Codex edits the working tree between rounds).

## Usage

```
/fable-loop                    # infer target from context (plan file OR current branch diff)
/fable-loop <filepath.md>      # plan-loop on a specific plan file
/fable-loop <PR#>              # PR-loop by number (e.g. /fable-loop 123 or /fable-loop #123)
/fable-loop pr                 # PR-loop on the current branch vs main
```

## Picking the mode

- Argument is a path to an existing `.md` file → **plan mode**
- Argument is a number, `#<num>`, `pr`, or `pr <num>` → **PR mode**
- No argument:
  1. If the user and Codex were just working on a specific plan file → **plan mode** with that file.
  2. Else if the current branch has commits ahead of `main` → **PR mode** on the branch diff.
  3. Else fall through to plan-file resolution (see Plan mode below). If still nothing, ask.

Never invent a target. Never run the loop against a file or branch you just created for this purpose.

## How each review runs

Every round, the review is performed by a **fresh subagent** launched with the Agent tool:

- `subagent_type: "general-purpose"`
- `model: "fable"` — pins the reviewer to Fable. Do **not** use `subagent_type: "fork"`: forks ignore the model override and inherit your model + context, which defeats the independent-reviewer purpose.
- A self-contained prompt carrying the lead-architect instructions, the current target (plan or diff), pointers to relevant files, and the prior-round history.

The subagent runs in the working directory with full read tools — instruct it to read referenced files itself. Each round is a new subagent; carry state across rounds yourself via the "Prior Review History" you inject (subagents don't share memory).

## Termination rules (both modes)

Stop the loop when **any** of these are true:

1. **Approved**: Fable returns verdict `APPROVED`, or the only remaining `BLOCKER:` items are ones you've deliberately dismissed with reasoning.
2. **Max iterations**: 5 rounds completed.
3. **Repeated blocker**: A BLOCKER in round N substantively matches one already raised in a prior round *and* wasn't dismissed by you — your edit didn't resolve it. Needs human.
4. **No progress**: Round N's count of un-dismissed blockers ≥ round N-1's (loop isn't converging).

On any stop condition other than #1, surface the reason to the user and ask whether to continue manually.

## Shared round loop

Each round, regardless of mode:

1. **Build the prompt** (see mode-specific templates), injecting:
   - Current target (plan contents OR diff + PR description)
   - Pointers to relevant files (gathered once in round 0; don't re-scan the tree each round)
   - Prior rounds' blockers (short summary) so the reviewer can detect repetition
2. **Launch the Fable subagent** (`subagent_type: "general-purpose"`, `model: "fable"`) with that prompt. Its final text is the review.
3. **Parse output**: extract the verdict line and all `BLOCKER:` items. Ignore `SUGGESTION:` and `NIT:` in the loop (but keep them for the final summary).
4. **Triage blockers**: for each BLOCKER, decide whether you actually agree. Fable is an advisor, not an authority. Classify as:
   - **Accept** — you agree; fix it (edit the plan or the code, depending on mode).
   - **Dismiss** — you disagree; record a one-line rationale and carry it forward in "Prior Review History" so the next round's reviewer sees *why*. Dismissed blockers don't count toward termination rules 3 or 4.
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
- In PR mode: summary of code changes made across rounds (leave them uncommitted or as per-round commits for the user to review)

---

## Plan mode

### Resolving the plan file

If no filepath is given and no plan is in conversation context, find one in this order — stop at the first match:

1. **Repo conventions**: glob for `plan.md`, `PLAN.md`, `plans/*.md`, `docs/plan*.md`, `.plans/*.md` in the cwd. If exactly one match, use it. If multiple, ask.
2. **Most recently modified markdown in `plans/` or `docs/plans/`**: offer the newest as the likely target.
3. **None found**: ask. Do not guess.

### Round 0 — setup (plan mode)

1. Resolve the filepath from cwd. Read the plan file. Error out if it doesn't exist.
2. Scan the plan for file paths, function names, module references. Note 5–10 directly-referenced files to point the subagent at. Note whether `AGENTS.md` exists.

### Addressing accepted blockers (plan mode)

Edit the plan file to fix each accepted BLOCKER. Don't rewrite structure, don't address suggestions/nits. Don't edit code — plan mode refines the plan, not the implementation.

### Fable prompt — plan mode

Launch with `subagent_type: "general-purpose"`, `model: "fable"`. Prompt body:

```
You are the LEAD ARCHITECT of this project, reviewing an implementation plan before work begins. You own the technical direction and have veto authority over what ships.

Your job: find issues that will cause the implementation to fail, waste time, or produce the wrong thing. Be direct. Assume the author is a competent engineer who wants real feedback, not reassurance.

You are running in the project's working directory with full read access. Read any referenced file before judging — verify against the actual code, do not assume.

## The Plan

<INSERT PLAN CONTENTS>

## Key files this plan touches (read these first)

<INSERT LIST OF FILE PATHS THE PLAN REFERENCES; note if AGENTS.md exists>

## Prior Review History (for context — do not re-raise resolved or dismissed issues)

<INSERT SHORT SUMMARY OF PRIOR ROUNDS' BLOCKERS (resolved) AND DISMISSED BLOCKERS WITH THE AUTHOR'S RATIONALE, OR "none — this is round 1">

If you still believe a dismissed blocker matters, say so once with a stronger argument — don't re-raise it verbatim.

## Review Dimensions

1. **Missing steps** — migrations, config, deps, build, rollback
2. **Wrong assumptions** — files/functions/APIs that don't exist or behave differently (read them to confirm)
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

BLOCKER: <one-line summary>
  Where: <file/section of plan>
  Problem: <what's wrong>
  Fix: <concrete change to make>

SUGGESTION: ...
NIT: ...

Skip any severity with zero items. Do not pad with "this looks fine." If the plan is ready, output `APPROVED` on line 1 and stop.
```

---

## PR mode

### Resolving the diff

- **PR number given** (`/fable-loop 123` or `/fable-loop #123`):
  ```bash
  gh pr view <#> --json title,body,baseRefName,headRefName
  gh pr diff <#>
  ```
  If the PR is on a remote branch that isn't checked out locally, stop and ask the user to check it out first — you'll need to edit files between rounds.
- **`/fable-loop pr` or inferred**: use the current branch against its base.
  ```bash
  git log --oneline main..HEAD
  git diff main...HEAD
  ```
  If the base isn't `main`, detect via `gh pr view --json baseRefName` or ask.

### Round 0 — setup (PR mode)

1. Capture the base branch and diff. Confirm the working tree is clean (no uncommitted changes) — if not, stop and ask the user, since the loop will make edits.
2. List changed files. Note heavily-changed or context-critical ones to tell the subagent to read in full (not just hunks). Cap at ~10.
3. Note whether `AGENTS.md` exists.
4. Re-generate the diff at the *start of each subsequent round* — it changes as you commit fixes. (See "Addressing accepted blockers" below.)

### Addressing accepted blockers (PR mode)

Edit the working tree to fix each accepted BLOCKER. Commit each round's fixes as a separate commit on the current branch with a message like `fix: address fable-loop round N blockers`. This keeps the loop auditable and lets the user revert a round if they disagree with your fixes. Do **not** force-push or amend prior commits.

Don't act on SUGGESTIONs or NITs in the loop. Don't refactor beyond what blockers require.

### Fable prompt — PR mode

Launch with `subagent_type: "general-purpose"`, `model: "fable"`. Prompt body:

```
You are the LEAD ARCHITECT of this project, reviewing a pull request before it merges. You own the technical direction and have veto authority over what ships.

Your job: find issues that will cause bugs, regressions, security problems, or merge of wrong behavior. Be direct. Assume the author is a competent engineer who wants real feedback, not reassurance.

You are running in the project's working directory with full read access. The diff below is the source of truth for what changed, but read the full files it touches (and their callers) before judging — do not reason from hunks alone.

## PR Description

<INSERT PR TITLE AND BODY, OR "Local branch, no PR description" IF NONE>

## Diff (current state — reflects any fixes from prior rounds)

<INSERT CURRENT DIFF>

## Files to read in full (heavily changed or context-critical)

<INSERT LIST OF FILE PATHS; note if AGENTS.md exists>

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
8. **Convention violations** — contradicts AGENTS.md or established patterns in surrounding code
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

BLOCKER: <one-line summary>
  Where: <file:line>
  Problem: <what's wrong>
  Fix: <concrete change to make>

SUGGESTION: ...
NIT: ...

Skip any severity with zero items. Do not pad with "this looks fine." If the PR is ready, output `APPROVED` on line 1 and stop.
```

---

## Notes

- Requires the Agent tool with a `model: "fable"` override (Fable must be available on the plan). If a subagent can't run on Fable, stop and tell the user rather than silently falling back to another model.
- If `gh` is needed but not installed or a command fails, stop and tell the user.
- Keep the pointed-at file set stable across rounds in plan mode. In PR mode, re-generate the diff each round (it changes) but keep the read-files set stable unless a fix adds a new relevant file.
- Plan mode: never edit code. PR mode: only edit code, never edit the plan.
- Hard cap: 5 rounds. Don't make this configurable without a real reason.
- PR mode commits fixes to the current branch but never pushes, never force-pushes, and never amends prior commits. The user reviews and pushes when ready.
- Each round is a fresh subagent with no memory of prior rounds — the only continuity is the "Prior Review History" you inject. Keep it accurate.
