## Workflow

### Starting a Session

1. Read project documentation for context (e.g., PRD, architecture docs, README).
2. Check the task tracker (e.g., `docs/TASKS.md`, GitHub Issues) for current progress. Identify the next incomplete task.
3. Start from a clean state on the default branch:
   ```bash
   git checkout main && git pull origin main
   ```

### During Development — Orchestrator Pattern

If you were spawned as a Task Runner by an orchestrator (like Ralph), follow the Pipeline section of your prompt instead of this workflow.

**You are the orchestrator.** You run on Sonnet 5. Your role is to coordinate state, route data between subagents, and control the workflow loop — you do NOT write implementation code directly and do NOT audit plans or diffs yourself. All code generation goes to Implementer; all plan/code audits go to Reviewer. This preserves your context window for coordination across the full task lifecycle.

**Subagent roster:**

| Subagent    | Model / effort              | How to spawn                        | Purpose                                          | Writes code? |
| ----------- | ---------------------------- | ------------------------------------ | ------------------------------------------------- | ------------ |
| Planner     | Fable 5.1, high effort       | `planner` agent                      | Breaks down the goal into `TODO.md`               | No           |
| Reviewer    | GPT 5.6 Sol via `/codex`, high effort | `reviewer` agent            | Adversarially audits `TODO.md` (plan) and diffs (code) | No      |
| Implementer | Sonnet 5, low effort          | `implementer` agent                  | Executes one `TODO.md` task at a time, writes tests | Yes         |

There is no separate debugger agent — Implementer is the only failure-diagnosis step (see its `.claude/agents/implementer.md` constraints). A test/build/CI failure gets routed back to Implementer with the failure output, not to a dedicated debugging specialist.

**Operational loop:**

1. **PHASE 1 — Planning**: Spawn the `planner` agent with the user goal. It reads the codebase and writes `TODO.md` in the project root. Do not write functional code yourself at this stage.
2. **PHASE 2 — Plan audit**: Spawn the `reviewer` agent and instruct it to audit `TODO.md` for architectural flaws, missing edge cases, or security blind spots.
   - `PLAN FAIL` → pass the critique back to `planner` to rewrite `TODO.md`, then re-audit.
   - `PLAN PASS` → proceed to Phase 3.
   - Cap at 3 plan-audit rounds. If still failing, stop and ask the user for help.
3. **PHASE 3 — Execution**: Create a feature branch from main: `git checkout -b <type>/<short-slug>`. Read the approved `TODO.md` and, for each task item, spawn `implementer` with that single task plus CLAUDE.md conventions. If a task's change fails lint/typecheck/build/test, `implementer` self-corrects before returning — you do not spawn a separate fixer.
4. **PHASE 4 — Code audit**: Once all `TODO.md` tasks are implemented, spawn `reviewer` to audit the resulting diff against `TODO.md`'s requirements.
   - `CODE FAIL` → pass the critique back to `implementer` (targeted at the flagged task) to fix, then re-audit.
   - `CODE PASS` → proceed to the post-task pipeline below.
   - Cap at 3 code-audit rounds. If still failing, stop and ask the user for help.
5. When stuck or going in circles beyond the caps above, stop. Re-plan (back to Phase 1) before continuing.

**When the orchestrator acts directly** (exceptions):
- Git operations (commit, branch, push, merge)
- Running commands (tests, linters, CI checks)
- Trivial fixes (1-2 lines: typo, import, format issue)
- Task tracker updates
- Spawning audit subagents (docs, CI/CD, smoke test) — see Step 2 of the post-task pipeline

**Verification protocol**: After Implementer writes code, the orchestrator runs the full verify suite before proceeding. Never trust subagent output without verification.

**Progress tracking**: Use TaskCreate to register each development and pipeline step. Prefix every `subject` and `activeForm` with the responsible agent in brackets so the user can see who's doing what (e.g., `subject: "[Planner] Plan: add auth"`, `activeForm: "[Planner] Planning auth"`). Mark `in_progress` when starting, `completed` when done. The user sees live progress via `Ctrl+T`.

### After Completing a Task — Autonomous Pipeline

Run this pipeline after every completed task. No user input required unless a step fails and cannot be auto-resolved.

