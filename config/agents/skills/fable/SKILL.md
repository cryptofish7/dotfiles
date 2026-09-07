---
name: fable
description: Review a plan file or a PR/branch diff using a fresh Codex subagent pinned to the Fable model. Use when the user says "/fable" (with or without an argument) or asks to review something with Fable. Auto-detects plan-review vs PR-review mode from the argument and conversation context.
---

# Fable Review

Use a fresh Codex subagent pinned to the **Fable** model as a second set of eyes — either on an implementation plan (before work begins) or on a PR / branch diff (after work is done). Because the reviewer runs on a different model with clean context, it's an independent perspective, not an echo of the current session.

## Usage

```
/fable                    # infer target from context (plan file OR current branch diff)
/fable <filepath.md>      # explicit plan review
/fable <PR#>              # PR review by number (e.g. /fable 123 or /fable #123)
/fable pr                 # review the current branch's diff against main
```

## Picking the mode

Decide **plan mode** vs **PR mode** from the argument and context:

- Argument is a path to an existing `.md` file → **plan mode**
- Argument is a number, `#<num>`, `pr`, or `pr <num>` → **PR mode**
- No argument:
  1. If the user and Codex were just working on a specific plan file in this session → **plan mode** with that file.
  2. Else if the current branch has commits ahead of `main` (`git rev-list --count main..HEAD` > 0) → **PR mode** on the branch diff.
  3. Else fall through to plan-file resolution (see below). If still nothing, ask.

Never invent a target. Never run the review against a file or branch you just created for this purpose.

## How the review runs (both modes)

The review is performed by a **fresh subagent**, launched with the Agent tool:

- `subagent_type: general-purpose`
- `model: fable` — pins the reviewer to the Fable model (do **not** use `subagent_type: fork`; forks ignore the model override and inherit your model + context, defeating the point).
- The prompt is fully self-contained: it carries the lead-architect instructions, the target (plan contents or diff), and pointers to relevant files.

The subagent runs in the same working directory with full read tools, so tell it to **read any referenced files it needs** for context rather than relying only on what you inject. You still inject the plan/diff and name the key files, but the subagent can pull more on its own.

Its final text is the review — it is not shown to the user directly, so relay it (see "Evaluating output").

## Plan mode

### Resolving the plan file

If no filepath is given and no plan is in conversation context, find one in this order — stop at the first match:

1. **Repo conventions**: glob for `plan.md`, `PLAN.md`, `plans/*.md`, `docs/plan*.md`, `.plans/*.md` in the cwd. If exactly one match, use it. If multiple, list them and ask the user to pick.
2. **Most recently modified markdown in `plans/` or `docs/plans/`**: if such a directory exists and contains `.md` files, offer the newest as the likely target.
3. **None found**: ask the user for the path. Do not guess.

### Workflow

1. Read the plan file.
2. Scan it for file paths, function names, or module references. Note the key ones (up to 5–10) so you can point the subagent at them. Also note whether `AGENTS.md` exists.
3. Launch the Fable subagent with the prompt below.

```
Agent(
  subagent_type: "general-purpose",
  model: "fable",
  description: "Fable plan review",
  prompt: <the PROMPT below, with placeholders filled in>
)
```

Prompt body:

```
You are the LEAD ARCHITECT of this project, reviewing an implementation plan before work begins. You own the technical direction and have veto authority over what ships.

Your job: find issues that will cause the implementation to fail, waste time, or produce the wrong thing. Be direct. Assume the author is a competent engineer who wants real feedback, not reassurance.

You are running in the project's working directory with full read access. Read any file referenced below (or that you suspect is relevant) before judging — do not assume, verify against the actual code.

## The Plan

<INSERT PLAN CONTENTS>

## Key files this plan touches (read these first)

<INSERT LIST OF FILE PATHS THE PLAN REFERENCES; note if AGENTS.md exists so the reviewer reads project conventions>

## Review Checklist

Go through each item. For each, either say "OK" or flag the specific problem.

1. **Missing steps**: Are there steps the plan assumes but doesn't list? (migrations, config changes, dependency installs, build steps)
2. **Wrong assumptions**: Does the plan reference files, functions, types, or APIs that don't exist or work differently than assumed? (Read the files to confirm.)
3. **Ordering issues**: Are steps in the wrong order? Would any step fail because a prerequisite hasn't happened yet?
4. **Forgotten side effects**: Does the plan account for everything that needs to change? (tests, types, event handlers, DB schemas, env vars)
5. **Integration gaps**: Will the pieces actually connect? Interface mismatches, missing imports, type incompatibilities?
6. **Edge cases and error handling**: Does the plan ignore obvious failure modes?
7. **Scope creep or under-scoping**: Too much in one pass, or missing work that will block completion?
8. **Testing gap**: Enough verification to know it worked?
9. **Architectural fit**: Does this match the project's existing patterns and conventions? Would you, as lead architect, approve this direction?

## Output Format

- Lead with a 1-line verdict: "Looks solid", "Has gaps", or "Needs rework"
- Then list only the problems found, grouped by checklist item number
- For each problem: state what's wrong and suggest a fix
- Skip items that are OK — don't pad with "this looks fine"
```

