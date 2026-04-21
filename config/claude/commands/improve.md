---
description: Rewrite a vague prompt for clarity, then execute it
argument-hint: "[your rough prompt]"
---

The user submitted this rough prompt:

"$ARGUMENTS"

**Step 1 — Rewrite.** Rewrite the prompt to be specific, actionable, and unambiguous. Surface hidden assumptions, add missing constraints, and clarify the expected output format. Show the rewritten version in a fenced block labeled `improved prompt`.

**Step 2 — Execute.** Proceed to answer the rewritten version. If the rewrite meaningfully changed the intent of the original, pause after Step 1 and ask the user to confirm before executing; otherwise continue straight through.
