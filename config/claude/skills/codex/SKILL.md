---
name: codex
description: Review a plan file using OpenAI Codex CLI. Use when the user says "/codex" (with or without a path) or asks to review a plan with Codex. If no path is given, infer the plan from conversation context or common locations (plan.md, PLAN.md, plans/*.md, docs/plan*.md).
---

# Codex Plan Review

Review a plan document using OpenAI's Codex CLI to catch glaring holes before implementation.

## Usage

```
/codex              # infer the plan file (see resolution rules)
/codex <filepath>   # explicit path
```

## Resolving the plan file

If no filepath is given, find it in this order — stop at the first match:

1. **Conversation context**: a plan file the user and Claude were just working on in this session (drafted, edited, or discussed by path). Use it.
2. **Repo conventions**: glob for `plan.md`, `PLAN.md`, `plans/*.md`, `docs/plan*.md`, `.plans/*.md` in the cwd. If exactly one match, use it. If multiple, list them and ask the user to pick.
3. **Most recently modified markdown in `plans/` or `docs/plans/`**: if such a directory exists and contains `.md` files, offer the newest as the likely target.
4. **None found**: ask the user for the path. Do not guess.

Never invent a plan file that doesn't exist. Never run the review against a file you had to create.

## Workflow

1. Resolve the plan file (see above), then read it.
2. Scan the plan for any file paths, function names, or module references it mentions. Read those files to gather context (up to 5-10 key files). Also read CLAUDE.md if it exists, for project conventions.
3. Build the prompt below, injecting the plan contents and the gathered context.
4. Run Codex in non-interactive mode:

```bash
cat <<'PROMPT' | codex exec -
You are reviewing an implementation plan before work begins. Your job is to find glaring holes — things that will cause the implementation to fail, waste time, or need a do-over.

## The Plan

<INSERT PLAN CONTENTS>

## Codebase Context

<INSERT RELEVANT FILE CONTENTS AND CLAUDE.MD CONVENTIONS>

## Review Checklist

Go through each item. For each, either say "OK" or flag the specific problem.

1. **Missing steps**: Are there steps the plan assumes but doesn't list? (e.g., migrations, config changes, dependency installs, build steps)
2. **Wrong assumptions**: Does the plan reference files, functions, types, or APIs that don't exist or work differently than assumed?
3. **Ordering issues**: Are steps in the wrong order? Would any step fail because a prerequisite hasn't happened yet?
4. **Forgotten side effects**: Does the plan account for everything that needs to change? (e.g., updating tests, types, event handlers, database schemas, environment variables)
5. **Integration gaps**: Will the pieces actually connect? Are there interface mismatches, missing imports, or type incompatibilities?
6. **Edge cases and error handling**: Does the plan ignore obvious failure modes? (e.g., what if the API call fails, the user isn't authenticated, the list is empty)
7. **Scope creep or under-scoping**: Is the plan trying to do too much in one pass, or is it missing work that will block completion?
8. **Testing gap**: Does the plan include enough verification to know it worked?

## Output Format

- Lead with a 1-line verdict: "Looks solid", "Has gaps", or "Needs rework"
- Then list only the problems found, grouped by checklist item number
- For each problem: state what's wrong and suggest a fix
- Skip items that are OK — don't pad with "this looks fine"
PROMPT
```

5. Critically evaluate the Codex output before presenting it. Codex is an advisor, not an authority — its review can be wrong, out-of-context, or push for changes that don't fit the plan's goals. For each item, decide whether you agree. Present the review to the user along with your own take: which items you'd act on, which you'd push back on, and why. Don't mechanically treat every flagged issue as something to fix.

## Notes

- Resolve relative filepaths from the current working directory.
- If Codex is not installed or the command fails, inform the user.
- Keep gathered context focused — include only files the plan directly references or depends on, not the entire codebase.
