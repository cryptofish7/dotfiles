---
name: setup-workflow
description: Use when setting up the agent workflow (planner/implementer/reviewer roles, risk tiers, review layers, PR template, AGENTS.md, doc map and its CI checks) in a new or existing repository of any kind — web, mobile, backend, CLI, library, data/ML, game, smart contract or infra.
---

# Set up the agent workflow

Installs `template/` (next to this file; resolve this file's real path, as the skill folder may be a symlink) into a repository: `AGENTS.md`, `CLAUDE.md`, `README.md` (only when absent), `.gitignore` entry, `docs/README.md` (doc map), `.omp/agents/{planner,implementer,reviewer}.md` with their generated `.claude/agents/` twins, `.claude/skills/project-workflow/SKILL.md`, `.github/pull_request_template.md`, `.github/workflows/agent-checks.yml` and `scripts/ci/{check-docs,gen-claude-agents}.mjs` with their tests.

The checks are dependency-free Node scripts (Node 20+); CI runs them on GitHub's runners whatever the app's language. Setup itself needs no Node, and nothing here assumes the app uses Node.

## Rules

- Ask the owner only three things (Step 3), in one message, plus the diff confirmations of Step 5. Detect everything else.
- Never overwrite or edit an existing file without showing its diff and getting a yes. Compute every file's final content first, then diff; a file whose final content equals what is there is skipped silently, so a re-run on a set-up repo changes nothing.
- Placeholders are exactly `{{PROJECT_NAME}}`, `{{ONE_LINE}}`, `{{HIGH_RISK_AREAS}}`, `{{COMMANDS}}` and `{{DEFAULT_BRANCH}}`. None may remain when you finish.
- The managed agent roles are `planner`, `implementer` and `reviewer`. Their Claude twins are previewed and written only through Step 5; any other `.claude/agents/*.md` is never touched.
- Do not commit unless the owner asks; stage what you wrote.

## Step 1 — Locate the repository and its default branch

`git rev-parse --show-toplevel`. Not a git repository: run `git init` there (a new project). Note whether `origin` exists and whether the repo has commits.

Detect `{{DEFAULT_BRANCH}}`, first hit wins: `git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`); `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` when `origin` is on GitHub; `git config init.defaultBranch`; `git branch --show-current`; else `main`.

## Step 2 — Detect the stack and its commands

Read the manifests at the root and one level down (monorepo packages). For each, take the commands the project already defines before falling back to the tool's defaults:

| Signal | Commands come from |
| --- | --- |
| `package.json` (+ `pnpm-lock.yaml` / `yarn.lock` / `bun.lockb` / `package-lock.json` for the manager) | its `scripts`: install, dev, build, test, lint, typecheck, format |
| `pyproject.toml`, `requirements*.txt`, `setup.cfg`, `tox.ini`, `noxfile.py` | uv / poetry / pip install; `pytest`; `ruff` / `flake8`; `mypy` / `pyright`; the app's run command (e.g. `uvicorn`, `manage.py runserver`) |
| `Cargo.toml` | `cargo build`, `cargo test`, `cargo clippy`, `cargo fmt --check` |
| `go.mod` | `go build ./...`, `go test ./...`, `go vet ./...`, `golangci-lint run` if configured |
| `Gemfile` | `bundle install`, `bundle exec rspec` / `rails test`, `rubocop` |
| `build.gradle(.kts)`, `pom.xml` | `./gradlew build test` / `mvn verify`, lint tasks |
| `*.xcodeproj`, `*.xcworkspace`, `Package.swift` | `xcodebuild … test`, `swift build`, `swift test`, `swiftlint` |
| `pubspec.yaml` | `flutter pub get`, `flutter test`, `flutter analyze` / `dart …` |
| `foundry.toml`, `hardhat.config.*` | `forge build`, `forge test`, `forge fmt --check` / `npx hardhat test` |
| `Makefile`, `justfile`, `Taskfile.yml` | their targets win over the tool defaults above |
| `Dockerfile`, `docker-compose.yml`, `*.tf`, `k8s/`, `helm/` | build and local-run commands; infra plan/validate |
| `.github/workflows/*.yml`, other CI config | the exact commands CI runs: the best evidence of what really works |
| `.tool-versions`, `.nvmrc`, `.python-version`, `rust-toolchain*` | pinned toolchain versions to mention |

Draft `{{COMMANDS}}` as one fenced `bash` block, one command per line with a `# what it does` comment: install, run, test (all and one), lint, format, typecheck, build, plus migrations or deploy commands if they exist. Record which manifest each came from.

Prefill the high-risk checklist from what the code does (`AGENTS.md` "Risk tiers" lists the effects): payment SDKs (Stripe, PayPal, Adyen, in-app purchase) → money; auth libraries, session or JWT code, permission checks → auth; `.env.example`, secret managers, key handling → secrets; user/account models, PII fields, analytics exports → user data; migration folders (`migrations/`, `alembic/`, `db/migrate/`, `prisma/migrations/`) → destructive data operations; deploy workflows, IaC, production config → deploy/infra; smart contracts holding value → money and irreversible. Pair each ticked area with the paths that hold it.

## Step 3 — Ask the owner (one message)

