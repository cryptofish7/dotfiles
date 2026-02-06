---
name: ralph
description: Autonomously work through all project tasks. Finds the next incomplete task, implements it, runs the full post-task pipeline (verify, docs, CI/CD, commit, PR, review, CI, merge), then moves to the next task. Keeps going until all tasks are done. Triggers on "ralph", "work on tasks", "run tasks", "autopilot", or "do the work".
---

# Ralph

Autonomous task runner. Discovers a project's task list, works through each task, and runs the full development pipeline after each one — verify, document, commit, PR, review, CI, merge — until everything is done.

## Orchestration Model

**You are a task coordinator, not an implementer.** Your context window must last across ALL tasks in the session. Every line of code you write directly reduces your capacity for later tasks. Delegate all code generation to subagents via the Task tool. Your job is to:

- Discover and sequence tasks
- Spawn planning subagents and approve their plans
- Spawn implementation subagents and verify their output
- Run the post-task pipeline (verify, commit, PR, review, CI, merge)
- Track progress using the TaskCreate/TaskUpdate tools for real-time visibility
- Make go/no-go decisions at each gate

**Subagent roster:**

| Subagent | How to spawn | Purpose | Writes code? |
|----------|-------------|---------|-------------|
| Planner | Task tool (`subagent_type=Explore`) | Analyze code, produce implementation plan | No |
| Implementer | Task tool (`subagent_type=general-purpose`) | Execute approved plan, write code + tests | Yes |
| Code reviewer | `code-reviewer` agent | Review PR for bugs, security, style | No |
| Debugger | `debugger` agent | Diagnose and fix errors, CI failures | Yes |

**When the orchestrator acts directly** (exceptions):
- Git operations (commit, branch, push, merge)
- Running commands (tests, linters, CI checks)
- Trivial fixes (1-2 lines: typo, import, format issue)
- Task tracker updates
- Spawning audit subagents (docs, CI/CD, smoke test) — see Step 5

**Autonomy**: Do NOT use `EnterPlanMode`, `AskUserQuestion`, or any other mechanism that pauses for user input. You are the decision-maker. Planning is handled by spawning Explore subagents, not by entering plan mode. The only time you stop and ask the user is when you've exhausted retries (e.g., 3 CI failures) or hit a genuinely ambiguous requirement that can't be resolved from project docs.

**Context conservation**: If you find yourself writing more than ~10 lines of code, STOP and spawn a Task subagent instead. The subagent gets a fresh context window.

**Progress tracking**: Use TaskCreate to register each pipeline step. Prefix every `subject` and `activeForm` with the responsible agent in brackets so the user can see who's doing what (e.g., `subject: "[Planner] Plan: add auth"`, `activeForm: "[Planner] Planning auth"`). Mark `in_progress` when starting, `completed` when done. The user sees live progress via `Ctrl+T`.

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

Proceed with the task list in order. If the ordering seems wrong (e.g., a task depends on another that comes later), reorder as needed.

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

Use TaskCreate to register each pipeline step. Prefix `subject` and `activeForm` with the agent name in brackets so it's visible in the UI:

| Step | Subject | activeForm |
|------|---------|------------|
| Plan | "[Planner] Plan: [task title]" | "[Planner] Planning [task title]" |
| Implement | "[Implementer] Implement: [task title]" | "[Implementer] Implementing [task title]" |
| Verify | "[Orchestrator] Verify locally" | "[Orchestrator] Running verification" |
| Docs + CI/CD + Deploy | "[Orchestrator] Docs, CI/CD, and deploy audit" | "[Orchestrator] Auditing docs, CI/CD, and deploy" |
| Commit + PR | "[Orchestrator] Commit and open PR" | "[Orchestrator] Committing and opening PR" |
| Review + CI | "[Reviewer] Code review and CI" | "[Reviewer] Running review and CI" |
| Merge | "[Orchestrator] Merge PR" | "[Orchestrator] Merging PR" |

Mark each `in_progress` when starting, `completed` when done.

#### Step 2: Plan the task

Use the **Task tool** with `subagent_type=Explore` to spawn a planning subagent. Pass it:
- The task description (from the task tracker)
- The project's file structure (from CLAUDE.md)
- Any relevant architecture or reference docs
- Specific instruction: "Produce a step-by-step implementation plan. List every file to create or modify, the changes needed in each, and any risks or edge cases."

The Explore subagent reads code and produces a plan. It does NOT write any code.

**Review the plan yourself.** Check that it covers all files, has no obvious gaps, and aligns with the task requirements. If the plan is incomplete or unclear, spawn a new Explore subagent with more specific instructions. Do NOT ask the user to approve the plan — you are the orchestrator, you make this call.

#### Step 3: Implement the plan

