# Petdoku: daily pet region puzzle

**Play it:** https://petdoku101.web.app (also served at https://petdoku-101.web.app)

Mobile-first logic puzzle in the style of Meowdoku / Queens. Place one pet in every colour region:

- exactly **one pet per colour region**, **one per row** and **one per column**
- pets **can't touch**, not even diagonally
- tap once for a white ✕ note (tap again to remove it); **double-tap to place a pet**. A right pet stays, a wrong one becomes a red ✕. Both are final; Undo and Clear only remove white ✕ notes
- **Hint** shows the next single logical step on the board (cross out these squares, or the one square left for a pet) with an Apply button. It never guesses and never shows more than one pet. Crossing out around pets you already placed is free; other hints cost 75 points in Score Attack or 30 seconds in Time Attack, charged at most once per pet. `npm test` solves all 1,460 puzzles with hints alone to check every step is sound
- the back gesture/button steps back inside the app (game, sheet, tab) instead of leaving it
- you have **3 lives**: each wrong pet costs one, and losing all three ends that game for the day (no leaderboard entry; past days can be retried as practice)
- a seven-slide **how-to** opens on first launch: the three placement rules, three lives, tap controls, the two daily modes (Score Attack and Time Attack) and hints with their cost in each mode

Everyone gets the same board each day.

- **Two daily modes** with 365 fixed puzzles each (puzzle number = day of year, Dec 31 in leap years reuses 365):
  - **Score Attack**: three levels every day, **Easy 6×6**, **Moderate 8×8** and **Hard 10×10** (each has its own 365 boards). You can play all three; each is its own game with its own 3 lives, saved progress, result and leaderboard. Ranked by score: a board starts at 300 / 550 / 800 points, a fast solve adds up to 200, each wrong pet costs 50 and each hint 75.
  - **Time Attack**: 6×6 to 10×10 race. Ranked by time (+15 s per wrong pet, +30 s per hint).
- **Profiles** with unique usernames (claimed atomically in Firestore), an animal avatar, streaks and all-time points. Nine animals (cat, dog, rabbit, fox, panda, bear, pig, mouse, frog) are selectable as avatar and as the board piece.
- **Leaderboards** per day/mode plus all-time. Pick the day with the arrows, the swipeable day strip (recent days) or the date button, which opens a month calendar for any day back to 1 November 2026. Score Attack has a separate leaderboard for each level (the Easy, Moderate and Hard chips, next to Time Attack and All-time); each row shows the solve time and hearts left. Time Attack rows show hearts left and hints used. Results from before levels existed (one fixed-size board a day, up to 21 November 2026) are listed under the level closest to that day's size, marked "old 7×7 board" and so on.
- While a leaderboard is loading, pets hop across a lane above a progress bar (shown only if the scores take longer than 150 ms; static when the device asks for reduced motion).
- **Share**: every game shares its own result from its result sheet or out-of-lives sheet. The share icon on the Score Attack home card sends a summary of that day's three levels with the total; the one on the Time Attack card sends that result. The message is plain text with emoji: puzzle number and date, mode and board size, stars with score or time, solve time, hearts left, hints used (plus the time penalty in Time Attack), "Perfect run" for no wrong pets and no hints, and a link to the game.
- **Calendar** runs from 1 November 2026; past days are playable as unranked practice.
- Boards are generated in the browser from a seeded PRNG (`public/js/puzzle.js`) and every one has a unique solution. `npm test` verifies all 1,460 (365 × Easy, Moderate, Hard and Time Attack). They are pre-built into `public/puzzles.json` with `npm run build:puzzles`.

## Run locally

```powershell
npm run dev      # http://localhost:5173  (add ?demo to the URL to force offline mode with localStorage)
npm test         # verify all 365 x 4 puzzles, then solve each one with hints only
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

This publishes hosting, `firestore.rules` and indexes. `firebase.json` lists two hosting sites in the `petdoku-101` project (`petdoku101` and `petdoku-101`), so one deploy updates both URLs; for your own project, replace them with your site id. No composite indexes are needed.

## About the Firebase API key in this repo

`public/js/firebase-config.js` contains a Firebase **web API key** (`AIzaSy…`). That is intentional and **not a secret**: it only identifies the project, it is shipped inside the JavaScript of every Firebase web app, and anyone can already read it from the deployed site. GitHub secret scanning flags every Google API key, so an alert on this file is expected and is a false positive. Rotating the key or rewriting git history would not make it private.

What actually protects the data is `firestore.rules`. To harden the key itself, restrict it in Google Cloud Console (APIs & Services → Credentials → the Browser key):

- **Application restrictions:** Websites, allowing every hosting URL (here `petdoku101.web.app/*` and `petdoku-101.web.app/*`), `<project-id>.firebaseapp.com/*` and `localhost/*`.
- **API restrictions:** Identity Toolkit, Cloud Firestore and Token Service only.

Never commit real secrets (service-account JSON files, admin SDK keys, server-side API keys). Keep those in environment variables or a secret manager.

## Data model

| Path | Purpose |
| --- | --- |
| `usernames/{name}` | uniqueness registry (create-only) |
| `users/{uid}` | profile, streak, totalPoints |
| `days/{YYYY-MM-DD_level_easy\|level_moderate\|level_hard\|time}/entries/{uid}` | one create-only result per player per board; `sortKey` ascending = rank |

## Known limits

- Scores are computed client-side, so a determined player could submit a fake result. For competitive integrity, move result validation into a Cloud Function (verify the solve time/board server-side).
- Anonymous auth is tied to the browser. Clearing site data loses the account; add Google/email linking (`linkWithPopup`) if you need recovery.
- Daily puzzle follows each player's local date, so players in different timezones see the new puzzle at their own midnight.