**Step 1: Verify locally.**
Spawn `implementer` to run the project's linting, formatting, type checking, and test commands. The subagent checks the Commands section of this file or `pyproject.toml`/`package.json`/`Makefile` for the exact commands. On failure, it self-corrects (no separate debugger); report final pass/fail.

**Step 2: Audit docs, CI/CD, and deploy script (parallel).**
Spawn these as **parallel Task subagents** (`subagent_type=general-purpose`) pinned to the model noted per step. Each subagent gets the relevant skill instructions and an explicit directive: "Execute autonomously. Do not ask the user for approval — review your own plan and proceed."

- **Docs audit** (Haiku 4.5): Read `~/.claude/skills/docs-consolidator/SKILL.md` and pass its contents. The subagent audits and consolidates project docs.
- **CI/CD audit** (Sonnet 5, low effort): Read `~/.claude/skills/ci-cd-pipeline/SKILL.md` and pass its contents. The subagent ensures GitHub Actions matches the current project state.
- **Deploy script update** (Sonnet 5, low effort): Read `~/.claude/skills/smoke-test/SKILL.md` and pass its contents. The subagent updates `scripts/deploy.sh` to deploy any new services locally and health-check them.
- **Bug bash update** (Sonnet 5, low effort): Read `~/.claude/skills/bug-bash-update/SKILL.md` and pass its contents. The subagent updates docs/BUG_BASH_GUIDE.md with new checklist items for features and fix annotations for bugs. For bug fixes, it verifies the fix in the browser before marking [x].

Skip any if the skill is unavailable. Wait for all subagents to complete before proceeding.

