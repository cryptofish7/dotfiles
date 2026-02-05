---
name: setup-workflow
description: Set up the autonomous post-task workflow for a project. Injects the standard development pipeline into CLAUDE.md and installs all required skills and agents (docs-consolidator, ci-cd-pipeline, code-reviewer, debugger). Use at the start of a new project. Triggers on "setup workflow", "init workflow", "add workflow", or "set up project workflow".
---

# Setup Workflow

Install the autonomous post-task development pipeline into a project's CLAUDE.md. This skill is self-contained — it bundles all required dependencies and will install any that are missing.

## Dependencies

This workflow requires 4 tools. The skill bundles copies in `references/` and uses a live-first sync strategy:

| Dependency | Type | Live path |
|-----------|------|-----------|
| docs-consolidator | Skill | `~/.claude/skills/docs-consolidator/SKILL.md` |
| ci-cd-pipeline | Skill | `~/.claude/skills/ci-cd-pipeline/SKILL.md` |
| code-reviewer | Agent | `~/.claude/agents/code-reviewer.md` |
| debugger | Agent | `~/.claude/agents/debugger.md` |

## Workflow

### Phase 1: Sync and check dependencies

For each dependency in the table above, apply the live-first sync strategy:

1. **Check if the live file exists.**
2. **If it exists:** Read the live file and compare it to the bundled reference in this skill's `references/` directory. If they differ, update the bundled reference to match the live file (keeps references current).
3. **If it does NOT exist:** Copy the bundled reference from `references/` to the live path. Create any intermediate directories as needed.

Also handle the ci-cd-pipeline's `actions-catalog.md` reference:
- Live path: `~/.claude/skills/ci-cd-pipeline/references/actions-catalog.md`
- Bundled: `references/ci-cd-actions-catalog.md`

After syncing, report what was found and what was installed.

### Phase 2: Detect CLAUDE.md

Search for the project's CLAUDE.md file:
1. Check for `CLAUDE.md` in the project root
2. Check for `docs/CLAUDE.md`
3. Check if root `CLAUDE.md` is a symlink to `docs/CLAUDE.md`

If found, note the path. If not found, note that a new one will be created.

### Phase 3: Read current state

If CLAUDE.md exists:
1. Read it fully
2. Check if a `## Workflow` section already exists
3. Note the line range of the existing Workflow section (from `## Workflow` to the next `## ` heading or end of file)

### Phase 4: Inject workflow

Read `references/workflow-template.md` — this is the canonical workflow content.

**If a Workflow section exists:** Replace it (from `## Workflow` up to but not including the next `---` or `## ` heading) with the content of `workflow-template.md`.

**If CLAUDE.md exists but has no Workflow section:** Insert the workflow content after the first heading block (title + any introductory text before the first `---`).

**If no CLAUDE.md exists:** Create a new `CLAUDE.md` in the project root with this structure:
```markdown
# CLAUDE.md
## Project — Development Guide

This file provides context for Claude Code sessions working on this project.

---

[workflow-template.md content here]

---

## Commands

[Auto-detect from pyproject.toml / package.json / Makefile / Cargo.toml and list the project's lint, format, typecheck, and test commands]

---

## Mistakes to Avoid

*Claude: After any correction, add a rule here. Be specific.*
```

### Phase 5: Verify

1. Read the updated CLAUDE.md
2. Confirm the Workflow section contains the full 9-step pipeline
3. Confirm no other sections were accidentally modified
4. Report a summary of all changes made

## Guidelines

- Never modify any section of CLAUDE.md outside the Workflow section (unless creating a new file)
- The workflow template in `references/workflow-template.md` is the single source of truth
- If auto-detecting commands for a new CLAUDE.md, prefer reading the project's config files over guessing
- When syncing dependencies, create parent directories (`mkdir -p`) as needed
