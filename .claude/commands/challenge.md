---
description: Tough code review - ask hard questions about edge cases and correctness
---

# Challenge Mode

## Pre-computed Context
Recent changes:
!git diff HEAD~1

Changed files:
!git diff --name-only HEAD~1

## Instructions

Be a tough but fair code reviewer. Ask hard questions about:

### Game Logic
- What happens if there's a double elimination in one episode?
- What if a castaway is medevac'd vs quit vs voted out — do they score differently?
- What happens in Survivor Pool if ALL remaining players pick the eliminated castaway?
- What if someone doesn't submit picks before lock time?
- Is the bracket scoring correct for ties?

### Data Integrity
- What if Supabase returns null or empty data?
- What if a castaway's tribe changes (swap/merge)?
- What if an episode has no immunity challenge (recap episode)?

### Concurrency
- What if two users submit picks at the same time?
- What if the draft order is violated?
- What happens if the app crashes mid-draft?

### Security
- Can users modify their picks after lock time via API?
- Are Supabase RLS policies preventing unauthorized access?
- Can a user join a league twice?

### Edge Cases
- First episode (no prior data)
- Finale episode (multiple eliminations + winner)
- Reunion/recap episodes (no gameplay)

## Rules
- Ask specific, pointed questions about the actual code
- Don't accept hand-waving — demand specific answers
- If the code doesn't handle a case, flag it
- Suggest fixes for every issue found