## PR mode

### Resolving the diff

- **PR number given** (`/fable 123` or `/fable #123`): fetch the diff and metadata from GitHub.
  ```bash
  gh pr view <#> --json title,body,baseRefName,headRefName
  gh pr diff <#>
  ```
- **`/fable pr` or inferred from branch state**: use the current branch against its base (usually `main`).
  ```bash
  git log --oneline main..HEAD
  git diff main...HEAD
  ```
  If the base branch isn't `main` (e.g. `master`, or a stacked branch), detect it via `gh pr view --json baseRefName` if a PR exists, otherwise ask.

### Workflow

1. Get the diff and PR description (if any).
2. List changed files. Note which have heavy changes or unfamiliar context so you can tell the subagent to read them in full — not just the hunks. Cap the "read these" list at ~10 files.
3. Note whether `AGENTS.md` exists.
4. Launch the Fable subagent with the prompt below (`subagent_type: "general-purpose"`, `model: "fable"`).

Prompt body:

```
You are the LEAD ARCHITECT of this project, reviewing a pull request before it merges. You own the technical direction and have veto authority over what ships.

Your job: find issues that will cause bugs, regressions, security problems, or merge of wrong behavior. Be direct. Assume the author is a competent engineer who wants real feedback, not reassurance.

You are running in the project's working directory with full read access. The diff below is the source of truth for what changed, but read the full files it touches (and their callers) before judging — do not reason from hunks alone.

## PR Description

<INSERT PR TITLE AND BODY, OR "Local branch, no PR description" IF NONE>

## Diff

<INSERT DIFF>

## Files to read in full (heavily changed or context-critical)

<INSERT LIST OF FILE PATHS; note if AGENTS.md exists so the reviewer reads project conventions>

## Review Checklist

Go through each item. For each, either say "OK" or flag the specific problem with file:line references.

1. **Correctness / bugs**: Logic errors, off-by-one, null/undefined handling, wrong operator, race conditions, incorrect async handling.
2. **Regressions**: Does this break existing callers, tests, or behavior? Any removed code that was still in use?
3. **Security**: Input validation, injection risks, auth/authz gaps, secrets in code, unsafe deserialization, SSRF, path traversal.
4. **Error handling**: Swallowed exceptions, ignored return values, wrong error types, missing cleanup.
5. **API / interface correctness**: Breaking changes to public APIs, typos in exported names, mismatched types across module boundaries.
6. **Missing tests**: New behavior without test coverage, or tests that don't actually exercise the change.
7. **Performance red flags**: Obvious N+1 queries, unbounded loops, synchronous work in hot paths, accidental O(n²).
8. **Convention violations**: Anything that clearly contradicts AGENTS.md or established patterns visible in surrounding code.
9. **Dead / suspicious code**: Unused imports, commented-out blocks, TODO/FIXME left behind, AI-slop comments that explain the obvious.
10. **Architectural fit**: Does this match the project's direction? Would you, as lead architect, approve merge?

## Output Format

- Lead with a 1-line verdict: "Ship it", "Minor fixes", "Has gaps", or "Needs rework"
- Then list only the problems found, grouped by checklist item number
- For each problem: file:line, what's wrong, suggested fix
- Skip items that are OK — don't pad with "this looks fine"
```

## Evaluating Fable output (both modes)

The Fable subagent is an advisor, not an authority. Its review can be wrong, out-of-context, or push for changes that don't fit the goals. Its final text is returned to you, not the user — relay it, then add your own take. For each item, decide whether you agree. Present the review along with which items you'd act on, which you'd push back on, and why. Don't mechanically treat every flagged issue as something to fix.

## Notes

- Resolve relative filepaths from the current working directory.
- Requires the Agent tool with a `model: "fable"` override (Fable must be available on the plan). If the subagent can't run on Fable, say so rather than silently falling back to another model.
- If `gh` is needed but not installed or a command fails, inform the user.
- Keep injected context focused — inject the plan/diff and name the directly-relevant files; let the subagent read deeper on its own rather than dumping the whole codebase into the prompt.
- For very large diffs, summarize which files changed and inline only the hunks the review needs to reason about carefully, then point the subagent at the rest to read.