**Step 3: Commit all changes.**
Stage and commit everything from the task and from Step 2. Write a concise, descriptive commit message. Use conventional commit prefixes when appropriate (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`).

**Step 4: Push and open a PR.**
- Push the current branch and open a PR:
  ```bash
  git push -u origin HEAD
  gh pr create --fill
  ```

**Step 5: Code review and CI (parallel).**
Start both immediately after opening the PR:

- **5a**: Spawn the `reviewer` agent (Phase 4 code audit, `CODE PASS`/`CODE FAIL` — see Operational loop above) against the PR.
- **5b**: Run `gh pr checks --watch --fail-fast` to monitor CI.

Handling results:
- On `CODE FAIL`, or a `CODE PASS` with "Minor fixes" noted, address every finding before merging:
  - **3+ line fixes**: Spawn `implementer` to apply them. Do not fix directly.
  - **1-2 line fixes**: The orchestrator may apply these directly.
  - Commit and push fixes. CI restarts automatically on the new push. Re-run `reviewer` on `CODE FAIL` before proceeding.
- If CI fails:
  1. Identify the failure: `gh pr checks` then `gh run view <run-id> --log-failed`.
  2. Spawn `implementer` with the failure context to self-correct — there is no separate debugger.
  3. Apply the fix on the same branch, commit, and push.
  4. Max 3 CI retries. If still failing, stop and ask the user for help.
- **Proceed to Step 6 when**: every review finding is either fixed or justified, AND CI passes.

**Step 6: Merge the PR and clean up.**
```bash
gh pr merge --squash --delete-branch
git checkout main && git pull origin main
```
- **After merge, verify main CI:**
  1. Wait for post-merge CI: `gh run list --branch main --limit 1 --json databaseId,status,conclusion | jq` then `gh run watch <run-id>`.
  2. If CI fails: treat as highest priority. Diagnose with `gh run view <run-id> --log-failed`, fix on a new branch, and merge the fix before moving on.
  3. The task is not complete until main CI is green.
- **If merge conflict:**
  1. Rebase onto the default branch: `git fetch origin main && git rebase origin/main`.
  2. Force-push safely: `git push --force-with-lease`.
  3. Wait for CI again (return to Step 5b). Max 1 retry.
  4. If the conflict persists, stop and ask the user for help.

**Step 7: Conserve context.**
Keep context lean by delegating implementation to Task subagents rather than writing code directly. If running as a Task Runner, report your result and exit.

### After Making a Mistake

- Add a specific rule to "Mistakes to Avoid" at the bottom of this file.

## Quality Standards

- Be your own reviewer. Would this pass code review? What would a senior engineer question?
- Prove it works. Don't just write code — run it. Show test output.
- Demand elegance (balanced). For non-trivial changes, pause and ask: "is there a more elegant way?" If a fix feels hacky, ask: "knowing everything I know now, what's the right solution?" Skip this for simple, obvious fixes — don't over-engineer.
- Ask clarifying questions upfront. Ambiguity leads to wasted work.

## BUG_BASH_GUIDE Discipline

`docs/BUG_BASH_GUIDE.md` is a **stable regression checklist**, not a per-PR scratchpad. It exists to be re-run before every release.

**Sections are user-facing surfaces** (and non-UI surfaces like backend health, jobs, or workers where bug bash exercises them through the UI or CLI). Never name a section after a PR, branch, or release. Each item is a recurring regression check.

**Two tests before adding anything**:

1. **Long-life wording**: would this exact wording still make sense to run 6 months from now, after this PR is forgotten? If the wording references a PR, branch, redesign generation, sprint, or "new" anything, rewrite it surface-first or drop it. This catches the failure mode of "yes, this technically recurs" — every new feature *technically* has ongoing regression risk; only the ones that read as enduring surface behavior belong here.
2. **Surface**: does it fold into an existing section? Default yes. New sections only for genuinely new user-facing surfaces.

**Per-PR rules**:

- Cap additions at ~3 items per PR. If you legitimately need more, you're probably adding a new surface section — that's fine, but verify against the surface test. Most PRs add 0–1 items; many add zero.
- `feat:` adds an item only when it passes the long-life test. Launch verification ("does this new layout render correctly") goes in the PR description.
- `fix:` annotates the existing item the bug violated as `[!] FIXED (PR #N)`. **`[!] FIXED` requires browser verification before becoming `[x]`** — never skip straight to `[x]` from code review or test output. After browser verification with screenshot evidence, convert to `[x]` and **strip the `(PR #N)` annotation** (e.g. `[!] FIXED (PR #471) modal closes on outside click` → `[x] modal closes on outside click`). Git blame is the audit trail. If no existing item caught the bug, add ONE recurring item that would have caught the class of bug, not the specific instance.
- Never create a section named after a PR, branch, or "redesign vN." Fold into the surface.

**Items can be removed when** (a) the surface no longer exists, (b) the item is a duplicate, (c) it's a one-shot launch verification that slipped in, or (d) the behavior it tests was deliberately changed. **Removing an item because it keeps failing is never a valid reason** — fix the regression instead.

The `bug-bash-update` skill enforces these rules at write time and runs a hygiene pass on neighboring items each time it edits a section (strips orphan `(PR #N)` tags, folds adjacent per-PR sub-sections, drops dead one-shots). If a change doesn't fit under an existing surface within the cap, that's the signal it doesn't belong in the doc — write it in the PR description instead.

## Tasks Tracker Discipline

`docs/TASKS.md` (or the project's task tracker) is a **forward-looking outcome tracker**, not a per-PR changelog. Each item describes scope; git log is the audit trail.

**Rules:**

- Items are scoped at the **outcome** level, not per-PR/commit.
- No `(PR #N)`, `(#N)`, or `branch: foo/bar` qualifiers in task descriptions or section headings. If they leak in during planning, strip them when ticking `[x]`.
- New milestones only for genuinely new scope. Otherwise fold into the existing milestone whose scope matches. A new milestone per PR is a smell.
- Sub-bullet decomposition cap: don't decompose below "what a future reader needs to know was done." Aim for one bullet per outcome, not one bullet per commit.
- Superseded phases are deleted or collapsed to a single one-liner — never preserved as tombstones with their original content intact.
- When a PR ships work covered by an item, **tick `[x]` as part of the post-task pipeline**. The `docs-consolidator` skill enforces this in Step 2; the orchestrator should not rely on memory.

**Universal doc hygiene (applies to all other docs too):** no `(PR #N)` / `branch:` qualifiers in headings or items, no "(new in vN)" / "(post X migration)" markers that turn stale once X ships, no "Superseded" tombstones that preserve the original content (a one-line "Superseded by Milestone N" is fine). Run a hygiene pass on neighboring items each edit. The `docs-consolidator` skill enforces this at write time. Stable reference docs (PRD, architecture, security, design system) only need the universal rule; the two doctrines above (BUG_BASH_GUIDE Discipline, Tasks Tracker Discipline) layer genre-specific tests on top.
