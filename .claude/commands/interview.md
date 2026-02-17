---
argument-hint: [feature or task to spec out]
description: Interview user in-depth to create a detailed spec before coding
allowed-tools: AskUserQuestion, Write
---

# Spec Interview Mode

Follow the user instructions and interview me in detail using the AskUserQuestion tool about literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc. but make sure the questions are not obvious. Be very in-depth and continue interviewing me continually until it's complete.

## Interview Topics to Cover
- **Core functionality:** What exactly should this do?
- **UI/UX:** How should it look? What interactions? What screens?
- **Data model:** What new tables/fields? How does it relate to existing data?
- **Scoring:** Does this affect point calculations? How?
- **Game mechanics:** How does this interact with CBS episode flow?
- **Edge cases:** What happens with idols, medevacs, quits, double tribals?
- **Error handling:** What could go wrong? How should we handle it?
- **Existing patterns:** How does this fit with our current architecture?
- **Survivor-specific:** Any show-specific rules that affect this feature?

## Project Context
This is Tribal Picks: Survivor Fantasy — a React Native + Expo iOS app for Survivor fantasy games.
- Supabase database for auth, data, real-time
- 4 game types: Bracket, Draft, Weekly Pick'em, Survivor Pool
- AdMob for ads, RevenueCat for subscriptions
- Follow patterns in CLAUDE.md

## After Interview
Once the interview is complete, write the spec to a file:
`specs/[feature-name].md`

Include:
1. **Summary** - One paragraph overview
2. **Requirements** - Bulleted list of what it must do
3. **Data Model** - Tables, fields, relationships (if applicable)
4. **Scoring Impact** - How it affects game scoring (if applicable)
5. **UI Components** - Screens, components needed
6. **Edge Cases** - How to handle each
7. **Implementation Order** - Suggested sequence of steps

<instructions>$ARGUMENTS</instructions>
