# Build & Release Process

## Overview

There are 3 stages to getting changes into the App Store. Each stage catches different problems.

```
Code Changes → Local Testing → TestFlight → App Store
   (free)        (free)         ($2 build)    (free submit)
```

---

## Stage 1: Local Testing (Free, Instant)

**When:** After every code change, before spending $2 on a build.

**How:** Run the app locally on your phone via Expo Go or a dev build.

```bash
npx expo start
```

Then scan the QR code with your phone. This lets you test:
- UI changes (layout, styling, new screens)
- Navigation flows
- Data loading from Supabase
- Pick submission and visibility logic

**Limitations:** Expo Go can't test Apple Sign-In or other native modules. For those, you need a development build (see below).

### Development Build (Optional, $2)

If you need to test native features (Apple Sign-In, push notifications):

```bash
eas build --platform ios --profile development
```

This installs a full native app on your phone via a direct download link. It's like having your own custom version of Expo Go that includes all your native modules.

**You only need to rebuild this when native dependencies change** (adding a new plugin to `app.config.ts`). For JS-only changes, just run `npx expo start` and it connects to the existing dev build.

---

## Stage 2: TestFlight ($2 per build)

**When:** Changes are tested locally and you're confident they work. Ready for a real-world test.

### Step 1: Bump version + build number

In `app.config.ts`:
- **Always** increment `version` (e.g., `1.0.4` → `1.0.5`) — Apple rejects duplicate versions
- **Always** increment `buildNumber` (e.g., `14` → `15`)

### Step 2: Commit all changes

```bash
git add -A
git commit -m "chore: bump to v1.0.5 build 15"
git push
```

EAS uploads your local files, but you want everything in git for history.

### Step 3: Build

```bash
eas build --platform ios --profile production
```

This takes ~10-15 minutes. EAS builds the binary in the cloud and uploads it to App Store Connect automatically.

### Step 4: Submit to TestFlight

```bash
eas submit --platform ios
```

This submits the build to App Store Connect. Apple processes it (usually 5-30 minutes), then it appears in TestFlight.

### Step 5: Test on TestFlight

Open TestFlight on your phone, install the new build, and verify:
- [ ] App loads without crashing
- [ ] Sign in works
- [ ] Navigate to Survivor Pool
- [ ] Check pick visibility (can you see last episode's picks?)
- [ ] Submit a pick for the current episode
- [ ] Check leaderboard / standings
- [ ] Profile page loads

---

## Stage 3: App Store Release (Free)

**When:** TestFlight build checks out, ready for real users.

Go to [App Store Connect](https://appstoreconnect.apple.com):
1. Select your app
2. Create a new version (or select the draft)
3. Select the build you tested on TestFlight
4. Fill in "What's New" notes
5. Submit for Review

Apple reviews typically take 24-48 hours. Once approved, you can release immediately or schedule it.

---

## Quick Reference

| Task | Command | Cost |
|------|---------|------|
| Local test | `npx expo start` | Free |
| Dev build (native testing) | `eas build --platform ios --profile development` | $2 |
| Production build | `eas build --platform ios --profile production` | $2 |
| Submit to TestFlight | `eas submit --platform ios` | Free |
| Submit to App Store | App Store Connect website | Free |

## Current Version Info

Check `app.config.ts` for current values:
- `version` — the user-facing version string (e.g., `1.0.4`)
- `ios.buildNumber` — Apple's internal build counter (e.g., `14`)

## Rules (from CLAUDE.md)

- **NEVER** run `eas build` without bumping BOTH version AND buildNumber
- **NEVER** run `eas submit` without verifying the version is new
- **ALWAYS** commit all changes before building
- **Batch fixes** into one build — don't build, find a problem, build again
