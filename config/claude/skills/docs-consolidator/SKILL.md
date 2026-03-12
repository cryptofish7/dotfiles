---
name: docs-consolidator
description: Audit and consolidate project documentation in the docs/ folder, including CLAUDE.md optimization. Use when the user wants to clean up docs, check docs are up to date, deduplicate information across docs, ensure information lives in the right doc, reorganize documentation, or slim down CLAUDE.md files. Triggers on "consolidate docs", "clean up documentation", "audit docs", "organize docs", "sync docs with code", "audit claudemd", "review claude.md", "slim down claude.md", "optimize claude.md", "claudemd audit".
---

# Docs Consolidator

Audit, deduplicate, and reorganize project documentation so every piece of information has one home and all docs stay current.

## Workflow

### Phase 1: Build the inventory

1. Check if `.claude/doc-registry.md` exists in the project root.
   - **If it exists:** read it and use it as the authoritative registry. Skip to step 4.
   - **If it doesn't exist:** continue to step 2 to discover and generate one.
2. Find all documentation files: scan `docs/`, root `CLAUDE.md` (or `docs/CLAUDE.md` if symlinked), `README.md`, and any other `.md` files referenced by CLAUDE.md.
3. For each doc, read it and note:
   - What information it currently contains (section-level summary)
   - Its apparent purpose (infer from filename, headers, and content)
   - Its line count
4. If no registry existed, build one: assign each doc a purpose and ownership domain. Use these common categories as a guide:
   - **CLAUDE.md** — Orientation for Claude Code sessions: conventions, gotchas, pointers. NOT a wiki.
   - **PRD / product doc** — Product logic, user stories, feature specs, business rules
   - **Architecture doc** — System design, data flow, database schema, API endpoints
   - **Tasks / progress doc** — Current tasks, completed work, backlog
   - **Deployment / CI-CD docs** — Deployment config, pipelines, environment setup
   - **Security docs** — Threat models, trust assumptions, audit scope
   - **Testing docs** — Test checklists, QA guides
   - **Setup / infra docs** — Database setup, service config, hosting details
5. If the registry was generated (not loaded from file), write it to `.claude/doc-registry.md` in the project root using this format:

```markdown
# Document Registry

Each doc has ONE purpose. Information belongs in the doc that owns that domain.

| File | Purpose | Owns |
|------|---------|------|
| `path/to/doc.md` | Brief purpose | What information this doc is the canonical source for |

## Overlap Rules

- [category] → `canonical-doc.md`, not [other doc]
```

Present the generated registry to the user and ask for approval before continuing. The user may want to adjust purposes or ownership boundaries.

### Phase 2: Identify problems

Read every doc (if not already read in Phase 1) and compare against the registry. Flag:

- **Misplaced information**: content that belongs in a different doc per ownership rules (e.g., architecture details in CLAUDE.md, progress updates in an architecture doc)
- **Duplication**: the same information restated in multiple docs. Identify the canonical home and where the duplicates are.
- **Stale content**: references to removed code, outdated addresses, old instructions, TODOs that are done, etc. Cross-check against actual code when uncertain.
- **Missing information**: important topics not documented anywhere, or docs that reference sections that don't exist.
- **Poor organization**: docs where sections are out of logical order, or where related information is scattered across unrelated sections.
- **Undocumented feature**: Examine the current branch name, recent commits, and changed files to determine if a significant new feature was implemented. Check each doc in the registry to see if it needs updating for this feature. For example: does the tasks/progress doc need a new milestone? Does the architecture doc need new components or APIs? Does a security doc need new threat analysis? Flag each doc that needs additions.

#### CLAUDE.md deep audit

Additionally, collect all CLAUDE.md files (root, `packages/*/CLAUDE.md`, `~/.claude/CLAUDE.md`, `~/.claude/projects/<project-path>/CLAUDE.md`) and audit them for:

