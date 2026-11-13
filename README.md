# Tribal Picks: Survivor Fantasy

A fantasy app for the TV show Survivor, for iPhone and iPad.

[Download on the App Store](https://apps.apple.com/us/app/tribal-picks-survivor-fantasy/id6759391126)

## What it does

- **Leagues.** Create a public or private league and invite friends with a code.
- **Elimination Bracket.** Before the premiere, rank the castaways in the order you think they will be voted out. After each episode you earn points for every castaway you correctly kept in the game, and the points grow each week. Picking the winner earns a 50-point bonus.
- **Survivor Pool.** Each week, pick one castaway who you think will survive the episode. You can't pick the same castaway twice. If your pick goes home, you're out. The last player standing wins.
- **Automatic scoring.** After each episode airs, a scheduled job reads the results, scores every league, and updates the standings. Push notifications remind players to make picks before they lock.

## Tech stack

- [Expo](https://expo.dev) (SDK 54) and React Native, written in TypeScript
- Expo Router for screens, Zustand for app state
- [Supabase](https://supabase.com) for sign-in, the Postgres database, row-level security, and an Edge Function that scores episodes

Game logic (scoring, pick locks, standings) is pure TypeScript in `src/core/`, kept separate from the UI and the database code. The database also enforces pick locks, so a late pick is rejected even if the app is bypassed.

## Built with Claude Code

I built this app with [Claude Code](https://claude.com/claude-code). `CLAUDE.md` holds the project rules it follows, and `.claude/` holds the custom commands and agents I use with it.

## How to run

You need Node.js 20.19 or later, and a Supabase project of your own.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up the database. In the Supabase SQL editor, run `supabase/schema.sql`, then `supabase/seed.sql`, then the files in `supabase/migrations/` in name order.
   - Known gap: some database functions (league-membership checks and the standings queries) went straight to the live project. They aren't in this repo yet, so a new database will be missing them.
3. Copy `.env.example` to `.env`. Fill in your Supabase project URL and anon key.
4. Start the app:
   ```bash
   npx expo start
   ```
   Open it in Expo Go, an iOS simulator, or a development build. Apple Sign-In and push notifications need a development build.

The scoring function lives in `supabase/functions/sync-results/`. You deploy it with the Supabase CLI. `BUILD_PROCESS.md` describes how builds go to TestFlight and the App Store.