1. Project name and a one-line description (prefill from the README, manifest `name`/`description`, or the folder name).
2. High-risk areas: the full effect checklist with your detections ticked and their paths; the owner ticks, unticks, adds.
3. The drafted commands and the detected default branch: confirm or correct.

## Step 4 — Compute every final file

Work in a scratch folder (`mktemp -d`), never in the repo, and build the final content of each file:

- **Filled template files.** Every file under `template/` with the placeholders replaced:
  - `{{PROJECT_NAME}}`, `{{ONE_LINE}}`: the answers to question 1;
  - `{{HIGH_RISK_AREAS}}`: one bullet per confirmed area, `- **<Area>**: <paths> — <the effect>`; with none, `- None listed yet; the effects above still decide the tier.`;
  - `{{COMMANDS}}`: the confirmed fenced block;
  - `{{DEFAULT_BRANCH}}`: the confirmed branch name.

  Then `grep -rnE '\{\{(PROJECT_NAME|ONE_LINE|HIGH_RISK_AREAS|COMMANDS|DEFAULT_BRANCH)\}\}' <scratch>` must print nothing (the workflow's `${{ … }}` expressions are GitHub syntax, not placeholders).
- **Merged doc map.** Start from the repo's existing `docs/README.md` if it has a `## Doc map`, else from the filled template, and add only what is missing:
  - the template's blocks the repo lacks;
  - the manifests the commands came from (e.g. `pyproject.toml`, `package.json`, `Makefile`) in the Kept true by of the `README.md` block and the `AGENTS.md`, `CLAUDE.md` block;
  - for every other tracked `.md` file not yet covered, a block (Answers, Must contain, Must not contain, Kept true by, Size target ≈ its current words rounded up by a quarter) or, for a record that must not change, an IMMUTABLE row. Group docs that share a contract under one heading glob. Read each doc to fill its block; do not invent paths.
- **`.gitignore`.** The existing file plus a `.evidence/` line only if no line already ignores `.evidence/`; the template file when there is none.
- **Agent twins.** Only the managed roles of `MANAGED` in `scripts/ci/gen-claude-agents.mjs` (`planner`, `implementer`, `reviewer`) have twins; any other omp or Claude agent is left alone. Setup itself needs no Node. For each managed role:
  - existing `.claude/agents/<role>.md` without its generated-file line: the owner's own; its final content is the existing file, unchanged;
  - final `.omp/agents/<role>.md` byte-identical to the template's: the final twin is the shipped `template/.claude/agents/<role>.md`, as is;
  - customised source (the owner kept or merged their own) and Node 20+ available: copy the final managed sources into `<scratch>/.omp/agents/`, run `node <scratch>/scripts/ci/gen-claude-agents.mjs --root <scratch>`, and take `<scratch>/.claude/agents/<role>.md` as the final twin;
  - customised source and no Node: write the twin by hand with the generator's transformation (its header comment states it): frontmatter `name`, `description` copied, `model` only from `anthropic/<id>` (as `<id>`), `effort` from `thinking-level` (minimal/low → low, medium, high, xhigh; off → none), `tools` capitalised; then the generated-file line (`GENERATED` in the script, with the role's name); then the omp body unchanged. Preview it in the Step 5 batch, and tell the owner CI's `--check` confirms it on the first PR.

## Step 5 — Install

Compare each final file with the repo:

- absent → write it;
- identical → skip, no message;
- different → show `diff -u <existing> <final>` and ask: replace, merge, or keep. Batch all such diffs into one message, the managed twins included. Defaults to propose: `README.md` keep the existing one; `AGENTS.md`, `CLAUDE.md` merge (keep the project's facts, take the template's sections and wording); any other file replace only if the existing one is an older copy of this template.

A kept twin that still carries its generated-file line will fail `--check` against its omp source: say so in the batch and offer to drop that line so the twin becomes the owner's own. Write with your edit and write tools only.

## Step 6 — Make it green

Stage the written files (`git add <paths>`; the doc check reads tracked files only). Then, from the repo root:

```bash
node scripts/ci/gen-claude-agents.mjs --check
node scripts/ci/check-docs.mjs
node --test scripts/ci/__tests__/*.test.mjs
```

Never run the generator without `--check` here: the twins were previewed and installed in Step 5. A failure sends you back to Step 4 for the file at fault (a map block, a missing path, a twin) and through Step 5's confirmation again. A dead link or cite the doc check reports in an existing doc goes to the owner with the proposed fix; edit it only after a yes. With no Node 20+ locally, report each check as "not run" and say CI (`agent-checks.yml`) runs them on the first PR, `--check` confirming any hand-written twin.

## Step 7 — Report

List: files written, merged, skipped or kept (with the owner's choice), the default branch, the filled high-risk areas and commands, and each check's output verbatim. Mention the optional next steps without asking about them: bind per-role models (omp `.omp/config.yml` `modelRoles`, or an `anthropic/` `model:` line that the generator copies to the Claude twin), give the reviewer a different model family than the implementer, and add specialised reviewers under `AGENTS.md` "Reviews".

## Maintaining the template

`template/` is the source of truth for new projects. A workflow change made in a project that is not specific to that project also lands here, so the next setup gets it.
