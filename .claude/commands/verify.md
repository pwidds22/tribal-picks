---
description: Run all checks before committing
---

# Verify Changes

## Pre-computed Context
Changed files:
!git diff --name-only HEAD

TypeScript files changed:
!git diff --name-only HEAD | grep -E "\\.tsx?$" || echo "No TS files changed"

## Instructions
1. Run type check: `npx tsc --noEmit`
2. Run build: `npx expo export --platform ios`
3. If there are errors, fix them before proceeding
4. Report: all checks passed or list what failed

## Verification Checklist
- [ ] TypeScript compiles without errors
- [ ] Expo build completes without errors
- [ ] No type errors in changed files
- [ ] Changed features work as expected (manual test)
