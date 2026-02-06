---
name: ralph
description: Autonomously work through all project tasks. Finds the next incomplete task, implements it, runs the full post-task pipeline (verify, docs, CI/CD, commit, PR, review, CI, merge), then moves to the next task. Keeps going until all tasks are done. Triggers on "ralph", "work on tasks", "run tasks", "autopilot", or "do the work".
---

# Ralph

Autonomous task runner. Discovers a project's task list, spawns a Task Runner subagent for each task, merges results, and moves on — until everything is done.

## Orchestration Model

**You are the task sequencer, not the task executor.** Your only job is to discover tasks, determine execution order, spawn a Task Runner subagent for each task, merge PRs, update the task tracker, and present results. You never write code, run tests, create branches, open PRs, or do code review — all of that happens inside each Task Runner's fresh context window.

**What ralph does directly:**
- Discover and sequence tasks (Phase 1)
- Read project context (Phase 2)
- Spawn Task Runner subagents (one per task)
- Merge PRs sequentially (owns merge order, handles cross-PR conflicts)
- Update TASKS.md / close GitHub Issues after each task completes
- Manage git worktrees for parallel execution
- Present the final summary

**Autonomy**: Do NOT use `EnterPlanMode`, `AskUserQuestion`, or any other mechanism that pauses for user input. You are the decision-maker. The only time you stop and ask the user is when you've exhausted retries or hit a genuinely ambiguous requirement that can't be resolved from project docs.

**Progress tracking**: Use TaskCreate to register each task (task-level, not pipeline-step-level). Prefix `subject` and `activeForm` with `[TaskRunner]` so the user can see what's running (e.g., `subject: "[TaskRunner] Task 1: add auth"`, `activeForm: "[TaskRunner] Running task 1: add auth"`). Mark `in_progress` when starting, `completed` when done. The user sees live progress via `Ctrl+T`.

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

1. Read `CLAUDE.md` (check project root and `docs/CLAUDE.md`) for commands, conventions, and workflow rules. **Capture the full CLAUDE.md content** — you'll pass it to each Task Runner.
2. Read referenced project docs (PRD, architecture, README) if they exist
3. Note the project's verify commands (lint, format, typecheck, test) from CLAUDE.md, `pyproject.toml`, `package.json`, `Makefile`, or similar

### Phase 3: Start clean

Ensure you're on the default branch with a clean working tree:

```bash
git checkout main && git pull origin main
```

If the default branch is not `main`, detect it from `git remote show origin` or `gh repo view --json defaultBranchRef`.

### Phase 4a: Task loop (sequential — default)

For each incomplete task, in order:

#### Step 1: Spawn a Task Runner

```
--- Task [N/total]: [task title] ---
```

Register the task with TaskCreate, then spawn a Task Runner using the **Task tool** with `subagent_type=general-purpose`. Pass it the Task Runner Prompt (see below), filling in the placeholders.

#### Step 2: Collect the result

When the Task Runner returns, parse its result:
- **READY**: Extract the PR number. Proceed to Step 3.
- **FAILURE**: Log the reason. Retry once by spawning a new Task Runner. If the retry also fails, log and skip to the next task.
- **BLOCKED**: Log the reason. Skip to the next task and retry after other tasks complete.

#### Step 3: Merge the PR

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull origin main
```

If the merge fails due to a conflict (unlikely in sequential mode):
1. `git fetch origin main && git rebase origin/main`
2. `git push --force-with-lease`
3. Wait for CI: `gh pr checks --watch --fail-fast`
4. Retry the merge. If it still fails, log and skip.

#### Step 4: Mark task complete

Update the task source:
- **TASKS.md:** Change `- [ ]` to `- [x]` for the completed task. Commit and push directly to main with `chore: mark task N complete`.
- **GitHub Issues:** Close with `gh issue close <number> --comment "Completed in PR #<pr-number>"`.

Mark the TaskCreate entry as completed. Move to the next task.

### Phase 4b: Parallel execution with worktrees (enhancement)

Before starting the task loop, analyze the task list for independence. Only use this mode when tasks are clearly independent.

**Dependency heuristic:**
- Tasks are INDEPENDENT if they don't mention the same files, modules, or features
- Tasks are DEPENDENT if one references another's output, or they modify the same subsystem
- When uncertain, run sequentially

**Parallel flow:**

1. Group independent tasks into batches
2. For each batch, create worktrees:
   ```bash
   git worktree add .worktrees/<task-slug> -b <type>/<task-slug> main
   ```
   Add `.worktrees/` to `.gitignore` if not already present.

3. Spawn Task Runners **in parallel** (multiple Task tool calls in a single message). Each gets its worktree path as the working directory in its prompt.

4. Wait for all Task Runners to complete. Collect READY/FAILURE/BLOCKED results.

5. **Merge PRs sequentially** (prevention + redo strategy):
   - Merge first PR: `gh pr merge --squash --delete-branch` → pull main
   - For each subsequent PR:
     - **Try merge**: if it merges cleanly, done
     - **Try rebase**: `git rebase origin/main` — if git auto-resolves, force-push (`--force-with-lease`), wait for CI, merge
     - **Redo**: if rebase fails (real conflict), `git rebase --abort`, close the PR, spawn a fresh Task Runner on updated main. The new runner re-implements the task from scratch, producing a conflict-free PR. Max 1 redo per task.

6. Batch-update TASKS.md for all merged tasks in a single commit.

7. Clean up:
   ```bash
   git worktree remove .worktrees/<task-slug>
   git worktree prune
   ```

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

---

## Task Runner Prompt

When spawning a Task Runner, use the Task tool with `subagent_type=general-purpose` and pass the following prompt. Replace bracketed placeholders with actual values.

```
You are a Task Runner. Execute the full development pipeline for a single task.

