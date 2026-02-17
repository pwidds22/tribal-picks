---
description: Hand off to Claude Web for code review
---

# Hand Off for Review

## Pre-computed Context
Current branch:
!git branch --show-current

Changes to review:
!git diff --stat HEAD~1

Files changed:
!git diff --name-only HEAD~1

Recent commit:
!git log -1 --pretty=format:"%s%n%n%b"

## Instructions
Tell the user to copy this to Claude Web (claude.ai) for review:

---

**Review Request for Tribal Picks: Survivor Fantasy**

Branch: `[branch name from above]`
Commit: `[commit message from above]`

**Files changed:**
[list from above]

**Please review for:**
1. Any bugs or logic errors
2. Game scoring correctness (bracket points, draft points, survivor pool logic)
3. Missing error handling
4. Type safety issues
5. Violations of patterns in CLAUDE.md
6. Edge cases not handled (idols, medevacs, double eliminations, quits)
7. Anything that looks off

**Context:** Read `CLAUDE.md` for project conventions, `_SESSION.md` for what was being worked on.

---

After Claude Web reviews, incorporate any feedback before continuing.
