---
name: ralph
description: Autonomously work through all project tasks. Finds the next incomplete task, implements it, runs the full post-task pipeline (verify, docs, CI/CD, commit, PR, review, CI, merge), then moves to the next task. Keeps going until all tasks are done. Triggers on "ralph", "work on tasks", "run tasks", "autopilot", or "do the work".
---

# Ralph

Autonomous task runner. Discovers a project's task list, delegates or executes each task, merges results, and moves on until everything is done.

## Orchestration Model

**You are the task sequencer first.** Your job is to discover tasks, determine execution order, delegate each task when the runtime supports delegation, merge PRs, update the task tracker, and present results. If delegation is unavailable, execute the task loop directly while preserving the same pipeline discipline.

**What ralph does directly:**
- Discover and sequence tasks (Phase 1)
- Read project context (Phase 2)
- Delegate one worker per task when supported
- Merge PRs sequentially (owns merge order, handles cross-PR conflicts)
- Update TASKS.md / close GitHub Issues after each task completes
- Manage git worktrees for parallel execution
- Present the final summary

**Autonomy**: Do not pause for user input unless you've exhausted retries or hit a genuinely ambiguous requirement that can't be resolved from project docs.

**Progress tracking**: If the runtime exposes milestone/stage task APIs, create milestones on-demand with pipeline stages immediately following each milestone. If not, use concise commentary updates and/or the runtime's plan tool to reflect the same stage progression.

## Pipeline Visualization

If the runtime exposes a flat task list ordered by creation ID, follow this creation-order protocol so stages appear directly under their parent milestone. Otherwise, treat this section as optional guidance.

### What the user sees

```
✓  [1/5] Add core types
⟳  [2/5] Implement engine
     ✓  → Plan
     ⟳  → Implement                    "[implementer] Writing code and tests"
        → Verify
        → Audit
        → Commit & PR
        → Review
        → CI
        → Merge
```

For parallel batches, milestones interleave in creation order — create milestone A + 8 stages, then milestone B + 8 stages.

### Creation-order protocol

1. **Do NOT create all milestones up front.** Create each milestone on-demand, right before it starts.
2. **Immediately after creating a milestone**, create its 8 `→ <stage>` tasks if the runtime supports them.
3. **For parallel batches**: create milestone A + 8 stages, then milestone B + 8 stages, before starting delegated work.
4. **Pass the 8 stage task IDs** to the worker prompt only when the runtime supports task updates.
5. **On completion**: clean up stage tasks if the runtime supports deletion, then mark the milestone `completed`.

### Pipeline stages

| # | Subject | Agent | activeForm when in_progress |
|---|---------|-------|-----------------------------|
| 1 | `→ Plan` | planner | `[planner] Analyzing code and producing plan` |
| 2 | `→ Implement` | implementer | `[implementer] Writing code and tests` |
| 3 | `→ Verify` | (self) | `Running lint, typecheck, tests` |
| 4 | `→ Audit` | (parallel) | `[docs] [ci-cd] [smoke-test] Auditing in parallel` |
| 5 | `→ Commit & PR` | (self) | `Committing and opening PR` |
| 6 | `→ Review` | code-reviewer | `[code-reviewer] Reviewing PR` |
| 7 | `→ CI` | (self) | `Waiting for CI checks` |
| 8 | `→ Merge` | orchestrator | `Merging PR and cleaning up` |

---

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

#### Step 1: Create milestone and stage tasks

```
--- Task [N/total]: [task title] ---
```

1. Create the milestone task with the runtime's progress API if available; otherwise record the milestone in the active plan/comments.
2. Immediately create 8 stage tasks with the runtime's progress API if available:
   - `→ Plan` (activeForm: `[planner] Analyzing code and producing plan`)
   - `→ Implement` (activeForm: `[implementer] Writing code and tests`)
   - `→ Verify` (activeForm: `Running lint, typecheck, tests`)
   - `→ Audit` (activeForm: `[docs] [ci-cd] [smoke-test] Auditing in parallel`)
   - `→ Commit & PR` (activeForm: `Committing and opening PR`)
   - `→ Review` (activeForm: `[code-reviewer] Reviewing PR`)
   - `→ CI` (activeForm: `Waiting for CI checks`)
   - `→ Merge` (activeForm: `Merging PR and cleaning up`)
3. Capture the 8 stage task IDs.
4. Mark the milestone task as `in_progress`.

#### Step 2: Delegate or execute the task

Delegate the task to a fresh Codex worker/session if available. Pass it the Task Runner Prompt (see below), filling in the placeholders — including `[STAGE_TASK_IDS]` when task-stage tracking is supported. If delegation is unavailable, execute the Task Runner Prompt yourself in the current session.

#### Step 3: Collect the result

When the worker returns, parse its result:
- **READY**: Extract the PR number. Proceed to Step 4.
- **FAILURE**: Log the reason. Retry once by delegating again (pass the same stage IDs when supported — reset any completed stages to `pending` first). If the retry also fails, log and skip to the next task.
- **BLOCKED**: Log the reason. Skip to the next task and retry after other tasks complete.

