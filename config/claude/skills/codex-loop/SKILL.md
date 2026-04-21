---
name: codex-loop
description: Iteratively review and refine a plan file using OpenAI Codex CLI until no blocking issues remain. Use when the user says "/codex-loop" (with or without a path) or asks to loop Codex review on a plan. If no path is given, infer the plan from conversation context or common locations (plan.md, PLAN.md, plans/*.md, docs/plan*.md). Each round, Codex reviews as lead architect, Claude addresses blockers in the plan, then re-submits — until Codex signals the plan is ready or max iterations hit.
---

# Codex Loop — Iterative Plan Review

Run Codex as a lead-architect reviewer in a convergence loop: Codex flags blockers, Claude fixes them in the plan file, repeat until the plan is approved or the loop stops.

## Usage

```
/codex-loop              # infer the plan file (see resolution rules)
/codex-loop <filepath>   # explicit path
```

## Resolving the plan file

If no filepath is given, find it in this order — stop at the first match:

1. **Conversation context**: a plan file the user and Claude were just working on in this session (drafted, edited, or discussed by path). Use it.
2. **Repo conventions**: glob for `plan.md`, `PLAN.md`, `plans/*.md`, `docs/plan*.md`, `.plans/*.md` in the cwd. If exactly one match, use it. If multiple, list them and ask the user to pick.
3. **Most recently modified markdown in `plans/` or `docs/plans/`**: if such a directory exists and contains `.md` files, offer the newest as the likely target.
4. **None found**: ask the user for the path. Do not guess.

Never invent a plan file that doesn't exist. Never run the loop against a file you had to create.

## Termination rules

Stop the loop when **any** of these are true:

1. **Approved**: Codex returns verdict `APPROVED`, or the only remaining `BLOCKER:` items are ones you've deliberately dismissed with reasoning (see "Address blockers" below).
2. **Max iterations**: 5 rounds completed.
3. **Repeated blocker**: A BLOCKER in round N substantively matches one already raised in a prior round *and* wasn't dismissed by you — means your edit didn't resolve it. Needs human.
4. **No progress**: Round N's count of un-dismissed blockers ≥ round N-1's (loop isn't converging).

On any stop condition other than #1, surface the reason to the user and ask whether to continue manually.

## Workflow

### Round 0 — setup

1. Resolve the filepath from cwd. Read the plan file. Error out if it doesn't exist.
2. Scan the plan for file paths, function names, module references. Read up to 5–10 directly-referenced files for codebase context. Also read `CLAUDE.md` if present.
3. Initialize an iteration log in memory (not a file): `{round, blockers_raised, blockers_addressed, blockers_dismissed, verdict, raw_output}`.

### Each round

1. **Build the prompt** (see template below), injecting:
   - Current plan contents
   - Codebase context (same set each round; don't re-scan)
   - Prior rounds' blockers (short summary) so Codex can detect if it's repeating itself
2. **Run Codex non-interactively**:
   ```bash
   cat <<'PROMPT' | codex exec -
   <prompt body>
   PROMPT
   ```
3. **Parse output**: extract verdict line and all `BLOCKER:` items. Ignore `SUGGESTION:` and `NIT:` items (don't act on them in the loop, but keep them in the final summary).
4. **Triage blockers**: for each BLOCKER, decide whether you actually agree it's a blocker. Codex is an advisor, not an authority — it can misread intent, push for changes outside the plan's scope, or be plain wrong about the codebase. Classify each as:
   - **Accept** — you agree; edit the plan to fix it.
   - **Dismiss** — you disagree; record a one-line rationale in the iteration log and carry it forward in "Prior Review History" so Codex sees *why* you're not acting on it. Dismissed blockers don't count toward termination rules 3 or 4.
   - **Defer to user** — legitimate concern but requires a design decision the plan's author should make. Stop the loop and ask the user.
   Don't dismiss casually — if Codex is probably right, accept it. But don't accept a blocker just because Codex flagged it.
5. **Check termination** (rules 1–4 above). If stopping, skip to "Final report."
6. **Address accepted blockers**: edit the plan file to fix each accepted BLOCKER. Don't rewrite structure, don't address suggestions/nits.
7. Log the round (including dismissed blockers and their rationale) and continue to the next round.

### Final report

Present to the user:
- Why the loop stopped (approved / max iterations / repeated blocker / no progress / user-decision needed)
- Per-round summary: blockers raised → accepted / dismissed / deferred
- All dismissed blockers with your rationale, so the user can overrule you if they disagree
- Full list of unaddressed SUGGESTIONs and NITs from the final round (the user may want to handle these manually)
- Path to the (now-updated) plan file

## Codex prompt template

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

Evaluate the plan across:

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

Tag every issue with exactly one of:

- `BLOCKER:` — the plan will fail, produce wrong behavior, or violate architectural standards if this isn't fixed. Must be addressed before implementation.
- `SUGGESTION:` — the plan works as-is, but there's a clearly better approach.
- `NIT:` — minor polish; safe to ignore.

If you can't decide between BLOCKER and SUGGESTION, it's a SUGGESTION. Reserve BLOCKER for things that genuinely break the plan.

## Output Format

Line 1 — verdict, exactly one of:
- `APPROVED` (no blockers, plan is ready to implement)
- `CHANGES REQUIRED` (one or more blockers)

Then, grouped by severity:

```
BLOCKER: <one-line summary>
  Where: <file/section of plan>
  Problem: <what's wrong>
  Fix: <concrete change to make>

SUGGESTION: ...
NIT: ...
```

Skip any severity with zero items. Do not pad with "this looks fine." If the plan is genuinely ready, just output `APPROVED` on line 1 and stop.
```

## Notes

- If `codex` CLI is not installed or fails, stop and tell the user.
- Keep the codebase context identical across rounds — the plan is what changes.
- Don't edit anything other than the plan file during the loop. If a blocker says "this function doesn't exist," that's a plan problem (the plan assumes the wrong API), not a cue to create the function.
- If the user's plan file is under version control, do **not** commit between rounds. The user reviews the final diff.
- Hard cap: 5 rounds. Don't make this configurable without a real reason.
