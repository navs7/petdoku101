// Checks firestore.rules against the Firestore emulator (no dependencies; talks to its REST API).
// Run:  npm run test:rules     (needs Java for the emulator)
// Each case states whether the write must be ALLOWED or DENIED; any mismatch fails the run.
const PROJECT = 'petdoku-101';
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// The emulator accepts unsigned tokens, so any uid can be simulated.
const token = (uid) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: uid, user_id: uid, iat: 1, exp: 9999999999, firebase: { sign_in_provider: 'anonymous', identities: {} } })}.`;

const val = (v) => (v === null ? { nullValue: null } : typeof v === 'string' ? { stringValue: v } : Number.isInteger(v) ? { integerValue: String(v) } : typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) });
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));
const create = (path, data) => ({ update: { name: `${ROOT}/${path}`, fields: fields(data) }, currentDocument: { exists: false } });
const update = (path, data) => ({ update: { name: `${ROOT}/${path}`, fields: fields(data) }, updateMask: { fieldPaths: Object.keys(data) }, currentDocument: { exists: true } });
async function commit(uid, writes) {
  const r = await fetch(`http://${HOST}/v1/${ROOT}:commit`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${uid === 'ADMIN' ? 'owner' : token(uid)}` }, body: JSON.stringify({ writes }) });
  return { ok: r.ok, body: r.ok ? '' : await r.text() };
}