#### Step 4: Merge the PR

Mark stage 8 (Merge) as `in_progress` with activeForm `Merging PR and cleaning up`.

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull origin main
```

If the merge fails due to a conflict (unlikely in sequential mode):
1. Update Merge stage activeForm: `Resolving merge conflict (rebase)`
2. `git fetch origin main && git rebase origin/main`
3. `git push --force-with-lease`
4. Wait for CI: `gh pr checks --watch --fail-fast`
5. Retry the merge. If it still fails, log and skip.

Mark stage 8 (Merge) as `completed`.

#### Step 5: Clean up and mark task complete

1. Delete all 8 stage tasks (set status to `deleted`) — this removes the pipeline detail from `Ctrl+T`, leaving only the clean milestone entry.
2. Mark the milestone task as `completed`.
3. Update the task source:
   - **TASKS.md:** Change `- [ ]` to `- [x]` for the completed task. Commit and push directly to main with `chore: mark task N complete`.
   - **GitHub Issues:** Close with `gh issue close <number> --comment "Completed in PR #<pr-number>"`.
4. Move to the next task.

### Phase 4b: Parallel execution with worktrees (enhancement)

Before starting the task loop, analyze the task list for independence. Only use this mode when tasks are clearly independent.

**Dependency heuristic:**
- Tasks are INDEPENDENT if they don't mention the same files, modules, or features
- Tasks are DEPENDENT if one references another's output, or they modify the same subsystem
- When uncertain, run sequentially

**Parallel flow:**

1. Group independent tasks into batches.

2. **Create all milestones and stages for the batch in order** when the runtime supports task tracking. For each task in the batch, sequentially:
   - Create the milestone task: `[N/total] <task title>`
   - Immediately create its 8 `→ <stage>` tasks
   - Capture the milestone ID and 8 stage IDs
   - Mark the milestone as `in_progress`

   This ensures each milestone's stages appear directly beneath it in `Ctrl+T`.

3. For each task in the batch, create worktrees:
   ```bash
   git worktree add .worktrees/<task-slug> -b <type>/<task-slug> main
   ```
   Add `.worktrees/` to `.gitignore` if not already present.

4. Delegate task workers in parallel when the runtime supports it. Each gets its worktree path as the working directory and its own set of stage task IDs in the prompt.

5. Wait for all delegated workers to complete. Collect READY/FAILURE/BLOCKED results.

6. **Merge PRs sequentially** (prevention + redo strategy). For each READY task:
   - Mark its stage 8 (Merge) as `in_progress` with activeForm `Merging PR and cleaning up`
   - Merge: `gh pr merge --squash --delete-branch` → pull main
   - For subsequent PRs:
     - **Try merge**: if it merges cleanly, done
     - **Try rebase**: `git rebase origin/main` — if git auto-resolves, force-push (`--force-with-lease`), wait for CI, merge. Update Merge stage activeForm: `Resolving merge conflict (rebase)`
     - **Redo**: if rebase fails (real conflict), `git rebase --abort`, close the PR, delegate a fresh worker on updated main. The new worker re-implements the task from scratch. Max 1 redo per task.
   - Mark stage 8 (Merge) as `completed`
   - **Clean up**: delete all 8 stage tasks for this milestone, mark milestone `completed`

7. Batch-update TASKS.md for all merged tasks in a single commit.

8. Clean up worktrees:
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

When delegating a task worker, pass the following prompt. Replace bracketed placeholders with actual values.

```
You are a Task Runner. Execute the full development pipeline for a single task.

## Your Task
[task description from the task list]

## Project Context
[CLAUDE.md content, verbatim]

## Working Directory
[project root path, or worktree path if parallel]

## Subagent Roster

You may delegate additional workers for complex work if the runtime supports it:

| Subagent | How to spawn | Purpose | Writes code? |
|----------|-------------|---------|-------------|
| Planner | Delegate if supported | Analyze code, produce implementation plan | No |
| Implementer | Delegate if supported | Execute approved plan, write code + tests | Yes |
| Code reviewer | code-reviewer agent | Review PR for bugs, security, style | No |
| Debugger | debugger agent | Diagnose and fix errors, CI failures | Yes |

For simple tasks (1-3 files, straightforward change), you MAY skip sub-subagents and implement directly. For complex tasks (multi-file, architectural, new feature), use Planner then Implementer.

## Progress Tracking

The orchestrator may have pre-created 8 pipeline stage tasks for you. Update them when the runtime supports task APIs; otherwise provide concise progress updates.

**Stage task IDs (in order):** [STAGE_TASK_IDS]
Stages: Plan, Implement, Verify, Audit, Commit & PR, Review, CI, Merge.
Update each stage with the runtime's task/progress API when available. Use the activeForm values from the Pipeline stages table. On retry, include agent name and count (e.g., `[debugger] Fixing test failures (retry 1/3)`). Never create or delete tasks unless the orchestrator explicitly owns that lifecycle.

