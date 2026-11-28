## Summary

## Docs

Docs: `<doc>` — update: … (supersedes …) / still true: …; …

Doc words: `<doc>` <before> → <after> [over target <N>], … / no live doc touched

<!-- Docs: name, in backticks and with one disposition, every mapped doc the PR edits and every doc whose Kept-true-by path (docs/README.md) the PR touches; CI (scripts/ci/check-docs.mjs) fails the PR otherwise. Doc words: one entry per touched EDITABLE doc. Before: `git show origin/{{DEFAULT_BRANCH}}:<doc> | wc -w`; after: `wc -w <doc>`; an absent side counts as 0. Add `over target <N>` when the after count exceeds the doc's Size target; CI only warns on it. -->

## Verification

<!-- Each command run and its result; a check not run says "not run". -->

## Risk tier

Risk tier: routine / high-risk (<effect>, AGENTS.md "Risk tiers")

<!-- High-risk: name the effect and both reviews (reviewer and the independent second review) with their verdicts once they exist. -->
