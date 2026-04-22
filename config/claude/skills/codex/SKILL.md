---
name: codex
description: Review a plan file or a PR/branch diff using OpenAI Codex CLI. Use when the user says "/codex" (with or without an argument) or asks to review something with Codex. Auto-detects plan-review vs PR-review mode from the argument and conversation context.
---

# Codex Review

Use OpenAI's Codex CLI as a second set of eyes — either on an implementation plan (before work begins) or on a PR / branch diff (after work is done).

## Usage

```
/codex                    # infer target from context (plan file OR current branch diff)
/codex <filepath.md>      # explicit plan review
/codex <PR#>              # PR review by number (e.g. /codex 123 or /codex #123)
/codex pr                 # review the current branch's diff against main
```

## Picking the mode

Decide **plan mode** vs **PR mode** from the argument and context:

- Argument is a path to an existing `.md` file → **plan mode**
- Argument is a number, `#<num>`, `pr`, or `pr <num>` → **PR mode**
- No argument:
  1. If the user and Claude were just working on a specific plan file in this session → **plan mode** with that file.
  2. Else if the current branch has commits ahead of `main` (`git rev-list --count main..HEAD` > 0) → **PR mode** on the branch diff.
  3. Else fall through to plan-file resolution (see below). If still nothing, ask.

Never invent a target. Never run the review against a file or branch you just created for this purpose.

## Plan mode

### Resolving the plan file

If no filepath is given and no plan is in conversation context, find one in this order — stop at the first match:

1. **Repo conventions**: glob for `plan.md`, `PLAN.md`, `plans/*.md`, `docs/plan*.md`, `.plans/*.md` in the cwd. If exactly one match, use it. If multiple, list them and ask the user to pick.
2. **Most recently modified markdown in `plans/` or `docs/plans/`**: if such a directory exists and contains `.md` files, offer the newest as the likely target.
3. **None found**: ask the user for the path. Do not guess.

### Workflow

1. Read the plan file.
2. Scan it for file paths, function names, or module references. Read those files (up to 5-10 key ones). Also read `CLAUDE.md` if it exists.
3. Run Codex with the prompt below.

```bash
cat <<'PROMPT' | codex exec -
You are reviewing an implementation plan before work begins. Your job is to find glaring holes — things that will cause the implementation to fail, waste time, or need a do-over.

## The Plan

<INSERT PLAN CONTENTS>

## Codebase Context

<INSERT RELEVANT FILE CONTENTS AND CLAUDE.MD CONVENTIONS>

## Review Checklist

Go through each item. For each, either say "OK" or flag the specific problem.

1. **Missing steps**: Are there steps the plan assumes but doesn't list? (migrations, config changes, dependency installs, build steps)
2. **Wrong assumptions**: Does the plan reference files, functions, types, or APIs that don't exist or work differently than assumed?
3. **Ordering issues**: Are steps in the wrong order? Would any step fail because a prerequisite hasn't happened yet?
4. **Forgotten side effects**: Does the plan account for everything that needs to change? (tests, types, event handlers, DB schemas, env vars)
5. **Integration gaps**: Will the pieces actually connect? Interface mismatches, missing imports, type incompatibilities?
6. **Edge cases and error handling**: Does the plan ignore obvious failure modes?
7. **Scope creep or under-scoping**: Too much in one pass, or missing work that will block completion?
8. **Testing gap**: Enough verification to know it worked?

## Output Format

- Lead with a 1-line verdict: "Looks solid", "Has gaps", or "Needs rework"
- Then list only the problems found, grouped by checklist item number
- For each problem: state what's wrong and suggest a fix
- Skip items that are OK — don't pad with "this looks fine"
PROMPT
```

## PR mode

### Resolving the diff

- **PR number given** (`/codex 123` or `/codex #123`): fetch the diff and metadata from GitHub.
  ```bash
  gh pr view <#> --json title,body,baseRefName,headRefName
  gh pr diff <#>
  ```
- **`/codex pr` or inferred from branch state**: use the current branch against its base (usually `main`).
  ```bash
  git log --oneline main..HEAD
  git diff main...HEAD
  ```
  If the base branch isn't `main` (e.g. `master`, or a stacked branch), detect it via `gh pr view --json baseRefName` if a PR exists, otherwise ask.

### Workflow

1. Get the diff and PR description (if any).
2. List changed files. For files with heavy changes or unfamiliar context, read the full file — not just the hunks — so Codex can reason about surrounding code. Cap at ~10 files.
3. Read `CLAUDE.md` for project conventions.
4. Run Codex with the prompt below.

```bash
cat <<'PROMPT' | codex exec -
You are reviewing a pull request. Your job is to find real problems — bugs, regressions, security issues, missing tests — not style nits.

## PR Description

<INSERT PR TITLE AND BODY, OR "Local branch, no PR description" IF NONE>

## Diff

<INSERT DIFF>

## Relevant File Contents

<INSERT FULL CONTENTS OF HEAVILY-CHANGED OR CONTEXT-CRITICAL FILES>

## Project Conventions

<INSERT CLAUDE.MD CONTENTS IF PRESENT>

## Review Checklist

Go through each item. For each, either say "OK" or flag the specific problem with file:line references.

1. **Correctness / bugs**: Logic errors, off-by-one, null/undefined handling, wrong operator, race conditions, incorrect async handling.
2. **Regressions**: Does this break existing callers, tests, or behavior? Any removed code that was still in use?
3. **Security**: Input validation, injection risks, auth/authz gaps, secrets in code, unsafe deserialization, SSRF, path traversal.
4. **Error handling**: Swallowed exceptions, ignored return values, wrong error types, missing cleanup.
5. **API / interface correctness**: Breaking changes to public APIs, typos in exported names, mismatched types across module boundaries.
6. **Missing tests**: New behavior without test coverage, or tests that don't actually exercise the change.
7. **Performance red flags**: Obvious N+1 queries, unbounded loops, synchronous work in hot paths, accidental O(n²).
8. **Convention violations**: Anything that clearly contradicts CLAUDE.md or established patterns visible in surrounding code.
9. **Dead / suspicious code**: Unused imports, commented-out blocks, TODO/FIXME left behind, AI-slop comments that explain the obvious.

## Output Format

- Lead with a 1-line verdict: "Ship it", "Minor fixes", "Has gaps", or "Needs rework"
- Then list only the problems found, grouped by checklist item number
- For each problem: file:line, what's wrong, suggested fix
- Skip items that are OK — don't pad with "this looks fine"
PROMPT
```

## Evaluating Codex output (both modes)

Codex is an advisor, not an authority. Its review can be wrong, out-of-context, or push for changes that don't fit the goals. For each item, decide whether you agree. Present the review along with your own take: which items you'd act on, which you'd push back on, and why. Don't mechanically treat every flagged issue as something to fix.

## Notes

- Resolve relative filepaths from the current working directory.
- If `codex` or `gh` is not installed or a command fails, inform the user.
- Keep gathered context focused — include only files the plan/diff directly references or depends on, not the entire codebase.
- For very large diffs, summarize which files changed and only inline the hunks for files the review needs to reason about carefully; Codex has a context limit too.