## Pipeline

Execute these steps in order. Do not skip steps. Do not ask the user for input — you are autonomous.

### Step 1: Create a feature branch
```bash
git checkout -b <type>/<short-slug>
```
Use a descriptive branch name: `feat/core-types`, `fix/timestamp-bug`, etc.

### Step 2: Plan the task
**→ Mark stage 1 (Plan) as `in_progress` with activeForm `[planner] Analyzing code and producing plan`**

Delegate planning if the runtime supports it. Otherwise analyze the task directly and produce an implementation plan.

Review the plan yourself. Check for completeness, gaps, and alignment with the task. If lacking, re-plan with more specific instructions.

**→ Mark stage 1 (Plan) as `completed`**

### Step 3: Implement the plan
**→ Mark stage 2 (Implement) as `in_progress` with activeForm `[implementer] Writing code and tests`**

Delegate implementation if the runtime supports it. Otherwise implement directly while following the approved plan and CLAUDE.md conventions.

After the subagent completes, verify:
1. `git diff --stat` to review what changed
2. Run the full test suite
3. Run the linter and type checker

If verification fails:
- Test failures: spawn the debugger agent. Update activeForm: `[debugger] Fixing test failures (retry 1/3)`
- Lint/type errors: delegate another implementation pass with the errors, or fix directly if delegation is unavailable. Update activeForm: `[implementer] Fixing lint errors (retry 1/3)`
Do not proceed until all checks pass.

**→ Mark stage 2 (Implement) as `completed`**

### Step 4: Verify locally
**→ Mark stage 3 (Verify) as `in_progress` with activeForm `Running lint, typecheck, tests`**

Run the project's lint, format, typecheck, and test commands. Fix any failures. On retry, update activeForm with the retry count and agent if applicable.

**→ Mark stage 3 (Verify) as `completed`**

### Step 5: Audit docs, CI/CD, and deploy script
**→ Mark stage 4 (Audit) as `in_progress` with activeForm `[docs] [ci-cd] [smoke-test] Auditing in parallel`**

Run these in parallel when the runtime supports delegation. Each worker gets the relevant skill instructions and directive: "Execute autonomously. Do not ask the user for approval."

- Docs audit: read `~/.codex/skills/docs-consolidator/SKILL.md` and pass its contents
- CI/CD audit: read `~/.codex/skills/ci-cd-pipeline/SKILL.md` and pass its contents
- Smoke test update: read `~/.codex/skills/smoke-test/SKILL.md` and pass its contents

Skip any if the skill is unavailable. Wait for all to complete.

**→ Mark stage 4 (Audit) as `completed`**

### Step 6: Commit all changes and open PR
**→ Mark stage 5 (Commit & PR) as `in_progress` with activeForm `Committing and opening PR`**

Stage and commit everything. Use conventional commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`).

```bash
git push -u origin <branch-name>
gh pr create --fill
```

**→ Mark stage 5 (Commit & PR) as `completed`**

### Step 7: Code review
**→ Mark stage 6 (Review) as `in_progress` with activeForm `[code-reviewer] Reviewing PR`**

Spawn the code-reviewer agent to review the PR.

Handling results:
- Review Critical/Warnings: 3+ line fixes → delegate another implementation pass. 1-2 lines → fix directly. Commit and push. Update activeForm: `[implementer] Fixing review findings`
- Proceed when: review is clean (APPROVE or Nits only).

**→ Mark stage 6 (Review) as `completed`**

### Step 8: CI checks
**→ Mark stage 7 (CI) as `in_progress` with activeForm `Waiting for CI checks`**

Run `gh pr checks --watch --fail-fast` to monitor CI.

Handling results:
- CI failure: identify via `gh run view <run-id> --log-failed`, spawn debugger agent, fix, commit, push. Update activeForm: `[debugger] Fixing CI failure (retry 1/3)`. Max 3 CI retries.
- Proceed when CI passes.

**→ Mark stage 7 (CI) as `completed`**

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
- One task = one worker = one branch = one PR.
- Default to sequential execution. Only use parallel worktrees when tasks are clearly independent.
- Maximum 1 retry per failed task (delegate a fresh worker). If the retry also fails, log and move on.
- If a task is too vague to implement, ask the user for clarification rather than guessing.
- When updating TASKS.md on main, use a minimal commit — don't open a PR for tracker updates.
- Skip audit subagents (docs-consolidator, ci-cd-pipeline, smoke-test) if those skills aren't installed. Don't fail the pipeline over optional steps.
- Respect the project's CLAUDE.md conventions and commands. Read it before doing anything.
- **Context conservation**: Ralph stays lean by delegating each task to a fresh worker when possible. Keep your own messages short — task description, result parsing, merge commands, tracker updates.
