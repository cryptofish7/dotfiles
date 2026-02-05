---
name: docs-consolidator
description: Audit and consolidate project documentation in the docs/ folder. Use when the user wants to clean up docs, check docs are up to date, deduplicate information across docs, ensure information lives in the right doc, or reorganize documentation. Triggers on requests like "consolidate docs", "clean up documentation", "audit docs", "organize docs", "sync docs with code".
---

# Docs Consolidator

Audit, deduplicate, and reorganize project documentation so every piece of information has one home and all docs stay current.

## Workflow

### Phase 1: Build the inventory

1. Read `references/doc-registry.md` in this skill's directory to understand each doc's purpose and ownership boundaries.
2. Read every file in `docs/` and the root `CLAUDE.md`. For each doc, note:
   - What information it currently contains (section-level summary)
   - Approximate staleness (references to things that no longer exist, outdated instructions, etc.)
   - Its line count

### Phase 2: Identify problems

Compare the inventory against the registry. Flag:

- **Misplaced information**: content that belongs in a different doc per the registry's ownership rules (e.g., architecture details in CLAUDE.md, progress updates in Architecture)
- **Duplication**: the same information restated in multiple docs. Identify the canonical home and where the duplicates are.
- **Stale content**: references to removed code, outdated addresses, old instructions, TODOs that are done, etc. Cross-check against actual code when uncertain.
- **Missing information**: important topics not documented anywhere, or docs that reference sections that don't exist.
- **Poor organization**: docs where sections are out of logical order, or where related information is scattered across unrelated sections.

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
```

Ask the user to approve the plan before making any changes.

### Phase 4: Execute changes

After approval, apply changes doc by doc:

1. Move misplaced content to the correct doc
2. Deduplicate — keep the best version in the canonical location, replace duplicates with a brief cross-reference (e.g., "See `Forecaster_Architecture.md` for database schema")
3. Remove or update stale content
4. Reorder sections for logical flow
5. Update any cross-references that broke due to moves

### Phase 5: Verify

1. Check that every doc in the registry has the content it should own and nothing else
2. Grep for broken cross-references (`docs/` paths, section links)
3. Confirm CLAUDE.md's "Reference Documents" section matches the actual docs
4. Present a brief summary of all changes made

## Guidelines

- Prefer cross-references over duplication. A one-line pointer is better than a restated paragraph.
- Don't merge docs unless the user explicitly asks. The goal is to put information in the right place, not reduce the number of files.
- Preserve the user's writing style and voice. Clean up structure, not prose.
- When uncertain whether content is stale, flag it for the user rather than deleting.
- Archive docs go in `docs/archive/` — don't delete them.
- Keep CLAUDE.md lean: orientation, commands, conventions, gotchas. Everything else belongs in a specific doc.

## Reference

- See `references/doc-registry.md` for the full document registry with ownership rules and overlap guidelines.
