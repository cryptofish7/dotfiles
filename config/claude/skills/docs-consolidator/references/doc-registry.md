# Document Registry

Each doc has ONE purpose. Information belongs in the doc that owns that domain.

| File                              | Purpose                                                                                                                       | Owns                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `docs/CLAUDE.md`                  | Orientation for Claude Code sessions. Conventions, gotchas, pointers. NOT a wiki. Root `CLAUDE.md` is a symlink to this file. | Workflow rules, quality standards, dev commands, git conventions, "Mistakes to Avoid" |
| `docs/Forecaster_PRD.md`          | Product requirements                                                                                                          | Product logic, user stories, feature specs, business rules                            |
| `docs/Forecaster_Architecture.md` | Technical architecture                                                                                                        | System design, data flow, database schema, API endpoints, component interactions      |
| `docs/Bonding_Curve_Redesign.md`  | Curve mechanics                                                                                                               | Bonding curve math, token ID scheme, curve parameters, liquidity splitting            |
| `docs/TASKS.md`                   | Progress tracking                                                                                                             | Current tasks, completed work, backlog, discovered issues                             |
| `docs/CICD_SETUP.md`              | CI/CD configuration                                                                                                           | GitHub Actions workflows, deployment pipelines, environment setup                     |
| `docs/TESTNET_DEPLOYMENT.md`      | Testnet user guide                                                                                                            | Deployed addresses, how to interact with testnet, user-facing instructions            |
| `docs/RAILWAY_SETUP.md`           | Railway configuration                                                                                                         | Database setup, service config, Railway-specific details                              |
| `docs/AUDIT_SCOPE.md`             | Security audit scope                                                                                                          | Contract LOC counts, what's in/out of audit scope                                     |
| `docs/SECURITY_ASSUMPTIONS.md`    | Trust model                                                                                                                   | System trust assumptions, who controls what, threat boundaries                        |
| `docs/THREAT_MODEL.md`            | Security threats                                                                                                              | Attack vectors, risk analysis, mitigations                                            |
| `docs/BUG_BASH_GUIDE.md`          | Manual testing                                                                                                                | Exploratory testing checklist, test scenarios                                         |
| `docs/archive/`                   | Superseded docs                                                                                                               | Old docs kept for reference only, not active                                          |

## Overlap Rules

- Architecture details (schemas, APIs, data flow) → `Forecaster_Architecture.md`, not CLAUDE.md
- Product logic (how features work, user flows) → `Forecaster_PRD.md`, not Architecture
- Curve math (formulas, parameters, token IDs) → `Bonding_Curve_Redesign.md`, not Architecture
- Security (threats, assumptions, audit) → respective security doc, not Architecture
- Progress/status → `TASKS.md`, nowhere else
- Dev setup/commands → `CLAUDE.md`, not Architecture
- Deployment addresses/config → `TESTNET_DEPLOYMENT.md` or `CICD_SETUP.md`, not CLAUDE.md
