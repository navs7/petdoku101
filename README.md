# Petdoku: daily pet region puzzle

Mobile-first logic puzzle in the style of Meowdoku / Queens. Place one pet in every colour region:

- exactly **one pet per colour region**, **one per row** and **one per column**
- pets **can't touch**, not even diagonally
- tap once for a white ✕ note (tap again to remove it); **double-tap to place a pet**. A right pet stays, a wrong one becomes a red ✕. Both are final; Undo and Clear only remove white ✕ notes
- **Hint** places a pet and shows a popup explaining the logic (a unit with one open tile, or the dead end each alternative leads to). `npm test` checks every explanation is sound
- the back gesture/button steps back inside the app (game, sheet, tab) instead of leaving it
- you have **3 lives**: each wrong pet costs one, and losing all three ends that game for the day (no leaderboard entry; past days can be retried as practice)

Everyone gets the same board each day.

- **Two modes**, each with 365 fixed levels (level = day of year, Dec 31 in leap years reuses 365):
  - **Daily Level**: difficulty cycles Cozy (6×6) to Fierce (10×10). Ranked by score (fewer slips/hints and a faster solve give more points).
  - **Time Attack**: 6×6 to 10×10 race. Ranked by time (+15 s per slip, +30 s per hint).
- **Profiles** with unique usernames (claimed atomically in Firestore), an animal avatar, streaks and all-time points. Nine animals (cat, dog, rabbit, fox, panda, bear, pig, mouse, frog) are selectable as avatar and as the board piece.
- **Leaderboards** per day/mode plus all-time. **Share** button produces a text summary.
- **Calendar** runs from 1 November 2026; past days are playable as unranked practice.
- Boards are generated in the browser from a seeded PRNG (`public/js/puzzle.js`) and every one has a unique solution. `npm test` verifies all 730.

## Run locally

```powershell
npm run dev      # http://localhost:5173  (add ?demo to the URL to force offline mode with localStorage)
npm test         # generate + verify all 365 x 2 puzzles
```

## Go online with Firebase

1. Create a project at https://console.firebase.google.com and add a **Web app**.
2. **Authentication → Sign-in method → enable Anonymous.**
3. **Firestore Database → create** (production mode).
4. Paste the web-app config into `public/js/firebase-config.js` and your project id into `.firebaserc`.
5. Deploy:

```powershell
npm i -g firebase-tools
firebase login
firebase deploy
```

This publishes hosting, `firestore.rules` and indexes. No composite indexes are needed.

## About the Firebase API key in this repo

`public/js/firebase-config.js` contains a Firebase **web API key** (`AIzaSy…`). That is intentional and **not a secret**: it only identifies the project, it is shipped inside the JavaScript of every Firebase web app, and anyone can already read it from the deployed site. GitHub secret scanning flags every Google API key, so an alert on this file is expected and is a false positive. Rotating the key or rewriting git history would not make it private.

What actually protects the data is `firestore.rules`. To harden the key itself, restrict it in Google Cloud Console (APIs & Services → Credentials → the Browser key):

- **Application restrictions:** Websites, allowing `<project-id>.web.app/*`, `<project-id>.firebaseapp.com/*` and `localhost/*`.
- **API restrictions:** Identity Toolkit, Cloud Firestore and Token Service only.

Never commit real secrets (service-account JSON files, admin SDK keys, server-side API keys). Keep those in environment variables or a secret manager.

## Data model

| Path | Purpose |
| --- | --- |
| `usernames/{name}` | uniqueness registry (create-only) |
| `users/{uid}` | profile, streak, totalPoints |
| `days/{YYYY-MM-DD_level\|time}/entries/{uid}` | one create-only result per player per board; `sortKey` ascending = rank |

## Known limits

- Scores are computed client-side, so a determined player could submit a fake result. For competitive integrity, move result validation into a Cloud Function (verify the solve time/board server-side).
- Anonymous auth is tied to the browser. Clearing site data loses the account; add Google/email linking (`linkWithPopup`) if you need recovery.
- Daily puzzle follows each player's local date, so players in different timezones see the new puzzle at their own midnight.