- **Redundancy**: instructions that say the same thing in different words within one file, rules restated across multiple CLAUDE.md files, content that duplicates referenced docs, sections that restate framework/tool defaults Claude already knows.
- **Verbosity**: wordy phrasing that can be compressed without losing meaning. Apply the "would a senior engineer need this spelled out?" test. Flag overlong examples, unnecessary caveats, and multi-sentence rules that could be one sentence.
- **Memory candidates**: stable, rarely-changing content that doesn't need to be in the repo — personal preferences, environment-specific paths/URLs, user-specific tool configs, local port assignments. These belong in project memory (`~/.claude/projects/<path>/CLAUDE.md`), not the repo.

### Phase 3: Present the plan

Present findings as a structured report to the user:

```
## Doc Audit Report

### Misplaced Information
- [ ] [source doc] → [target doc]: [what to move]

### Duplications
- [ ] [info]: found in [doc A] and [doc B]. Keep in [canonical doc], remove from [other].

### Stale Content
- [ ] [doc]: [what's stale and why]

### Organization Issues
- [ ] [doc]: [what to reorder/restructure]

### CLAUDE.md Optimization
#### Redundancy
- [ ] [file] lines X-Y: [description] — duplicates [other location]
#### Verbosity
- [ ] [file] lines X-Y: [current text snippet] → [compressed version]
#### Memory Candidates
- [ ] [file] lines X-Y: [content] — stable/personal, move to project memory
```

Ask the user to approve the plan before making any changes.

### Phase 4: Execute changes

After approval, apply changes doc by doc:

1. Move misplaced content to the correct doc
2. Deduplicate — keep the best version in the canonical location, replace duplicates with a brief cross-reference (e.g., "See `ARCHITECTURE.md` for database schema")
3. Remove or update stale content
4. Reorder sections for logical flow
5. Update any cross-references that broke due to moves
6. Document new features across relevant docs:
   - For each doc flagged as needing feature documentation, add content to the appropriate existing sections following the doc's style.
   - Tasks/progress docs: create a new milestone or section tracking the completed work. Mark items as done. Include PR references if available.
   - Architecture docs: add new components, endpoints, schemas, or data flows.
   - Product/PRD docs: add new feature specs or user flows.
   - Security docs: add new trust assumptions or threat analysis.
   - CLAUDE.md: add key hooks, architectural notes, or gotchas (keep lean).
   - Only update docs where the feature introduces something new for that doc's domain. Don't force updates.
   - All existing guidelines apply: prefer cross-references over duplication, keep CLAUDE.md lean, preserve writing style, one source of truth per topic.
7. Apply approved CLAUDE.md optimizations:
   - Compress approved verbose sections in-place
   - Remove approved redundant content
   - Move approved memory candidates to `~/.claude/projects/<path>/CLAUDE.md` (create the file if needed, append to existing)

### Phase 5: Verify

1. Check that every doc has the content it should own and nothing else
2. Grep for broken cross-references (doc paths, section links)
3. If CLAUDE.md has a "Reference Documents" section, confirm it matches the actual docs
4. For any new feature detected, confirm each flagged doc was updated and new content is in the correct section per the registry.
5. Present a brief summary of all changes made

## Guidelines

- Prefer cross-references over duplication. A one-line pointer is better than a restated paragraph.
- Don't merge docs unless the user explicitly asks. The goal is to put information in the right place, not reduce the number of files.
- Preserve the user's writing style and voice. Clean up structure, not prose.
- When uncertain whether content is stale, flag it for the user rather than deleting.
- If an `archive/` directory exists, move superseded docs there rather than deleting.
- Keep CLAUDE.md lean: orientation, commands, conventions, gotchas. Everything else belongs in a specific doc.
- For CLAUDE.md verbosity fixes, show before/after so the user can judge.
- Conservative memory moves: only suggest moving content that is truly stable and personal/environment-specific. Repo-essential content stays in the repo.
- Don't touch intentionally detailed sections (war stories, "mistakes to avoid") — flag them only if genuinely redundant.
- No false positives: if a CLAUDE.md file is already lean, say so.
