---
name: app-architecture
description: Architecture rules and dependency constraints for Tribal Picks
---

# Tribal Picks: Survivor Fantasy - Architecture

## Dependency Rules (STRICT)
- `src/core/` → NEVER imports from `services/`, `app/`, `stores/`
- `src/core/` functions must be pure: inputs in → results out
- `src/services/` → Can import from `core/types.ts` only
- `src/stores/` → Can import from `core/` and `services/`
- `src/app/` → Can import from everything
- `src/components/` → Can import from `core/types.ts` and `stores/`

## File Locations
- Game logic (scoring, brackets, pool) → `src/core/`
- Supabase client & queries → `src/services/supabase/`
- AdMob integration → `src/services/admob/`
- RevenueCat integration → `src/services/revcat/`
- Screens → `src/app/` (Expo Router file-based)
- Shared UI components → `src/components/`
- State management → `src/stores/` (Zustand)
- Type definitions → `src/core/types.ts`

## Naming Conventions
- Screens: `[name].tsx` (Expo Router file-based routing)
- Components: `[Name].tsx` (PascalCase)
- Hooks: `use[Name].ts` (camelCase with use prefix)
- Stores: `use[Name]Store.ts`
- Utils: `[name].ts` (camelCase)
- Types: defined in `src/core/types.ts`

## Data Integrity (Zero Tolerance)
- NO HARDCODED DATA - Never invent castaway names, scores, or episode results
- Fail loudly if Supabase data missing
- Source of truth: Supabase database
- All game scoring must be in `src/core/scoring.ts` (pure functions)

## Navigation Structure
- Tab-based with 4 tabs: Home, Leagues, Picks, Profile
- League detail is a stack screen pushed from Leagues tab
- Game screens are stack screens pushed from league detail
- Castaway profiles are modal screens
