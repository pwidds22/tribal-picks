---
description: Find and report technical debt, duplicated code, and cleanup opportunities
---

# Technical Debt Audit

Use subagents to thoroughly scan the codebase for technical debt.

## What to Find

### 1. Duplicated Code
- Similar function implementations across files
- Copy-pasted logic that should be extracted to utils
- Repeated patterns that could be DRYed up

### 2. Type Issues
- Any usage of `any` type
- Missing return types on functions
- Inconsistent type definitions (duplicates in core/types.ts)

### 3. Anti-Pattern Violations
Check against CLAUDE.md anti-patterns:
- **Wrong imports** - `core/` importing from `services/`, `app/`, or `stores/`
- **Impure core functions** - Side effects in `core/`
- **Hardcoded data** - Castaway names, episode numbers, scores

### 4. Cleanup Opportunities
- Unused imports
- Dead code / commented out code
- TODOs that should be addressed
- Console.log statements that should be removed

### 5. Game Logic Concerns
- Scoring edge cases not handled (double eliminations, medevacs)
- Missing pick lock enforcement
- Draft order issues

## Output Format

```markdown
# Tech Debt Report - [Date]

## Critical (Fix Now)
- [ ] Issue description - `file:line`

## High Priority (Fix Soon)
- [ ] Issue description - `file:line`

## Medium Priority (Fix When Convenient)
- [ ] Issue description - `file:line`

## Low Priority (Nice to Have)
- [ ] Issue description - `file:line`
```

## Instructions

Use multiple subagents in parallel to scan different parts of the codebase:
1. One for `src/core/` (game logic)
2. One for `src/services/` (Supabase, AdMob, RevCat)
3. One for `src/app/` and `src/components/` (UI and routes)

Report findings but DO NOT fix anything automatically - just report for human review.