const pad = (n) => String(n).padStart(2, '0');
const day = (offset = 0) => { const d = new Date(Date.now() + offset * 864e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const TODAY = day();
const profile = (uid, username) => ({ uid, username, avatar: 2, streak: 0, bestStreak: 0, totalPoints: 0, solved: 0, lastDate: null, createdAt: Date.now() });
const signUp = (uid, username) => [create(`usernames/${username}`, { uid, createdAt: Date.now() }), create(`users/${uid}`, profile(uid, username))];
// A result exactly as the app builds it.
function entry(uid, username, game, o = {}) {
  const ms = o.ms ?? 61000, mistakes = o.mistakes ?? 0, hints = o.hints ?? 0, isTime = game === 'time';
  const base = { level_easy: 300, level_moderate: 550, level_hard: 800 }[game] || 0;
  const adj = ms + mistakes * 15000 + hints * 30000;
  const score = isTime ? Math.round(Math.min(1000, Math.max(100, 1000 - (adj / 1000) * 3))) : Math.max(50, base - mistakes * 50 - hints * 75 + Math.max(0, Math.round(200 - ms / 1000 / 1.5)));
  const e = { uid, username, mode: isTime ? 'time' : 'level', date: o.date ?? TODAY, level: 100, score, sortKey: isTime ? adj : (2000 - score) * 1e6 + Math.min(ms, 999999), adj, ms, mistakes, hints, stars: 3, avatar: 2, at: Date.now() };
  if (!isTime) e.diff = game.slice(6);
  return { ...e, ...(o.set || {}) };
}
const result = (uid, username, game, stats, o) => {
  const e = entry(uid, username, game, o), id = `${o?.date ?? TODAY}_${game}`;
  return [create(`days/${id}/entries/${uid}`, e), update(`users/${uid}`, { streak: 1, bestStreak: 1, lastDate: o?.date ?? TODAY, lastGame: id, totalPoints: (stats.totalPoints || 0) + e.score, solved: (stats.solved || 0) + 1, ...(o?.stats || {}) })];
};

let failed = 0, n = 0;
async function expect(allowed, label, uid, writes) {
  const r = await commit(uid, writes); n++;
  if (r.ok !== allowed) { failed++; console.log(`FAIL  ${label}: expected ${allowed ? 'ALLOWED' : 'DENIED'}${r.body ? ' — ' + r.body.replace(/\s+/g, ' ').slice(0, 160) : ''}`); }
  else console.log(`ok    ${allowed ? 'allowed' : 'denied '}  ${label}`);
}
const A = true, D = false;

// ---- sign-up ----
await expect(A, 'sign up: username + profile in one batch', 'u1', signUp('u1', 'alice'));
await expect(D, 'second username for the same account', 'u1', [create('usernames/alice2', { uid: 'u1', createdAt: 1 })]);
await expect(D, 'username without a profile', 'u2', [create('usernames/squat', { uid: 'u2', createdAt: 1 })]);
await expect(D, 'username already taken', 'u2', signUp('u2', 'alice'));
await expect(D, 'username too long', 'u2', signUp('u2', 'a_name_that_is_far_too_long'));
await expect(D, 'username with markup', 'u2', signUp('u2', '<b>x</b>'));
await expect(D, 'profile for another uid', 'u2', signUp('u3', 'mallory'));
await expect(D, 'profile starting with points', 'u2', [create('usernames/bob', { uid: 'u2', createdAt: 1 }), create('users/u2', { ...profile('u2', 'bob'), totalPoints: 9999 })]);
await expect(D, 'profile with a text avatar', 'u2', [create('usernames/bob', { uid: 'u2', createdAt: 1 }), create('users/u2', { ...profile('u2', 'bob'), avatar: '"><img src=x onerror=alert(1)>' })]);
await expect(D, 'profile with an extra field', 'u2', [create('usernames/bob', { uid: 'u2', createdAt: 1 }), create('users/u2', { ...profile('u2', 'bob'), bio: 'x' })]);
await expect(A, 'second player signs up', 'u2', signUp('u2', 'bob'));

// ---- profile updates ----
await expect(A, 'change avatar', 'u1', [update('users/u1', { avatar: 5 })]);
await expect(D, 'avatar out of range', 'u1', [update('users/u1', { avatar: 42 })]);
await expect(D, 'avatar as text', 'u1', [update('users/u1', { avatar: '<svg onload=alert(1)>' })]);
await expect(D, 'edit own total points', 'u1', [update('users/u1', { totalPoints: 999999 })]);
await expect(D, 'edit own streak', 'u1', [update('users/u1', { streak: 500, bestStreak: 500 })]);
await expect(D, 'rename', 'u1', [update('users/u1', { username: 'root' })]);
await expect(D, "edit another player's avatar", 'u2', [update('users/u1', { avatar: 1 })]);

// ---- results ----
await expect(A, 'Easy result with its stats', 'u1', result('u1', 'alice', 'level_easy', {}));
const easy = entry('u1', 'alice', 'level_easy').score;
await expect(D, 'same result again', 'u1', result('u1', 'alice', 'level_easy', { totalPoints: easy, solved: 1 }));
await expect(D, 'stats again without a new result', 'u1', [update('users/u1', { streak: 1, bestStreak: 1, lastDate: TODAY, lastGame: `${TODAY}_level_easy`, totalPoints: easy * 2, solved: 2 })]);
await expect(D, 'stats with more points than the result', 'u1', result('u1', 'alice', 'level_moderate', { totalPoints: easy, solved: 1 }, { stats: { totalPoints: 50000 } }));
await expect(D, 'streak jumping ahead', 'u1', result('u1', 'alice', 'level_moderate', { totalPoints: easy, solved: 1 }, { stats: { streak: 30, bestStreak: 30 } }));
await expect(A, 'Moderate result with a wrong pet and a hint', 'u1', result('u1', 'alice', 'level_moderate', { totalPoints: easy, solved: 1 }, { mistakes: 1, hints: 1, ms: 240000 }));
await expect(A, 'Hard result, slow solve (no speed bonus)', 'u2', result('u2', 'bob', 'level_hard', {}, { ms: 900000 }));
await expect(A, 'Time Attack result', 'u2', result('u2', 'bob', 'time', { totalPoints: entry('u2', 'bob', 'level_hard', { ms: 900000 }).score, solved: 1 }, { mistakes: 2, hints: 3, ms: 185000 }));
// the app sends fractional milliseconds in adj and sortKey
await expect(A, 'Time Attack result with fractional times', 'u1', [create(`days/${TODAY}_time/entries/u1`, entry('u1', 'alice', 'time', { ms: 90000, set: { adj: 89999.6234, sortKey: 89999.6234 } }))]);
await expect(A, 'Hard result with a fractional rank key', 'u1', [create(`days/${TODAY}_level_hard/entries/u1`, entry('u1', 'alice', 'level_hard', { ms: 400000, set: { adj: 399999.51, sortKey: (2000 - 800) * 1e6 + 399999.51 } }))]);
await expect(A, 'result for yesterday (time zones)', 'u2', [create(`days/${day(-1)}_level_easy/entries/u2`, entry('u2', 'bob', 'level_easy', { date: day(-1) }))]);
await expect(D, 'result for last month', 'u2', [create(`days/${day(-30)}_level_easy/entries/u2`, entry('u2', 'bob', 'level_easy', { date: day(-30) }))]);
await expect(D, 'result for next week', 'u2', [create(`days/${day(7)}_level_easy/entries/u2`, entry('u2', 'bob', 'level_easy', { date: day(7) }))]);
await expect(D, 'old plain _level leaderboard', 'u2', [create(`days/${TODAY}_level/entries/u2`, entry('u2', 'bob', 'level_easy'))]);
await expect(D, 'unknown game id', 'u2', [create(`days/${TODAY}_level_insane/entries/u2`, entry('u2', 'bob', 'level_easy'))]);
await expect(D, 'result in another player\'s name', 'u2', [create(`days/${TODAY}_level_moderate/entries/u1x`, entry('u1x', 'alice', 'level_moderate'))]);
await expect(D, 'result with someone else\'s username', 'u2', [create(`days/${TODAY}_level_moderate/entries/u2`, entry('u2', 'alice', 'level_moderate'))]);
const bad = (label, set, game = 'level_moderate') => expect(D, label, 'u2', [create(`days/${TODAY}_${game}/entries/u2`, entry('u2', 'bob', game, { set }))]);
await bad('score above what Moderate can give', { score: 1000, sortKey: 1000 * 1e6 });
await bad('score higher than the solve allows', { score: entry('u2', 'bob', 'level_moderate').score + 40, sortKey: (2000 - entry('u2', 'bob', 'level_moderate').score - 40) * 1e6 });
await bad('rank key that does not match the score', { sortKey: 1 });
await bad('negative solve time', { ms: -5, adj: -5 });
await bad('three wrong pets on a win', { mistakes: 3 });
await bad('score as text', { score: '<img src=x onerror=alert(1)>' });
await bad('hints as text', { hints: '<script>alert(1)</script>' });
await bad('avatar as text', { avatar: '"><img src=x onerror=alert(1)>' });
await bad('extra field', { note: 'x'.repeat(1000) });
await bad('wrong level name for the board', { diff: 'hard' });
await bad('Time Attack rank key below the real time', { sortKey: 1 }, 'level_hard');
await expect(D, 'Time Attack: adjusted time without penalties', 'u1', [create(`days/${TODAY}_time/entries/u1`, entry('u1', 'alice', 'time', { mistakes: 2, hints: 2, set: { adj: 1000, sortKey: 1000, score: 997 } }))]);
await expect(D, 'not signed in', 'ANON', [create(`days/${TODAY}_time/entries/ANON`, entry('ANON', 'alice', 'time'))]);

// ---- nothing can be changed or removed afterwards ----
await expect(D, 'edit a result', 'u1', [update(`days/${TODAY}_level_easy/entries/u1`, { score: 500 })]);
await expect(D, 'delete a result', 'u1', [{ delete: `${ROOT}/days/${TODAY}_level_easy/entries/u1` }]);
await expect(D, 'delete a username', 'u1', [{ delete: `${ROOT}/usernames/alice` }]);

console.log(`\n${n} rule checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