## Your Task
[task description from the task list]

## Project Context
[CLAUDE.md content, verbatim]

## Working Directory
[project root path, or worktree path if parallel]

## Subagent Roster

You may spawn sub-subagents for complex work:

| Subagent | How to spawn | Purpose | Writes code? |
|----------|-------------|---------|-------------|
| Planner | Task tool (subagent_type=Explore) | Analyze code, produce implementation plan | No |
| Implementer | Task tool (subagent_type=general-purpose) | Execute approved plan, write code + tests | Yes |
| Code reviewer | code-reviewer agent | Review PR for bugs, security, style | No |
| Debugger | debugger agent | Diagnose and fix errors, CI failures | Yes |

For simple tasks (1-3 files, straightforward change), you MAY skip sub-subagents and implement directly. For complex tasks (multi-file, architectural, new feature), use Planner then Implementer.

## Pipeline

Execute these steps in order. Do not skip steps. Do not ask the user for input — you are autonomous.

### Step 1: Create a feature branch
```bash
git checkout -b <type>/<short-slug>
```
Use a descriptive branch name: `feat/core-types`, `fix/timestamp-bug`, etc.

### Step 2: Plan the task
Spawn a Planner subagent (Task tool, subagent_type=Explore) with the task description, project file structure, and relevant docs. It reads code and returns an implementation plan.

Review the plan yourself. Check for completeness, gaps, and alignment with the task. If lacking, re-plan with more specific instructions.

### Step 3: Implement the plan
Spawn an Implementer subagent (Task tool, subagent_type=general-purpose) with the approved plan and CLAUDE.md conventions. It writes all code and tests.

After the subagent completes, verify:
1. `git diff --stat` to review what changed
2. Run the full test suite
3. Run the linter and type checker

If verification fails:
- Test failures: spawn the debugger agent
- Lint/type errors: spawn a Task subagent with the errors
Do not proceed until all checks pass.

### Step 4: Verify locally
Run the project's lint, format, typecheck, and test commands. Fix any failures.

### Step 5: Audit docs, CI/CD, and deploy script
Spawn these as parallel Task subagents (subagent_type=general-purpose). Each gets the relevant skill instructions and directive: "Execute autonomously. Do not ask the user for approval."

- Docs audit: pass docs-consolidator skill instructions
- CI/CD audit: pass ci-cd-pipeline skill instructions
- Smoke test update: pass smoke-test skill instructions

Skip any if the skill is unavailable. Wait for all to complete.

### Step 6: Commit all changes
Stage and commit everything. Use conventional commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`).

### Step 7: Push and open a PR
```bash
git push -u origin <branch-name>
gh pr create --fill
```

### Step 8: Code review and CI (parallel)
- Spawn the code-reviewer agent to review the PR
- Run `gh pr checks --watch --fail-fast` to monitor CI

Handling results:
- Review Critical/Warnings: 3+ line fixes → spawn Task subagent. 1-2 lines → fix directly. Commit and push.
- CI failure: identify via `gh run view <run-id> --log-failed`, spawn debugger agent, fix, commit, push. Max 3 CI retries.
- Proceed when: review is clean (APPROVE or Nits only) AND CI passes.

## Result

When complete, report your result in this exact format (one line, no markdown):

READY: PR #<number>, review passed, CI passed. Branch: <branch-name>. Files changed: <count>.

If you could not complete the task:

FAILURE: <reason>. Last successful step: <step number>.

If the task is blocked by something outside your control:

BLOCKED: <reason>.
```

---

## Guidelines

- Start working immediately after discovering tasks. Don't ask the user to confirm the task list.
- One task = one Task Runner = one branch = one PR.
- Default to sequential execution. Only use parallel worktrees when tasks are clearly independent.
- Maximum 1 retry per failed task (spawn a new Task Runner). If the retry also fails, log and move on.
- If a task is too vague to implement, ask the user for clarification rather than guessing.
- When updating TASKS.md on main, use a minimal commit — don't open a PR for tracker updates.
- Skip audit subagents (docs-consolidator, ci-cd-pipeline, smoke-test) if those skills aren't installed. Don't fail the pipeline over optional steps.
- Respect the project's CLAUDE.md conventions and commands. Read it before doing anything.
- **Context conservation**: Ralph consumes minimal context per task because each Task Runner gets a fresh context window. Keep your own messages short — task description, result parsing, merge commands, tracker updates.
