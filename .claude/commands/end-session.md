---
name: end-session
description: Save progress and create handoff notes for next session
---

# End Session

Create handoff notes so the next Claude session knows exactly where to continue.

## Steps

1. **Create/Update `_SESSION.md`** with this template:

```markdown
# Current Session State
**Updated:** [today's date]
**Branch:** [current git branch]

## Completed This Session
- [x] Task 1
- [x] Task 2

## In Progress
- [ ] Task 3 - stopped at [specific location]
  - File: path/to/file.ts
  - What's done: [description]
  - What's left: [description]

## Current State
| Area | Status |
|------|--------|
| Auth | Working / Not started |
| Bracket Game | Playable / In progress |
| Draft Game | Playable / In progress |
| Pick'em Game | Playable / In progress |
| Survivor Pool | Playable / In progress |

## Next Steps (for next session)
1. [Specific action - be detailed!]
2. [Specific action]

## Key Files Modified
- `path/to/file.ts` - [what changed]

## Blockers/Questions
- [Any decisions needed from user]
```

2. **Commit all work** - Even partial progress
   ```bash
   git add -A
   git commit -m "WIP: [brief description of state]"
   git push
   ```

3. **Tell the user:**
   > "Session context is getting low. I've updated `_SESSION.md` with handoff notes and committed. Next session can run `/start-session` to pick up where we left off."

## Critical Rules

- **Be specific** - Don't write "continue working on feature". Write "implement the scoring function in `core/scoring.ts` starting at line 45"
- **Include file paths** - Next Claude needs to know exactly where to look
- **Note decisions needed** - If blocked on a user decision, document it clearly
- **Always commit** - Never leave uncommitted work at session end