**Do NOT write implementation code yourself.** Use the **Task tool** with `subagent_type=general-purpose` to spawn an implementation subagent. Pass it:
- The full approved plan from Step 2
- The project's CLAUDE.md content (for conventions and commands)
- Specific instruction: "Implement this plan. Write all code and tests. On any error, describe the error clearly so it can be diagnosed."

The implementation subagent writes all files and returns a summary of what was created/modified.

**After the subagent completes**, verify its work:
1. Review the changes: run `git diff --stat` to see what was modified
2. Run the full test suite
3. Run the linter and type checker

If verification fails:
- For test failures: spawn the `debugger` agent with the failure output
- For lint or type errors: spawn a Task subagent with the specific errors to fix
- Do NOT fix implementation code yourself (except trivial 1-2 line issues)

**Gate**: Do not proceed to Step 4 until all checks pass.

#### Step 4: Verify locally

Run the project's linting, formatting, type checking, and test commands. Check the Commands section of CLAUDE.md or the project's config files for the exact commands. Fix any failures before proceeding.

#### Step 5: Audit docs, CI/CD, and deploy script (parallel)

Spawn these as **parallel Task subagents** (`subagent_type=general-purpose`). Each subagent gets the relevant skill instructions and an explicit directive: "Execute autonomously. Do not ask the user for approval — review your own plan and proceed."

- **Docs audit**: Pass the docs-consolidator skill instructions. The subagent audits and consolidates project docs.
- **CI/CD audit**: Pass the ci-cd-pipeline skill instructions. The subagent ensures GitHub Actions matches the current project state.
- **Smoke test update**: Pass the smoke-test skill instructions. The subagent updates deploy.sh with smoke tests for new functionality.

Skip any if the skill is unavailable. Wait for all subagents to complete before proceeding.

#### Step 6: Commit all changes

Stage and commit everything from the task and from Step 5. Write a concise, descriptive commit message. Use conventional commit prefixes when appropriate (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`).

#### Step 7: Push to a new branch and open a PR

```bash
git checkout -b <type>/<short-slug>
git push -u origin <type>/<short-slug>
gh pr create --fill
```

Use a descriptive branch name: `feat/core-types`, `fix/timestamp-bug`, `chore/update-deps`, etc.

#### Step 8: Code review and CI (parallel)

Start both immediately after opening the PR:

- **8a**: Spawn the `code-reviewer` subagent to review the PR.
- **8b**: Run `gh pr checks --watch --fail-fast` to monitor CI.

Handling results:
- If review returns Critical or Warning findings:
  - **3+ line fixes**: Spawn a Task subagent to apply them. Do not fix directly.
  - **1-2 line fixes**: The orchestrator may apply these directly.
  - Commit and push fixes. CI restarts automatically on the new push.
- If CI fails:
  1. Identify the failure: `gh pr checks` then `gh run view <run-id> --log-failed`.
  2. Spawn the `debugger` subagent with the failure context.
  3. Apply the fix on the same branch, commit, and push.
  4. Max 3 CI retries. If still failing, stop and ask the user for help.
- **Proceed to Step 9 when**: review is clean (APPROVE or only Nits) AND CI passes.

#### Step 9: Merge the PR and clean up

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull origin main
```

- **If merge conflict:**
  1. Rebase onto the default branch: `git fetch origin main && git rebase origin/main`.
  2. Force-push safely: `git push --force-with-lease`.
  3. Wait for CI again (return to Step 8b). Max 1 retry.
  4. If the conflict persists, stop and ask the user for help.

#### Step 10: Mark task complete

Update the task source:
- **TASKS.md:** Change `- [ ]` to `- [x]` for the completed task. Commit and push this change directly to main.
- **GitHub Issues:** Close the issue with `gh issue close <number> --comment "Completed in PR #<pr-number>"`.

#### Step 11: Next task

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

- Start working immediately after discovering tasks. Don't ask the user to confirm the task list.
- One task = one branch = one PR. Don't batch unrelated tasks.
- If a task is too vague to implement, ask the user for clarification rather than guessing.
- If the post-task pipeline requires user input (e.g., CI failure after 3 retries), pause the loop and wait for the user before continuing to the next task.
- When updating TASKS.md on main, use a minimal commit (e.g., `chore: mark task N complete`) — don't open a PR for tracker updates.
- Skip Step 5 (docs-consolidator, ci-cd-pipeline) if those skills aren't installed. Don't fail the pipeline over optional steps.
- Respect the project's CLAUDE.md conventions and commands. Read it before doing anything.
- **Context conservation**: Your context window must last the entire task list. Never write large blocks of code directly. If you find yourself writing more than ~10 lines of code, STOP and spawn a Task subagent instead.
