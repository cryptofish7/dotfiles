---
name: quality-sweep
description: "Full-codebase quality sweep across 8 concern-focused lanes: deduplication/DRY, shared types, dead code, circular dependencies, weak types, defensive programming, legacy fallbacks, and AI slop/comment hygiene. Use when the user asks to \"quality sweep\", \"clean up the codebase\", \"remove slop\", \"kill dead code\", \"fix weak types everywhere\", or wants a broad cross-cutting cleanup executed rather than a per-package refactor audit."
---

# Quality Sweep

Comprehensive codebase cleanup partitioned by concern, not by package. Each concern gets its own lane for research, critique, and high-confidence fixes.

Use `refactor-audit` instead when the user wants a ranked refactor plan or approval gate before edits. Use `quality-sweep` when they want the cleanup executed.

## Orchestration Model

Default to parallel execution when the runtime supports worker delegation and the user has asked for this sweep. Spawn one worker per concern with disjoint ownership. If delegation is unavailable, execute the same lanes locally one at a time and keep the concern boundaries explicit in the report.

Workers should be `worker` agents for implementation. If you need a quick read-only pass first, you may use `explorer` agents to identify hotspots before dispatching workers, but do not duplicate the same analysis twice.

## Workflow

### Phase 1: Detect tooling and project verification commands

Before dispatching work:

1. Detect the language/toolchain and available quality tools.
2. Identify the project's verification commands from `AGENTS.md`, `CLAUDE.md`, `package.json`, `pyproject.toml`, `Cargo.toml`, `Makefile`, or equivalent.
3. Check for relevant tooling when applicable:
   - JS/TS: `knip`, `madge`, `ts-unused-exports`, `depcheck`, `tsc --noEmit`, `eslint`
   - Python: `ruff`, `vulture`, `pyflakes`, `mypy`, `pyright`
   - Rust: `cargo check`, `cargo clippy`, `cargo +nightly udeps`
   - Other ecosystems: use the nearest equivalent dead-code, dependency, and type/static-analysis tools

Report the detected toolset in the final summary. If a key tool is missing, proceed with native code search plus the available verifiers unless the missing tool blocks safe execution.

### Phase 2: Dispatch 8 concern lanes

Create eight concern lanes in parallel when possible. Each worker owns one concern and must not fix issues in another lane.

Use this shared prompt core for each worker:

> You own ONE quality concern in a larger cleanup. Other workers own other concerns. Do not revert or overwrite their edits, and do not fix issues outside your concern.
>
> Work in two passes:
> 1. Research and critical assessment: read the code, identify issues, and record concrete findings with file paths and line numbers.
> 2. Implement high-confidence fixes only: apply the changes you are confident about, then run the narrowest relevant verification for your edits.
>
> Do not:
> - Make behavior changes unless the concern explicitly requires removing obsolete behavior
> - Reformat or restructure beyond what the concern needs
> - Delete anything that might be dynamically referenced or part of a public API without cross-checking first
>
> Output format:
> ```
> ## Findings
> - `path/file.ts:42` — issue and why it matters
>
> ## Applied fixes
> - `path/file.ts:42` — what changed
>
> ## Deferred
> - `path/file.ts:99` — issue and why it is uncertain
> ```

### The 8 concerns

1. **Deduplication / DRY**. Find duplicated logic, copy-pasted blocks, and near-identical functions. Consolidate only when it reduces complexity and does not create worse coupling.
2. **Shared types**. Find types that are duplicated across files and belong in an existing shared location. Do not invent a new shared package unless the repo already has an established pattern for one.
3. **Dead code removal**. Use the best available dead-code tool, then cross-check every candidate against the full codebase, dynamic references, string lookups, framework conventions, and public API surface before deleting anything.
4. **Circular dependencies**. Use dependency analysis tooling when available. Break cycles by moving shared code to a lower layer or inverting a dependency. If the cycle is structural or risky, defer it.
5. **Weak types**. Find `any`, `unknown`, loose dictionaries, `object`, `interface{}`-style placeholders, and similarly weak typing. Infer the real shape from usage and replace with stronger types where justified. Re-run the relevant typechecker after changes.
6. **Defensive programming cleanup**. Remove guards, catches, and fallbacks that only mask bugs. Keep defenses around real boundaries such as I/O, untrusted input, parsing, network calls, FFI, and known flaky integrations.
7. **Legacy / deprecated / fallback code**. Remove deprecated APIs, dead feature flags, permanently-on/off branches, and fallback paths for removed systems. Collapse code paths so one real implementation remains.
8. **AI slop and comment hygiene**. Remove placeholder comments, obvious narration, stale TODOs with no execution value, changelog-style comments, and commented-out code. Keep concise comments that explain non-obvious constraints or rationale.

### Phase 3: Integrate results

After the lanes finish:

1. Consolidate findings by concern.
2. Resolve overlap carefully. If two lanes touched adjacent code, keep the version that best preserves ownership and correctness.
3. Run the project's main verification commands:
   - Typecheck / static analysis when applicable
   - Targeted tests for changed areas
   - Full test suite if the repo is small enough or the changes are broad
4. If a verification failure is traceable to one lane, fix it if straightforward. Otherwise revert only that lane's change set and keep the item in Deferred.

### Phase 4: Report

Present the result as:

```markdown
## Quality Sweep Report

### Applied
- grouped by concern, with file references

### Deferred
- grouped by concern, with why each item was deferred

### Verification
- commands run and pass/fail status

### Tooling detected
- relevant analyzers and type/test commands discovered
```

Do not auto-commit unless the user explicitly asks.

## Guidelines

- Parallelism is preferred, but correctness matters more than fan-out. If the repo is small or the runtime cannot delegate, run the same concern model locally.
- High-confidence fixes only. Ambiguous removals or behavior changes belong in Deferred.
- Respect ownership boundaries between workers. Do not revert edits you did not make.
- No scope creep. This sweep is for cleanup, not stylistic rewrites or architecture migration.
- Verify before claiming success. A sweep that leaves the repo red is incomplete.
