# AGENTS.md — working notes for Petdoku

Reference for anyone (human or AI agent) picking this project up. The README describes the game for players
and deployers; this file describes how the code is put together and what to watch out for when changing it.

## What it is

Petdoku is a mobile-first daily region puzzle ("queens" style). Place one pet in every colour region, row
and column; pets may not touch, even diagonally. Every board has exactly one solution.

- Live: https://petdoku101.web.app and https://petdoku-101.web.app (two hosting sites, one Firebase project `petdoku-101`)
- Repo: https://github.com/navs7/petdoku101 (branch `main`)
- Stack: vanilla JS ES modules, plain CSS, no build step, no framework, no dependencies. Firebase Hosting,
  Anonymous Auth and Firestore (modular SDK loaded from the CDN).

## Commands

```powershell
npm run dev            # static server on http://localhost:5173 (add ?demo to use the offline localStorage backend)
npm test               # verify-puzzles (about 5 minutes) then verify-hints (seconds)
npm run test:rules     # firestore.rules against the emulator (Java 17+, uses firebase-tools@13 via npx)
npm run build:puzzles  # regenerate public/puzzles.json (several minutes; only when seeds or sizes change)
firebase deploy --project petdoku-101 --only hosting                   # both sites
firebase deploy --project petdoku-101 --only hosting,firestore:rules   # when firestore.rules changed
```

Deploy rules together with hosting whenever leaderboard ids or entry fields change, otherwise new
results are rejected by the old rules.

## Files

| File | Role |
|---|---|
| `public/index.html` | Shell page; loads `js/app.js` |
| `public/js/app.js` | All UI and game logic: screens, board, taps, hints UI, results, share, leaderboard, how-to |
| `public/js/puzzle.js` | Seeded generator, solver, daily schedule (`levelFor`), level configs (`DIFFS`, `configFor`), scoring (`scoreFor`) |
| `public/js/hints.js` | Pure hint engine (`nextHint`, `applyHint`); no DOM so scripts can test it |
| `public/js/backend.js` | Two backends with one interface: local demo (localStorage) and Firebase |
| `public/js/pets.js` | SVG sprite for the nine animals |
| `public/js/firebase-config.js` | Public web config (the API key is public by design; `firestore.rules` protects the data) |
| `public/css/app.css` | All styles; colour tokens on `:root`, dark mode via `prefers-color-scheme` |
| `public/puzzles.json` | Pre-built boards: `easy`, `moderate`, `hard`, `time`, 365 each (`BANK_SETS`) |
| `scripts/build-puzzles.js` | Writes `puzzles.json` |
| `scripts/verify-puzzles.js` | Checks every stored board: size, unique solution, matches the seeded generator |
| `scripts/verify-hints.js` | Solves every board using hints only; fails on any unsound step |
| `scripts/verify-rules.js` | Allowed/denied cases for `firestore.rules`, run inside the Firestore emulator |
| `firestore.rules` | Username registry, profiles, create-only daily results |
| `firebase.json` | `hosting` is an array (one entry per site); JS/CSS are served `no-cache` |

## Game model

- **Puzzle number** = day of year (1–365; 31 Dec in a leap year reuses 365). `levelFor(dateKey)`.
- **Games per day** (each is separate: own saved state, own 3 lives, own result, own leaderboard):
  - Score Attack `easy` 6×6, `moderate` 8×8, `hard` 10×10 — ranked by score
  - Time Attack — one board, size 6–10 by day — ranked by adjusted time
- In code, `mode` is `'level'` (Score Attack) or `'time'`; Score Attack also carries `diff`
  (`easy|moderate|hard`). `slot(mode, diff)` gives the storage/leaderboard name: `level_easy`,
  `level_moderate`, `level_hard`, `time`.
- **Cell values**: `0` empty, `1` white ✕ note, `2` correct pet (locked), `3` wrong pet shown as red ✕ (locked, cost a life).
  A placed pet is judged against the unique solution, never against rule conflicts.
- **Input**: single tap toggles a white ✕; a second tap on the same tile within 350 ms places a pet.
  Undo and Clear only touch white ✕ notes.
- **Lives**: 3 per game. Third wrong pet ends that game for the day (ranked days only; past days are practice and can be retried).
- **Scoring** (`scoreFor`): Score Attack = base (300/550/800) + speed bonus up to 200 − 50 per wrong pet − 75 per hint, minimum 50.
  Time Attack = solve time + 15 s per wrong pet + 30 s per hint. Stars: Score Attack by wrong pets + hints (0 → 3, 1–2 → 2, else 1);
  Time Attack by adjusted time (under 1:30 → 3, under 4:00 → 2, else 1).
- **Hints** (`hints.js`): one logical step at a time — `cross` (free), `single`, `confine`, `block`, rare `reveal`.
  A hint never shows more than one pet and never guesses. Charged at most once per pet.

## Screens (all in `app.js`)

