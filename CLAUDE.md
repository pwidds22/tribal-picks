# Tribal Picks: Survivor Fantasy

## Project Overview
iOS app (iPhone + iPad) for fantasy Survivor (CBS). Season 51 premiered Sep 23, 2026 (21 castaways, tribes Savu/Toka, 13 episodes, finale projected Dec 16). Season 50 is complete — its leagues remain as "past season" leagues.

## Multi-Season Rules (STRICT)
- A league belongs to ONE season: `leagues.season_id`. League screens (pool, bracket, user-picks) must load the season/castaways/episodes via `league.season_id` — NEVER `getActiveSeason()`.
- The active season (`seasons.is_active`, exactly one row) only decides where NEW leagues go and what Home/Picks treat as "current". Flip seasons in ONE statement: `update seasons set is_active = (number = N)`.
- New season checklist: seed castaways + name_aliases (full, first, wiki short name) + ALL episodes up front (sync-results detects the finale as max episode number), then flip is_active. Eps with unknown air dates must still get a projected date — pool locks key off `air_date`.
- DB triggers enforce locks/season validity on picks; keep client and DB lock rules identical (8 PM America/New_York on air date).

## Tech Stack
- **Framework**: React Native + Expo (SDK 54)
- **Router**: Expo Router (file-based routing in `src/app/`)
- **Backend**: Supabase (auth, PostgreSQL, real-time)
- **State**: Zustand stores in `src/stores/`
- **Monetization**: NOT implemented (planned: RevenueCat + AdMob — no packages, no code as of v1.0.16)
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
Core principle: **never block the UI on a token refresh.** supabase-js's `getSession()`
refreshes an expired token on demand (deduped across callers) before any query goes
out, so queries can never use a stale token — they just wait exactly one refresh
round trip in the worst case.

### Layer 1 — Zustand persist (cached data)
- `useAuthStore` and `useLeagueStore` use `persist` middleware to save state to AsyncStorage
- `onRehydrateStorage` sets `isLoading: false` when cached user exists, so screens render instantly

### Layer 2 — authReady gate (server calls)
- `authReady: boolean` in `useAuthStore` — flips `true` synchronously on `INITIAL_SESSION` (no awaited refresh)
- Screens that fetch guard with `if (!authReady) return` AND must re-run when it flips:
  subscribe reactively (`useAuthStore((s) => s.authReady)`) and put it in effect deps —
  never read it via `getState()` inside a focus effect
- NOT persisted — must start `false` on every cold start

### Hard rules (each one was a production bug)
1. **The `onAuthStateChange` callback must be synchronous** — auth-js awaits every
   subscriber, so awaited network inside the callback stalls its whole event pipeline.
   Refresh + profile fetches run as fire-and-forget background tasks.
2. **Bounded global fetch** — `client.ts` passes a 15s aborting fetch via `global.fetch`.
   Without it, iOS lets a stalled refresh socket hang 60+s and ALL queries (even public
   data) queue behind it via `initializePromise`/the internal auth lock.
3. **Never force `refreshSession()` on app resume or cold start** — the auto-refresh
   ticker + on-demand refresh in `getSession()` already handle it; a forced refresh
   just holds the auth lock that every query needs.
4. **Sign out ONLY on definitive auth errors** (`isTransientAuthError()` false, e.g.
   revoked refresh token). Network failures/timeouts must never sign the user out or
   wipe the cache.
5. **Empty-result guard** — if a fetch returns empty while the cache is non-empty,
   verify a session exists before accepting it (failed refresh → anon-key fallback →
   RLS returns zero rows, not an error). See `fetchLeagues`.
6. **Eager `startAutoRefresh()`** in `client.ts` module scope, plus store-level
   `Promise.race` timeouts as defense; `signOut` must clear local state regardless

## Anti-Patterns
- **DON'T** hardcode castaway data — always fetch from Supabase
- **DON'T** put scoring logic in UI components — keep it in `src/core/scoring.ts`
- **DON'T** allow picks after lock time — enforce at both UI and DB (RLS) level
- **DON'T** import `services/` from `core/` — keep core pure
- **DON'T** bump only `buildNumber` without also bumping `version` — Apple rejects resubmissions of the same version string (cost us a wasted $2 build)
- **DON'T** await Supabase calls inside the `onAuthStateChange` callback — auth-js awaits every subscriber, so this stalls its event pipeline (and can serialize behind the auth lock)
- **DON'T** block UI/data on a token refresh (`await refreshSession()` before setting `authReady`, forced refresh on resume) — `getSession()` self-heals expired tokens on demand; blocking turned one stalled refresh into 1-2 min of empty screens
- **DON'T** sign the user out on transient auth errors (timeouts, offline) — only definitive rejections (revoked/used refresh token); check `isTransientAuthError()`
- **DON'T** accept an empty query result over a non-empty cache without confirming a session exists — failed refresh → anon-key fallback → RLS returns empty rows, not errors
- **DON'T** read `authReady` via `getState()` inside effects — subscribe reactively and include it in deps, or the screen won't fetch when it flips (forces user to "click around" to load)
- **DON'T** remove `startAutoRefresh()` from `client.ts` module scope — this is critical for auth persistence on cold starts
- **DON'T** remove the bounded `global.fetch` wrapper in `client.ts` — without it a stalled iOS socket hangs 60+s and every query in the app queues behind it
- **DON'T** use the active season inside a league screen — pool/bracket did this and would have shown S51 castaways inside every S50 league
- **DON'T** write SQL that reads `episodes` without a season filter — `get_survivor_pool_standings` did, and scoring S51 ep 1 would have eliminated every S50 pool player
- **DON'T** leave `seasons.winner_id` null at the finale — S50's +50 Sole Survivor bonus was never awarded because of it (sync-results now sets it from the wiki)
- **DON'T** edit the deployed edge function in the dashboard — source of truth is `supabase/functions/sync-results/index.ts`

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
