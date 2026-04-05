# Tribal Picks: Survivor Fantasy

## Project Overview
iOS app (iPhone + iPad) for fantasy Survivor (CBS). Season 50 premiered Feb 25, 2026 — currently airing (6 episodes aired, 14 castaways remaining).

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
- **ALWAYS bump BOTH `version` AND `buildNumber` in `app.config.ts` BEFORE running `eas build`** when submitting new changes to Apple
- **Apple rejects same `version` string** — once a version (e.g. `1.0.1`) has been submitted to App Store Connect, you CANNOT submit another build under that version. You MUST increment `version` (e.g. `1.0.1` → `1.0.2`)
- **NEVER run `eas build` without confirming BOTH version and build number are incremented** from the last submitted build
- **NEVER run `eas submit` without first verifying the version is new** — Apple rejects duplicate versions
- **Batch all changes into ONE build** — do not build, discover a problem, then build again without collecting all fixes first
- **NEVER forget to commit all code changes BEFORE running `eas build`** — EAS uploads local files but uncommitted changes won't be in git history

## Auth Persistence (IMPORTANT)
Supabase auth in React Native requires three things to persist sessions across app restarts:
1. **Eager `startAutoRefresh()`** in `client.ts` — call immediately on module load, not just on AppState changes (cold starts don't fire AppState 'active')
2. **Session validation on `INITIAL_SESSION`** — the restored token may be expired; call `getSession()` with a timeout to force server-side refresh before trusting it
3. **Timeouts on all Supabase calls** — prevent infinite hangs from stale tokens; `signOut` must clear local state regardless of server response

## Anti-Patterns
- **DON'T** hardcode castaway data — always fetch from Supabase
- **DON'T** put scoring logic in UI components — keep it in `src/core/scoring.ts`
- **DON'T** allow picks after lock time — enforce at both UI and DB (RLS) level
- **DON'T** import `services/` from `core/` — keep core pure
- **DON'T** bump only `buildNumber` without also bumping `version` — Apple rejects resubmissions of the same version string (cost us a wasted $2 build)
- **DON'T** remove `startAutoRefresh()` from `client.ts` module scope — this is critical for auth persistence on cold starts
- **DON'T** trust `INITIAL_SESSION` tokens without server validation — they can be expired, causing zombie auth state (user appears logged in but all queries hang)

## Survivor Show Edge Cases
- **Double/Triple elimination**: Multiple tribals in one episode → all eliminations scored for that episode (ep 1, 5, 6 had multiples in S50)
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
