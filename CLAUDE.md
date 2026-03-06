# Tribal Picks: Survivor Fantasy

## Project Overview
iOS app (iPhone + iPad) for fantasy Survivor (CBS). Season 50 premieres Feb 25, 2026.

## Tech Stack
- **Framework**: React Native + Expo (SDK 54)
- **Router**: Expo Router (file-based routing in `src/app/`)
- **Backend**: Supabase (auth, PostgreSQL, real-time)
- **State**: Zustand stores in `src/stores/`
- **Monetization**: RevenueCat (subscriptions) + Google AdMob (ads)
- **Language**: TypeScript (strict mode)

## Game Types
1. **Elimination Bracket** (season-long) — predict boot order before premiere
2. **Cast Draft** (season-long) — snake draft castaways, earn points all season
3. **Weekly Pick'em** — pick who goes home + immunity winner each episode
4. **Survivor Pool** (NFL survivor style) — pick one castaway to survive each episode, can't reuse

## Architecture Rules (STRICT)
- `src/core/` → NEVER imports from `services/`, `app/`, `stores/`
- `src/core/` functions must be pure: inputs in → results out
- `src/services/` → Can import from `core/types.ts` only
- `src/stores/` → Can import from `core/` and `services/`
- `src/app/` → Can import from everything
- `src/components/` → Can import from `core/types.ts` and `stores/`

## File Locations
- Game logic (scoring, brackets) → `src/core/`
- Supabase client & queries → `src/services/supabase/`
- AdMob → `src/services/admob/`
- RevenueCat → `src/services/revcat/`
- Screens → `src/app/` (Expo Router)
- Shared components → `src/components/`
- State → `src/stores/`
- Types → `src/core/types.ts`

## Naming Conventions
- Screens: `[name].tsx` (Expo Router file-based)
- Components: `[Name].tsx` (PascalCase)
- Hooks: `use[Name].ts`
- Stores: `use[Name]Store.ts`

## Data Integrity (Zero Tolerance)
- NO HARDCODED DATA — never invent castaway names, scores, or episode results
- Fail loudly if Supabase data is missing
- Source of truth: Supabase database
- All scoring must live in `src/core/scoring.ts` (pure functions)

## Scoring Reference
See `src/core/types.ts` for exact point values per game type.

## EAS Build Rules (STRICT — each build costs $2)
- **ALWAYS bump `buildNumber` in `app.config.ts` BEFORE running `eas build`** if any code has changed since the last build
- **NEVER run `eas build` without confirming the build number is incremented** from the last submitted build
- **NEVER run `eas submit` without first verifying the build number is new** — Apple rejects duplicate build numbers
- **Batch all changes into ONE build** — do not build, discover a problem, then build again without collecting all fixes first

## Anti-Patterns
- **DON'T** hardcode castaway data — always fetch from Supabase
- **DON'T** put scoring logic in UI components — keep it in `src/core/scoring.ts`
- **DON'T** allow picks after lock time — enforce at both UI and DB (RLS) level
- **DON'T** import `services/` from `core/` — keep core pure

## Survivor Show Edge Cases
- **Double elimination**: Two tribals in one episode → both eliminations scored for that episode
- **Medevac/Quit**: Counts as elimination for scoring purposes
- **No tribal**: Recap/reunion episodes → no picks required
- **Idol play**: May change who goes home — score based on FINAL result
- **Fire-making (F4)**: Loser is eliminated, winner survives
- **Tribe swap/merge**: Castaway tribe field may update mid-season

## Commands
- `/start-session` — Load context and resume work
- `/end-session` — Save progress and create handoff
- `/push` — Commit and push with session update
- `/fix [bug]` — Autonomous bug fixing
- `/verify` — Run type check + build before committing
- `/review` — Generate review prompt for Claude Web
- `/elegant [target]` — Rewrite something cleanly
- `/interview [feature]` — Deep spec interview
- `/techdebt` — Scan for tech debt
- `/add-antipattern [pattern]` — Document mistake
- `/challenge` — Tough code review
