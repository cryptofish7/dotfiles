---
name: quality-sweep
description: Full-codebase quality sweep via 8 parallel concern-focused subagents. Each owns one axis (dedup/DRY, shared types, dead code, circular deps, weak types, defensive programming, legacy/fallbacks, AI slop/comments), researches, produces a critical assessment, and implements high-confidence fixes. Use when the user asks to "clean up the codebase", "quality sweep", "vibecode cleanup", "remove slop", "kill dead code and any types", or wants a comprehensive cross-cutting cleanup rather than a per-package refactor audit.
---

# Quality Sweep

Comprehensive codebase cleanup partitioned by **concern**, not by package. Each concern gets one parallel subagent that researches, critiques, and fixes.

Use `refactor-audit` instead when the user wants a per-package/per-section refactor plan with approval gates. Use `quality-sweep` when they want a full cross-cutting cleanup executed in one pass.

## Workflow

### Phase 1: Detect tooling

Before dispatching, check what's available so subagents know what to use:

- `knip` (JS/TS dead code) — check `package.json` devDependencies or `npx knip --version`
- `madge` (JS/TS circular deps) — same check
- `ts-unused-exports`, `depcheck` — JS/TS alternatives
- `ruff`, `vulture`, `pyflakes` — Python equivalents
- `cargo-udeps`, `cargo +nightly udeps` — Rust
- Language server / typechecker (`tsc --noEmit`, `mypy`, `pyright`, `cargo check`)

Report the detected toolset to the user. If key tools are missing, ask whether to install or proceed without.

### Phase 2: Dispatch 8 subagents in parallel

Spawn all eight in a **single message** with parallel tool calls. Each is a `general-purpose` subagent with the concern's instructions below.

**Shared preamble** (prepend to every subagent prompt):

> You own ONE quality concern in a larger cleanup. Other subagents own other concerns — do not touch their territory.
>
> Work in two passes:
> 1. **Research + critical assessment** — read the code, identify issues, write a findings section with file paths and line numbers. Be specific.
> 2. **Implement high-confidence fixes only** — make the changes you are confident about. Leave ambiguous cases in the report for the user to review.
>
> Do NOT:
> - Make behavior changes unless the concern explicitly allows it
> - Fix issues outside your concern (note them, don't touch them)
> - Reformat, rename, or restructure beyond what the concern requires
>
> Output format:
> ```
> ## Findings
> - `path/file.ts:L42` — [issue]. [why it matters].
>
> ## Applied fixes
> - `path/file.ts:L42` — [what you did].
>
> ## Deferred (needs user decision)
> - `path/file.ts:L99` — [issue]. [why uncertain].
> ```

### The 8 concerns

Each subagent gets the shared preamble plus one of these:

1. **Deduplication / DRY.** Find duplicated logic, copy-pasted blocks, and near-identical functions. Consolidate where DRY genuinely reduces complexity. Skip cases where the duplication is incidental or where abstracting would create a worse coupling.

2. **Shared types.** Find type definitions that should live in a shared module. Consolidate types that are redefined across files. Do not invent new shared packages — use existing shared locations.

3. **Dead code removal.** Use the detected dead-code tool (knip / ts-unused-exports / vulture / cargo-udeps). Cross-check every flagged item against the full codebase — including dynamic references, string-based lookups, and public API surface — before deleting. If unsure, defer.

4. **Circular dependencies.** Use madge or the language equivalent. Untangle cycles by moving shared code to a lower layer or inverting a dependency. If a cycle is structural and risky to break, document it in Deferred.

5. **Weak types.** Find `any`, `unknown`, `object`, untyped dicts, `interface{}` (Go), etc. Research the actual runtime shape and replace with strong types. Verify with the typechecker after each change. If the correct type is genuinely dynamic, leave it and document why.

6. **Defensive programming cleanup.** Remove try/catch and equivalent guards that do not handle a real external boundary or known failure mode. Keep guards around: untrusted input, I/O, parsing, FFI, known-flaky operations. Remove: empty catches, catch-and-rethrow, catches that swallow errors, fallback values that mask bugs.

7. **Legacy / deprecated / fallback code.** Find deprecated APIs, legacy branches, feature flags that are permanently on/off, and fallback paths for removed systems. Remove them. Collapse code paths so each behavior has one implementation.

8. **AI slop and comment hygiene.** Remove: comments describing in-progress work ("TODO: refactor this later"), comments narrating obvious code ("// increment i"), changelog-style comments ("// was X, now Y"), stub/placeholder comments, and commented-out code. Keep: comments that explain non-obvious WHY, hidden constraints, workarounds with rationale. Be concise — if an edit is needed, prefer deletion over rewriting.

### Phase 3: Consolidate and report

After all subagents return:

1. Aggregate each report into sections by concern.
2. Verify the codebase still builds and tests pass. If anything is broken, identify which concern's fix caused it and revert that subagent's changes.
3. Present to the user:

```
## Quality Sweep Report

### Applied ({N} fixes)
[grouped by concern, with file:line references]

### Deferred ({M} items needing review)
[grouped by concern, with reasoning]

### Build / test status
[pass / fail + details]
```

4. Wait for user direction on deferred items. Do not auto-commit — let the user review the diff and commit themselves unless they explicitly ask.

## Guidelines

- **Parallelism is the point.** Always dispatch all 8 subagents in one message. Sequential execution defeats the purpose.
- **High-confidence only.** It is better to defer an ambiguous fix than to make a wrong one. The Deferred section is a feature, not a failure.
- **Verify after.** Always run the typechecker and test suite before reporting success. A sweep that breaks the build is worse than no sweep.
- **One concern per subagent.** If a subagent notices an issue in another concern's territory, it adds it to Findings but does not fix it — the owning subagent will handle it.
- **No scope creep.** This skill does not reformat code, rewrite for style, or restructure architecture. That's a different task.
