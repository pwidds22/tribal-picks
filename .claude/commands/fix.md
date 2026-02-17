---
argument-hint: [bug description, error message, or paste from logs]
description: Autonomous bug fixing - just describe the bug and let Claude fix it
---

# Autonomous Bug Fix Mode

You've been given a bug to fix. Work autonomously to:

1. **Understand the bug** - Parse the error message, stack trace, or description
2. **Locate the source** - Use search/grep to find relevant code
3. **Identify root cause** - Read the code and understand what's wrong
4. **Implement the fix** - Make minimal, targeted changes
5. **Verify the fix** - Run TypeScript check, build if possible

## Rules

- **Don't ask questions** - Figure it out from context
- **Don't over-engineer** - Fix the bug, nothing more
- **Don't refactor** - Only change what's necessary for the fix
- **Do explain** - After fixing, briefly explain what was wrong and why

## Context

This is a React Native + Expo fantasy Survivor app:
- Game logic in `src/core/` (scoring, brackets, types)
- Supabase client in `src/services/supabase/`
- Screens in `src/app/` (Expo Router)
- State in `src/stores/` (Zustand)
- Check CLAUDE.md for patterns and anti-patterns

## Common Bug Categories

### Game Logic Issues
- Look in `src/core/` for scoring/bracket logic
- Check for off-by-one in elimination order
- Verify edge cases: idols, medevacs, quits, double eliminations

### Supabase Issues
- Check database queries and RLS policies
- Verify column names (snake_case in DB)
- Check for missing league/user IDs

### Navigation Issues
- Check Expo Router file-based routes in `src/app/`
- Verify deep links and params

### Type Errors
- Check `src/core/types.ts` for type definitions
- Ensure database columns match type fields

### UI Issues
- Check for missing loading states
- Verify data exists before rendering
- Look for race conditions in useEffect

## Bug Description
<bug>$ARGUMENTS</bug>

## After Fixing

1. Run `npx tsc --noEmit` to verify no type errors
2. Run `npx expo export --platform ios` to check build
3. Summarize what was fixed and why
4. If this reveals a pattern that could cause other bugs, mention it
