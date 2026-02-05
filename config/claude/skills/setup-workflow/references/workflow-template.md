## Workflow

### Starting a Session

1. Read project documentation for context (e.g., PRD, architecture docs, README).
2. Check the task tracker (e.g., `docs/TASKS.md`, GitHub Issues) for current progress. Identify the next incomplete task.
3. Start from a clean state on the default branch:
   ```bash
   git checkout main && git pull origin main
   ```

### During Development

- Update the task tracker when tasks are completed or discovered.
- **Before implementing a task:** Spawn a subagent to write a thorough implementation plan. The plan should analyze the relevant code, identify all files that need changes, outline the approach, and flag any risks or open questions. Present the plan for approval before writing any code.
- **After the plan is approved:** Spawn a subagent to implement the approved plan. The implementation subagent receives the full plan as context and executes it.
- When stuck or going in circles, stop. Re-plan before continuing.
- **On any error:** Spawn the `debugger` subagent with the error context. Use its analysis to fix the issue before continuing.

### After Completing a Task — Autonomous Pipeline

Run this pipeline after every completed task. No user input required unless a step fails and cannot be auto-resolved.

**Step 1: Verify locally.**
Run the project's linting, formatting, type checking, and test commands. Check the Commands section of this file or `pyproject.toml`/`package.json`/`Makefile` for the exact commands. Fix any failures before proceeding.

**Step 2: Consolidate documentation.**
Run the `/docs-consolidator` skill to audit and sync project docs. Skip if the skill is unavailable.

**Step 3: Audit CI/CD pipeline.**
Run the `/ci-cd-pipeline` skill to ensure the GitHub Actions pipeline matches the project's current state. Skip if the skill is unavailable.

**Step 4: Commit all changes.**
Stage and commit everything from the task and from Steps 2-3. Write a concise, descriptive commit message. Use conventional commit prefixes when appropriate (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`).

**Step 5: Push to a new branch and open a PR.**
- Create a branch with a descriptive name: `<type>/<short-slug>` (e.g., `feat/core-types`, `fix/timestamp-bug`, `chore/update-deps`).
- Push and open a PR:
  ```bash
  git checkout -b <branch-name>
  git push -u origin <branch-name>
  gh pr create --fill
  ```

**Step 6: Code review.**
Spawn the `code-reviewer` subagent to review the PR. If the reviewer identifies issues, fix them on the same branch, commit, and push before proceeding.

**Step 7: Wait for CI checks to pass.**
```bash
gh pr checks --watch --fail-fast
```
- **If checks pass:** Proceed to Step 8.
- **If checks fail:**
  1. Identify the failure: `gh pr checks` then `gh run view <run-id> --log-failed`.
  2. Spawn the `debugger` subagent with the failure context to diagnose and fix the issue.
  3. Apply the fix on the same branch, commit, and push.
  4. Repeat from the start of Step 7. Max 3 retries.
  5. If still failing after 3 retries, stop and ask the user for help.

**Step 8: Merge the PR and clean up.**
```bash
gh pr merge --squash --delete-branch
git checkout main && git pull origin main
```
- **If merge conflict:**
  1. Rebase onto the default branch: `git fetch origin main && git rebase origin/main`.
  2. Force-push safely: `git push --force-with-lease`.
  3. Wait for CI again (return to Step 7). Max 1 retry.
  4. If the conflict persists, stop and ask the user for help.

**Step 9: Clean up the session.**
Run `/clean` to clear the conversation context. This ensures a fresh start for the next task.

### After Making a Mistake

- Add a specific rule to "Mistakes to Avoid" at the bottom of this file.
