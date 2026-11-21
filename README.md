# Petdoku: daily pet region puzzle

**Play it:** https://petdoku101.web.app (also served at https://petdoku-101.web.app)

Mobile-first logic puzzle in the style of Meowdoku / Queens. Place one pet in every colour region:

- exactly **one pet per colour region**, **one per row** and **one per column**
- pets **can't touch**, not even diagonally
- tap once for a white ✕ note (tap again to remove it); **double-tap to place a pet**. A right pet stays, a wrong one becomes a red ✕. Both are final; Undo and Clear only remove white ✕ notes
- **Hint** shows the next single logical step on the board (cross out these squares, or the one square left for a pet) with an Apply button. It never guesses and never shows more than one pet. On Easy, Moderate and 8×8 Time Attack boards the hints stick to steps you can see on the board (from 22 November 2026; older boards may still need a look-ahead step). Crossing out around pets you already placed is free; other hints cost 75 points in Score Attack or 30 seconds in Time Attack, charged at most once per pet. `npm test` solves all 1,460 puzzles with hints alone to check every step is sound
- the back gesture/button steps back inside the app (game, sheet, tab) instead of leaving it
- you have **3 lives**: each wrong pet costs one, and losing all three ends that game for the day (no leaderboard entry; past days can be retried as practice)
- a seven-slide **how-to** opens on first launch: the three placement rules, three lives, tap controls, the two daily modes (Score Attack and Time Attack) and hints with their cost in each mode

Everyone gets the same board each day.

- **Two daily modes** with 365 fixed puzzles each (puzzle number = day of year, Dec 31 in leap years reuses 365):
  - **Score Attack**: three levels every day, **Easy 6×6**, **Moderate 8×8** and **Hard 10×10** (each has its own 365 boards). You can play all three; each is its own game with its own 3 lives, saved progress, result and leaderboard. Ranked by score: a board starts at 300 / 550 / 800 points, a fast solve adds up to 200, each wrong pet costs 50 and each hint 75.
  - **Time Attack**: one race a day on an 8×8 or a 10×10 board, picked at random for each day (the same board for everyone). Ranked by time (+15 s per wrong pet, +30 s per hint).
- **Profiles** with unique usernames (claimed atomically in Firestore), an animal avatar, streaks and all-time points. Nine animals (cat, dog, rabbit, fox, panda, bear, pig, mouse, frog) are selectable as avatar and as the board piece.
- **Leaderboards** per day/mode plus all-time. Pick the day with the arrows, the swipeable day strip (recent days) or the date button, which opens a month calendar for any day back to 1 November 2026. Score Attack has a separate leaderboard for each level (the Easy, Moderate and Hard chips, next to Time Attack and All-time); each row shows the solve time and hearts left. Time Attack rows show hearts left and hints used. Results from before levels existed (one fixed-size board a day, up to 21 November 2026) are listed under the level closest to that day's size, marked "old 7×7 board" and so on.
- While a leaderboard is loading, pets hop across a lane above a progress bar (shown only if the scores take longer than 150 ms; static when the device asks for reduced motion).
- **Share**: tapping share copies the message to the clipboard straight away and opens a sheet showing it, with **Share via…** (the device share menu, where the browser has one) and **Copy message**. Every game shares its own result from its result sheet or out-of-lives sheet. The share icon on the Score Attack home card sends a summary of that day's three levels with the total; the one on the Time Attack card sends that result. The message is plain text with emoji: puzzle number and date, mode and board size, stars with score or time, solve time, hearts left, hints used (plus the time penalty in Time Attack), "Perfect run" for no wrong pets and no hints, and a link to the game.
- **Calendar** runs from 1 November 2026; past days are playable as unranked practice.
- Boards come from a seeded generator (`public/js/puzzle.js`) and every one has a unique solution. They are pre-built into `public/puzzles.json` with `npm run build:puzzles`, and `npm test` verifies all of them (365 × Easy, Moderate, Hard and Time Attack, plus the 83 older boards kept for 1 to 21 November 2026).
- **Levels differ by the reasoning they need, not only by size.** `public/js/grade.js` solves each candidate board and the generator keeps trying seeds until a board fits its level:
  - **Easy** and **Moderate** can be solved by eye: every step is something you can see on the board, never "what would happen if a pet went here". The visible steps are (1) a colour, row or column with one square left, so the pet goes there; (2) a colour whose open squares all sit in one row or column, so the rest of that line is out; (3) a row or column whose open squares are all one colour, so the rest of that colour is out.
  - **Easy**: steps 1 and 2 only, with at most two of step 2 and at most one of them before the first pet. About half the Easy boards are a chain of step 1 alone.
  - **Moderate**: steps 1 to 3, needing three to eight of steps 2 and 3.
  - **Hard**: needs look-ahead and two or three colours locked into as many rows or columns.
  - Grading started on 21 November 2026 and the by-eye rule for Easy and Moderate on 22 November; earlier days keep the boards they were played on.
  - No level uses a board the hint engine cannot finish by logic alone.
  - **Time Attack** uses the same bands: its 8×8 boards are graded as Moderate (solvable by eye) and its 10×10 boards as Hard. Before 21 November 2026 its size cycled from 6×6 to 10×10 and was not graded; those days keep their boards.

