---
name: start-session
description: Load project context and understand where we left off
---

# Start Session

Load all project context to understand current state and continue work.

## Steps

1. **Read `_SESSION.md`** - Shows exactly where last session left off
   - What was completed
   - What's in progress
   - Next steps to take
   - Any blockers or decisions needed

2. **Read `_HANDOFF.md`** - Full project context
   - App architecture
   - Game types and scoring rules
   - Current phase and progress

3. **Check git status** - See current branch and any uncommitted changes

4. **Summarize to user:**
   - Current state in 2-3 sentences
   - What the immediate next task should be
   - Any questions or decisions needed before proceeding

## Example Output

```
Session loaded. Here's where we are:

**Last session:** Implemented Elimination Bracket game type. Weekly Pick'em still needs scoring logic.

**Next up:** Build the scoring engine for Weekly Pick'em, then move to Survivor Pool.

**Decision needed:** Do you want to lock picks at episode air time or 30 minutes before?
```

## If `_SESSION.md` Doesn't Exist

This is a fresh start. Read `_HANDOFF.md` for project context and ask the user what they'd like to work on.
