---
name: ralph
description: Autonomously work through all project tasks. Finds the next incomplete task, implements it, runs the full post-task pipeline (verify, docs, CI/CD, commit, PR, review, CI, merge), then moves to the next task. Keeps going until all tasks are done. Triggers on "ralph", "work on tasks", "run tasks", "autopilot", or "do the work".
---

# Ralph

Autonomous task runner. Discovers a project's task list, works through each task, and runs the full development pipeline after each one — verify, document, commit, PR, review, CI, merge — until everything is done.

## Workflow

### Phase 1: Discover tasks

Find the project's task source by checking these locations in order:

1. `docs/TASKS.md` or `TASKS.md` in the project root — look for markdown checkboxes (`- [ ]`)
2. GitHub Issues — run `gh issue list --state open --limit 50` and use the results
3. If neither source has tasks, ask the user where to find them

Parse all incomplete tasks and present them to the user:

```
Found N incomplete tasks in [source]:
1. [task title / description]
2. ...
```

Ask the user to confirm the task list before starting. The user may reorder, skip, or add tasks.

### Phase 2: Read project context

Build working context before starting any development:

1. Read `CLAUDE.md` (check project root and `docs/CLAUDE.md`) for commands, conventions, and workflow rules
2. Read referenced project docs (PRD, architecture, README) if they exist
3. Note the project's verify commands (lint, format, typecheck, test) from CLAUDE.md, `pyproject.toml`, `package.json`, `Makefile`, or similar

### Phase 3: Start clean

Ensure you're on the default branch with a clean working tree:

```bash
git checkout main && git pull origin main
```

If the default branch is not `main`, detect it from `git remote show origin` or `gh repo view --json defaultBranchRef`.

### Phase 4: Task loop

For each incomplete task, in order:

#### Step 1: Announce the task

```
--- Task [N/total]: [task title] ---
```

#### Step 2: Implement the task

Do the actual development work to complete the task.

- Read relevant code before making changes.
- On any error, spawn the `debugger` subagent with the error context. Use its analysis to fix the issue.
- When stuck or going in circles, stop and re-plan before continuing.
- Keep changes focused on the task. Don't refactor unrelated code.

#### Step 3: Verify locally

Run the project's linting, formatting, type checking, and test commands. Check the Commands section of CLAUDE.md or the project's config files for the exact commands. Fix any failures before proceeding.

#### Step 4: Consolidate documentation

Run the `/docs-consolidator` skill to audit and sync project docs. Skip if the skill is unavailable.

#### Step 5: Audit CI/CD pipeline

Run the `/ci-cd-pipeline` skill to ensure the GitHub Actions pipeline matches the project's current state. Skip if the skill is unavailable.

#### Step 6: Commit all changes

Stage and commit everything from the task and from Steps 4-5. Write a concise, descriptive commit message. Use conventional commit prefixes when appropriate (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`).

#### Step 7: Push to a new branch and open a PR

```bash
git checkout -b <type>/<short-slug>
git push -u origin <type>/<short-slug>
gh pr create --fill
```

Use a descriptive branch name: `feat/core-types`, `fix/timestamp-bug`, `chore/update-deps`, etc.

#### Step 8: Code review

Spawn the `code-reviewer` subagent to review the PR. If the reviewer identifies issues, fix them on the same branch, commit, and push before proceeding.

#### Step 9: Wait for CI checks to pass

```bash
gh pr checks --watch --fail-fast
```

- **If checks pass:** proceed to Step 10.
- **If checks fail:**
  1. Identify the failure: `gh pr checks` then `gh run view <run-id> --log-failed`.
  2. Spawn the `debugger` subagent with the failure context.
  3. Apply the fix on the same branch, commit, and push.
  4. Repeat from the start of Step 9. Max 3 retries.
  5. If still failing after 3 retries, stop and ask the user for help.

#### Step 10: Merge the PR and clean up

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull origin main
```

- **If merge conflict:**
  1. Rebase onto the default branch: `git fetch origin main && git rebase origin/main`.
  2. Force-push safely: `git push --force-with-lease`.
  3. Wait for CI again (return to Step 9). Max 1 retry.
  4. If the conflict persists, stop and ask the user for help.

#### Step 11: Mark task complete

Update the task source:
- **TASKS.md:** Change `- [ ]` to `- [x]` for the completed task. Commit and push this change directly to main.
- **GitHub Issues:** Close the issue with `gh issue close <number> --comment "Completed in PR #<pr-number>"`.

#### Step 12: Next task

Return to Step 1 for the next incomplete task.

### Phase 5: Wrap up

After all tasks are complete, present a summary:

```
All N tasks completed.

| # | Task | PR | Status |
|---|------|----|--------|
| 1 | [title] | #[number] | Merged |
| 2 | [title] | #[number] | Merged |
...
```

If any tasks were skipped or need user attention, list them separately.

## Guidelines

- Always confirm the task list with the user before starting work.
- One task = one branch = one PR. Don't batch unrelated tasks.
- If a task is too vague to implement, ask the user for clarification rather than guessing.
- If the post-task pipeline requires user input (e.g., CI failure after 3 retries), pause the loop and wait for the user before continuing to the next task.
- When updating TASKS.md on main, use a minimal commit (e.g., `chore: mark task N complete`) — don't open a PR for tracker updates.
- Skip Steps 4-5 (docs-consolidator, ci-cd-pipeline) if those skills aren't installed. Don't fail the pipeline over optional steps.
- Respect the project's CLAUDE.md conventions and commands. Read it before doing anything.