## Run locally

```powershell
npm run dev      # http://localhost:5173  (add ?demo to the URL to force offline mode with localStorage)
npm test         # verify every stored puzzle (unique, matches the generator, fits its level), then solve each one with hints only
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

## Security

Players sign in anonymously, so anyone can talk to Firestore directly with their own sign-in. Two layers deal with that:

- **`firestore.rules`** (checked by `npm run test:rules`, 51 cases against the Firestore emulator):
  - usernames are 3–16 characters of `a–z`, `0–9`, `_`; one per account, claimed together with the profile, never changed or freed
  - a profile starts at zero and can only change its avatar, or its stats together with a new result (exactly that result's score, one more solve, streak up by at most one)
  - a result is create-only, only known fields with number types, only for the server's date give or take a day, and its score, adjusted time and rank key must be values the scoring formula can produce
- **The app** rebuilds every record it reads for display from known, typed fields (`cleanEntry`, `cleanUser` in `backend.js`), so stored data can never reach the page as markup.
- **App Check** (reCAPTCHA Enterprise) is enforced for Cloud Firestore, so only requests coming from the hosted sites are accepted; a direct call to the Firestore API without an App Check token gets 403. `startAppCheck` in `backend.js` starts it before Auth and Firestore, using the public site key in `public/js/firebase-config.js` (`appCheck`).

```powershell
npm run test:rules   # needs Java 17+; downloads the Firestore emulator on first run
```

### App Check setup (for your own project)

1. Google Cloud console → reCAPTCHA: create a **Website**, score-based key for your hosting domains (here `petdoku101.web.app`, `petdoku-101.web.app`, `petdoku-101.firebaseapp.com`).
2. Firebase console → App Check → Apps: register the web app with **reCAPTCHA Enterprise** and that key.
3. Put the key in `appCheck.siteKey` in `public/js/firebase-config.js` and deploy.
4. When App Check → APIs shows verified Firestore requests, click **Enforce** for Cloud Firestore. Enforcing before the deployed app sends tokens locks every player out.

Local development against real Firebase (`npm run dev` without `?demo`) needs a debug token: the app turns on debug mode on localhost, the browser console prints a token, and you add it under App Check → Apps → Manage debug tokens. `?demo` mode needs nothing. Adding a new hosting domain means adding it to the reCAPTCHA key as well.

## Known limits

- Scores are computed client-side and the solutions ship with the app, so a determined player can still submit a fake result, as long as it is one the formula could produce (for example a very fast clean solve). For competitive integrity, move result validation into a Cloud Function.
- App Check is enforced for Cloud Firestore only. Scripts can still create empty anonymous accounts (they cannot read or write data); enforcing App Check on Authentication as well needs the Identity Platform upgrade.
- Anonymous auth is tied to the browser. Clearing site data loses the account; add Google/email linking (`linkWithPopup`) if you need recovery.
- Daily puzzle follows each player's local date, so players in different timezones see the new puzzle at their own midnight.
