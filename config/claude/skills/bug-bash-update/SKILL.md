---
name: bug-bash-update
description: Update docs/BUG_BASH_GUIDE.md after implementing features or fixing bugs. Maintains a stable regression checklist organized by user-facing surface — folds changes into existing sections, annotates fixes, and verifies fixes in the browser. Triggers on "bug bash update", "update bug bash", "update testing checklist".
---

# Bug Bash Update

Update `docs/BUG_BASH_GUIDE.md` after a task completes. The doc is a **stable regression checklist** — items recur across releases, sections are user-facing surfaces (Wallet, Profile, Trade Panel, Forecast Detail, etc.), and one-shot launch verification belongs in PR descriptions, not here.

**Default outcome of this skill is "no update needed."** Most PRs either don't introduce ongoing regression risk or fold cleanly into existing items. Adding a checklist item is the exception, not the norm.

## Guardrails (read before editing the doc)

Apply these tests before adding ANYTHING:

1. **Recurrence test** — would a reasonable person re-run this on the next release? If no, it's launch verification — write it in the PR description and stop. *Examples that fail this test*: "new Hero section renders correctly," "PR #485 strict-mode E2E flow," "TPSL slide 05 layout matches Figma."
2. **Surface test** — does it fit under an existing section in the doc? Default yes. New sections only when a genuinely new user-facing surface is introduced (rare). Sections are nouns the user can point at — never PR numbers, branch names, "redesign vN," or release names.
3. **Cap test** — are you about to add more than 3 items for this PR? If yes, you're probably restating launch verification or duplicating existing items. Cut down or skip.

If a change fails any test, the right answer is usually to skip the doc and put the verification in the PR description.

## Workflow

### Phase 1: Discover what changed

1. Read the diff. Try in order until one produces output:
   - `git diff --cached`
   - `git diff main...HEAD`
   - `git log -1 --format="%H" | xargs git diff HEAD~1`
2. Read changed files only as needed to understand user-visible impact.
3. Note the commit prefix (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`, `ci:`).
4. Summarize: which **user-facing surface** changed, and what's the user-visible impact?

If no user-visible change, report "No bug bash updates needed" and stop.

### Phase 2: Find the right home (fold-first)

1. List existing sections: `grep -nE "^### |^####" docs/BUG_BASH_GUIDE.md`.
2. For the surface(s) the PR touched, identify the ONE best existing section.
3. Skim items in that section to check if your concern is already covered by an existing item — if it is, you're done; no update needed.
4. Only consider a new section when the change introduces a user-facing surface that no existing section plausibly covers. New section creation is a last resort, not a default.

**Hard rules:**
- NEVER name a section after a PR, branch, sprint, redesign version, or release.
- NEVER create a section that mirrors an existing one (e.g. don't add "Profile Page Redesign" if "Forecaster Profile Page" already exists — fold).

### Phase 3: Generate updates (sparingly)

**`feat:` — New feature**

Add an item only when ALL three guardrail tests pass.

- Format: `- [ ] [Action] → [Expected result]`
- Items must describe an ongoing regression risk that's worth re-testing every release.
- Cap: 3 items per PR. Most PRs add 0–1 recurring items; many add zero.
- ❌ Bad: `- [ ] Hero section renders with new layout and copy` (one-shot launch check)
- ✅ Good: `- [ ] Home page has no horizontal scroll at 320/375/768/1024/1440px` (recurring layout regression risk)

**`fix:` — Bug fix**

1. Find the existing checklist item the bug violated. Annotate it: `- [!] FIXED (PR #XX) <existing description> → Fix: <brief>`.
2. If no existing item caught the bug, that's a checklist gap — add ONE recurring item that would have caught it. Don't add a one-off entry describing the specific bug; describe the broader behavior that should hold.
3. Proceed to Phase 4 to verify in the browser.

**`refactor:`, `test:`, `ci:`, `docs:`, `chore:`** — Default to "no update needed." Update only if there's a user-visible side effect.

### Phase 4: Verify in browser (fix commits only)

Applies to `fix:` commits that touched `[!] FIXED` items.

1. Read the deployment URL from the doc's "Test Environment" section. NEVER use localhost.
2. If no URL is listed, stop and ask the user.
3. Open the deployed build. Navigate to the affected surface. Confirm the bug is gone and the correct behavior renders.
4. Take a screenshot.

**Verified:**
- Convert `[!] FIXED (PR #XX) ...` to `[x] <description>` and **strip the `(PR #XX)` annotation**. Git blame is the audit trail; the doc shouldn't carry every PR reference forever.

**Not verified:**
- Leave as `[!] FIXED`, report what's still broken, hand back to the orchestrator.

**Cannot verify** (auth, deployment unavailable, blocked):
- Leave as `[!] FIXED`, note the blocker, ask the user to unblock — never silently skip.

### Phase 5: Hygiene pass (always run, fast)

Before finishing, scan the section(s) you touched for low-cost cleanup:

1. **Strip stale annotations.** Any `[x]` item still carrying `(PR #N)` whose PR has been in production for ≥1 release: strip the parenthetical. The item description should stand on its own.
2. **Spot duplicates.** If your edit revealed two items covering the same check, merge them. Keep the clearer wording.
3. **Spot one-shots.** If you notice a per-PR section ("PR #485 Strict-Mode E2E", "Section 17 — UI Redesign vN") in the same surface, fold its still-recurring items into the surface section and delete the rest. Do this only when it's adjacent to your edit — don't refactor the whole doc.

These are bounded, in-place tidies. They're not a full consolidation pass.

## Marking conventions

- `[ ]` — unverified
- `[!]` — bug found (description inline)
- `[!] FIXED` — fix applied, NOT yet verified in browser
- `[x]` — verified working in browser, with screenshot evidence

NEVER mark `[x]` from code review or test output. Only browser verification produces `[x]`.

## Verification rules (mandatory)

These apply to all bug-bash work, not just this skill:

1. **Test in the browser.** Verification happens via Claude in Chrome MCP tools (navigate, click, screenshot, read page). `forge test`, `cast`, `pnpm test`, and code review do NOT count. If the extension isn't connected, stop and tell the user.
2. **Test on a deployed build.** Read the URL from the doc's Test Environment section. NEVER use localhost.
3. **Act autonomously in the browser.** Click, navigate, scroll, screenshot without asking. Only purchases, personal data entry, and account creation need user approval.
4. **Ask to unblock, never skip.** When blocked (wallet, funds, auth, extension), tell the user exactly what's needed and wait. Never mark "cannot test" without confirmation.

## Items can be removed

The doc is not append-only. Delete an item when:
- It was a one-shot launch check that slipped in.
- It duplicates another item.
- The behavior it tests no longer exists.
- It was tied to a PR that's been in production for ≥1 release and the description still reads like archaeology.

The discipline is "items earn their place," not "items live forever."
