# CLAUDE.md

@AGENTS.md

## Claude Code deltas

Claude Code sessions follow everything above, plus:

- **Agents.** The managed roles (`planner`, `implementer`, `reviewer`; `MANAGED` in `scripts/ci/gen-claude-agents.mjs`) have Claude twins in `.claude/agents/`, written from `.omp/agents/<role>.md` by that script and marked by its generated-file line. Edit the omp file, then run the script; never hand-edit a twin, because CI `--check` fails on drift. A twin runs on the session's model unless its omp source names an `anthropic/` model. Any other agent, omp-only or Claude-only, and a managed role's twin without the generated-file line (the owner's own) are never generated or checked.
- **Second review.** Claude Code offers only Anthropic models, so the independent second review of high-risk work runs in a fresh `reviewer` subagent that never sees the first verdict, or in another harness with a different model family; the merge record names which.
- **Progress tracking.** Use the task tracker; prefix each item with the responsible agent in brackets (e.g. `[planner] Plan: add login`).