- **Home** (`home`): Score Attack card (progress "N of 3 solved", day's total points) opens the level list
  (`pickLevel`); Time Attack card opens its game. `open(mode, date, diff)` routes to the result sheet,
  the out-of-lives sheet or the board.
- **Leaderboard** (`ranks`): one row of filter chips (`.filt`, `data-f`): Easy, Moderate, Hard, Time, All-time.
  The three level chips set `S.rank.tab = 'level'` plus `S.rank.diff`. Date is chosen with arrows, a
  swipeable day strip (up to 60 days) or the date button, which opens a month calendar (`pickDate`).
  Lists come from `boardFor(date, mode, diff)`. Score Attack rows show solve time and hearts left;
  Time Attack rows show hearts left and hints.
- **Loading state** (`runner()`): pets hopping across a lane above an indeterminate bar. `load()` shows it
  only if the fetch takes longer than 150 ms, and a token guards against stale responses. Static under
  `prefers-reduced-motion`.
- **Result sheet** (`resultSheet`): stars with a one-line explanation (`starNote`), hearts, three facts
  (score or final time, solve time, hints used), rank, Share, See leaderboard, Other levels (Score Attack), Done.
- **Share** (`shareText(date, mode, diff)`): one game per message. Score Attack without a `diff` (the home
  card's share icon) produces a summary of the day's three levels with a total.
- **How-to** (`HOW` slides): seven slides; update the "Two puzzles every day" and hint slides when modes or costs change.

## Storage

localStorage (per browser):

| Key | Content |
|---|---|
| `purr:hist:<uid>` | `{ [date]: { level_easy, level_moderate, level_hard, time } }` result records |
| `purr:g2:<uid>:<slot>:<date>` | saved in-progress game |
| `purr:lost:<uid>:<slot>:<date>` | out-of-lives marker (ranked games only) |
| `purr:settings`, `purr:seenHowTo` | preferences |
| `purr:users`, `purr:me`, `purr:entries:<dayId>` | demo backend only |

Firestore: `usernames/{name}`, `users/{uid}`, `days/{YYYY-MM-DD_<slot>}/entries/{uid}` (create-only; `sortKey` ascending = rank).

**Legacy data.** Until 21 November 2026 Score Attack was a single fixed-size board per day, stored under plain
`level` (hist key, lost key, and `days/{date}_level`). `recOf`, `lostOf`, `boardFor` and `lvlCfg` in `app.js`
fold those into the nearest new level (`legacyDiff`) and label them with their old size. Records without a
`diff` field are legacy. Do not remove this without deciding what happens to those results.

## Security model

Sign-in is anonymous, so treat every Firestore document written by another player as hostile input.

- **Never put a remote field into `innerHTML` raw.** `backend.js` returns leaderboard rows through `cleanEntry` /
  `cleanUser`, which rebuild each record from known fields with known types and ranges. A new field must be
  added there (and to the rules) before it is displayed. `pet()` also ignores anything that is not a valid animal index.
- **`firestore.rules` mirrors the app's payloads exactly** (`keys().hasOnly`, types, ranges, the score formula).
  If you change what `checkWin` submits, what `createProfile` writes, or `scoreFor`, change the rules and
  `scripts/verify-rules.js` in the same commit, run `npm run test:rules`, and deploy rules with hosting.
- Profile stats only change in a batch with a new result; the profile's `lastGame` field names that result so the rules can check it.
- Not solved: scores are client-computed and solutions ship in `puzzles.json`, so a plausible fake result is
  still possible; there is no App Check.

## Conventions

- User-facing words: **Score Attack**, **Time Attack**, **level** (Easy/Moderate/Hard), **Puzzle N** (the day's number),
  **wrong pets** (never "slips"), **hints**, **lives/hearts**. Internal names (`mistakes`, `mode === 'level'`) are unchanged.
- No em dashes or decorative copy in UI text; short plain sentences.
- Every overlay (game, non-home tab, sheet, hint, how-to) registers a layer with `addLayer` so the back
  gesture closes it instead of leaving the app. Use `sheet()` for bottom sheets; it registers the layer itself.
- Keep `hints.js` and `puzzle.js` free of DOM access so the scripts can import them.
- The calendar and leaderboards start on 1 November 2026 (`CAL_START`).

## Gotchas

- **Never change a puzzle seed or size for a set that is live** — it changes boards for dates already played.
  New sets get new seeds (`petdoku-v2-<diff>-<n>`); Time Attack still uses `petdoku-v1-time-<n>`.
- After changing `puzzle.js` generation or configs, run `npm run build:puzzles` then `npm test`.
- When patching files with a script, do not use `String.replace(str, replacement)` with replacement text that
  contains `$` (regex in `firestore.rules`, template literals in `app.js`): `$'` and `$&` are expanded.
  Use `split(old).join(new)` or a function replacement. This once corrupted `firestore.rules`.
- `firestore.rules` restricts the day-id pattern. A new game type needs the pattern updated and deployed.
- The out-of-lives lock and local history live only in the browser; Firestore's create-only entry is what
  actually prevents a second ranked result.
- Demo mode (`?demo`) exposes `window.__game()` returning the live game state, for testing only.
- In an embedded preview the page may report `document.hidden`, which auto-pauses the game; tests set
  `__game().paused = false`. Board re-renders replace cell nodes, so re-query cells before each tap.

## Testing checklist for a gameplay change

1. `npm test` (or at least `node scripts/verify-hints.js` when boards are unchanged); `npm run test:rules` if rules or submitted fields changed.
2. In `?demo` at phone width: play a board to a win, lose one on purpose, resume a saved game,
   open the leaderboard for that game, share from the result sheet and from the home card.
3. Check a legacy day (before 21 Nov 2026) still shows its old result under the right level.
4. If rules changed, deploy them with hosting and confirm a real solve reaches the leaderboard.

## Working preferences of the owner

- Research the logic before changing code; avoid quick patches that cause follow-up bugs.
- After each change: test locally, then commit, push and deploy when asked ("Commit and deploy").
- Keep the README (and the how-to slides, when rules or modes change) in step with the app.
