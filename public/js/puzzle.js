// Region puzzle engine ("queens" style): place N pets on an N×N board of N coloured regions.
// Rules: exactly one pet in every row, column and region; no two pets touch (even diagonally).
// Same (mode, level) -> same puzzle on every device, and every puzzle has a UNIQUE solution.
import { gradePuzzle } from './grade.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}
function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Row-by-row search. reg[r*N+c] = region id. Returns {count, first} where first = column per row.
export function solve(reg, N, limit = 2) {
  const colUsed = new Array(N).fill(false), regUsed = new Array(N).fill(false), cols = new Array(N);
  let count = 0, first = null;
  const rec = (r) => {
    if (r === N) { count++; if (!first) first = cols.slice(); return count >= limit; }
    for (let c = 0; c < N; c++) {
      if (colUsed[c] || (r && Math.abs(c - cols[r - 1]) < 2)) continue;
      const g = reg[r * N + c]; if (regUsed[g]) continue;
      colUsed[c] = regUsed[g] = true; cols[r] = c;
      if (rec(r + 1)) return true;
      colUsed[c] = regUsed[g] = false;
    }
    return false;
  };
  rec(0);
  return { count, first };
}

function randomPlacement(N, rng) {
  const cols = new Array(N), used = new Array(N).fill(false);
  const rec = (r) => {
    if (r === N) return true;
    for (const c of shuffle([...Array(N).keys()], rng)) {
      if (used[c] || (r && Math.abs(c - cols[r - 1]) < 2)) continue;
      used[c] = true; cols[r] = c;
      if (rec(r + 1)) return true;
      used[c] = false;
    }
    return false;
  };
  return rec(0) ? cols : null;
}

// Grow N connected regions outward from the placed pets, one random cell at a time.
function growRegions(N, cols, rng) {
  const reg = new Array(N * N).fill(-1);
  cols.forEach((c, r) => { reg[r * N + c] = r; });
  let left = N * N - N;
  const nb = (i) => { const r = (i / N) | 0, c = i % N, o = []; if (r) o.push(i - N); if (r < N - 1) o.push(i + N); if (c) o.push(i - 1); if (c < N - 1) o.push(i + 1); return o; };
  while (left) {
    const cand = [];
    for (let i = 0; i < reg.length; i++) if (reg[i] < 0) for (const j of nb(i)) if (reg[j] >= 0) cand.push([i, reg[j]]);
    const [i, g] = cand[Math.floor(rng() * cand.length)];
    reg[i] = g; left--;
  }
  return reg;
}

const nbrs = (i, N) => { const r = (i / N) | 0, c = i % N, o = []; if (r) o.push(i - N); if (r < N - 1) o.push(i + N); if (c) o.push(i - 1); if (c < N - 1) o.push(i + 1); return o; };
function connectedWithout(reg, N, g, skip) {
  const cells = []; reg.forEach((x, i) => { if (x === g && i !== skip) cells.push(i); });
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), q = [cells[0]];
  while (q.length) for (const j of nbrs(q.pop(), N)) if (j !== skip && reg[j] === g && !seen.has(j)) { seen.add(j); q.push(j); }
  return seen.size === cells.length;
}

// Hill-climb: move boundary cells between regions (never the planted pets, never breaking
// connectivity) and keep any move that doesn't increase the number of solutions.
function repair(reg, N, cols, rng, steps) {
  const planted = new Set(cols.map((c, r) => r * N + c));
  let cur = solve(reg, N, 300).count;
  for (let s = 0; s < steps && cur > 1; s++) {
    const i = Math.floor(rng() * reg.length);
    if (planted.has(i)) continue;
    const opts = nbrs(i, N).map((j) => reg[j]).filter((g) => g !== reg[i]);
    if (!opts.length) continue;
    const old = reg[i], g = opts[Math.floor(rng() * opts.length)];
    if (!connectedWithout(reg, N, old, i)) continue;
    reg[i] = g;
    const n = solve(reg, N, 300).count;
    if (n <= cur) cur = n; else reg[i] = old;
  }
  return cur;
}

export function generatePuzzle({ size, seed }) {
  const N = size, rng = mulberry32(hashSeed(seed));
  for (let outer = 0; outer < 200; outer++) {
    const cols = randomPlacement(N, rng);
    for (let k = 0; k < 6; k++) {
      const regions = growRegions(N, cols, rng);
      if (repair(regions, N, cols, rng, 600) === 1) {
        const { count, first } = solve(regions, N, 2);
        if (count === 1) return { size: N, regions, solution: first };
      }
    }
  }
  throw new Error('no unique puzzle found for ' + seed);
}

// ---- Difficulty bands (Score Attack levels, and Time Attack by board size) ----
// A level is defined by the reasoning a board needs (see grade.js), not only by its size. miss() is 0
// when the grade is inside the band, otherwise how far outside it is.
// Easy and Moderate must be solvable "by eye" (eyeSolve in grade.js): every step is something visible on
// the board, never "what would happen if a pet went here".
//   easy4      pets with one square left, plus at most two "this colour sits in one row / column" steps,
//              at most one of them before the first pet
//   moderate4  the same steps plus "this row / column is all one colour"; three to eight such steps
//   hard       needs two or three colours locked into as many lines, plus plenty of other steps
// No band accepts a board the hint engine cannot finish by logic (a "reveal" step).
// easy and moderate are the first graded bands: they allowed bookkeeping and look-ahead steps. They stay
// only for the one day played on them (21 Nov 2026).
const far = (x, lo, hi) => (x < lo ? lo - x : x > hi ? x - hi : 0);
export const BANDS = {
  easy: (g) => (g.tier > 1 ? 100 * g.tier : 0) + far(g.score, 0, 3) + far(g.opening, 0, 2),
  moderate: (g) => (g.tier === 2 ? 0 : 100 * (1 + Math.abs(g.tier - 2))) + far(g.score, 6, 18),
  easy4: (g) => (g.eye.solved ? 0 : 100) + far(g.eye.colour, 0, 2) + far(g.eye.opening, 0, 1),
  moderate4: (g) => (g.eye2.solved ? 0 : 100) + far(g.eye2.colour + g.eye2.line, 3, 8) + far(g.eye2.opening, 0, 4),
  hard: (g) => (g.tier === 3 || g.tier === 4 ? 0 : g.tier === 5 ? 1000 : 100 * (3 - g.tier)) + far(g.score, 20, 1e9),
};
export const GRADE_TRIES = 60;
// Tries seeds "<seed>-0", "<seed>-1", ... and returns the first board inside the band (or, if none of
// GRADE_TRIES is, the closest one). `only` builds just that attempt (the one stored in puzzles.json).
export function generateGraded(cfg, only) {
  const miss = BANDS[cfg.grade], one = Number.isInteger(only);
  let best = null;
  for (let a = one ? only : 0; a < GRADE_TRIES; a++) {
    const p = generatePuzzle({ size: cfg.size, seed: `${cfg.seed}-${a}` }), g = gradePuzzle(p), m = miss(g);
    if (!best || m < best.miss) best = { ...p, attempt: a, grade: g, miss: m };
    if (!m || one) break;
  }
  return best;
}
export const buildPuzzle = (cfg) => (cfg.grade ? generateGraded(cfg) : generatePuzzle(cfg));

// Prefer the pre-computed boards (public/puzzles.json); fall back to generating on the fly.
let bank;
export async function getPuzzle(mode, level, cfg) {
  try {
    bank ||= fetch('puzzles.json').then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
    const b = await bank, e = cfg.old ? b.old?.[cfg.key]?.[level] : b[mode === 'level' ? cfg.key : mode]?.[level - 1];
    if (e && e.s === cfg.size) return { size: e.s, regions: [...e.r].map(Number), solution: [...e.c].map(Number) };
  } catch { bank = null; }
  return buildPuzzle(cfg);
}

// ---- Daily schedule: puzzle n (1..365) is fixed; the date picks n. ----
// Score Attack: the player picks one of three levels each day. A harder board starts with more points.
export const DIFFS = {
  easy: { key: 'easy', name: 'Easy', size: 6, base: 300 },
  moderate: { key: 'moderate', name: 'Moderate', size: 8, base: 550 },
  hard: { key: 'hard', name: 'Hard', size: 10, base: 800 },
};
export const BANK_SETS = ['easy', 'moderate', 'hard', 'time']; // keys of public/puzzles.json
// Old rotation (one fixed size per day). Only used to label results recorded before levels were selectable.
export const TIERS = [
  { name: 'Cozy', size: 6, base: 300 },
  { name: 'Easy', size: 7, base: 400 },
  { name: 'Warm', size: 8, base: 500 },
  { name: 'Medium', size: 8, base: 600 },
  { name: 'Tricky', size: 9, base: 700 },
  { name: 'Hard', size: 10, base: 800 },
  { name: 'Fierce', size: 10, base: 900 },
];
// Boards graded by difficulty start on GRADED_FROM. Dates before it keep the ungraded v2 boards they were
// played on (stored under "old" in puzzles.json). Callers that only need size or name may omit the date.
// Easy and Moderate switch to the by-eye bands on EYE_FROM; the one day in between keeps its v3 boards.
// A config with `old: true` is read from puzzles.json's "old" section.
export const GRADED_FROM = '2026-11-21', EYE_FROM = '2026-11-22';
export function configFor(mode, level, diff, date) {
  if (mode === 'level' && DIFFS[diff]) {
    if (date && date < GRADED_FROM) return { ...DIFFS[diff], old: true, seed: `petdoku-v2-${diff}-${level}` };
    if (diff === 'hard') return { ...DIFFS[diff], grade: diff, seed: `petdoku-v3-${diff}-${level}` };
    return date && date < EYE_FROM ? { ...DIFFS[diff], old: true, grade: diff, seed: `petdoku-v3-${diff}-${level}` }
      : { ...DIFFS[diff], grade: diff + '4', seed: `petdoku-v4-${diff}-${level}` };
  }
  if (mode === 'level') { const t = TIERS[(level - 1) % 7]; return { ...t, legacy: true, seed: `petdoku-v1-level-${level}` }; }
  // Time Attack: each day is an 8×8 graded like Moderate (by eye) or a 10×10 graded like Hard, picked at random
  // by puzzle number (the same for everyone). Before GRADED_FROM the size cycled 6 to 10 and was ungraded,
  // so the size depends on the date too: pass the date whenever one is known.
  const race = { key: 'time', name: 'Race', base: 0 };
  if (date && date < GRADED_FROM) return { ...race, size: 6 + (level % 5), old: true, seed: `petdoku-v1-time-${level}` };
  const big = hashSeed('petdoku-time-size-' + level) % 2 === 1;
  if (big) return { ...race, size: 10, grade: 'hard', seed: `petdoku-v2-time-${level}` };
  // 8×8: by-eye boards from EYE_FROM, like Moderate; the one day before it keeps its first-band board
  return date && date < EYE_FROM ? { ...race, size: 8, old: true, grade: 'moderate', seed: `petdoku-v2-time-${level}` }
    : { ...race, size: 8, grade: 'moderate4', seed: `petdoku-v3-time-${level}` };
}

export const pad = (n) => String(n).padStart(2, '0');
export function dateKey(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }
export function dayOfYear(k) {
  const d = parseKey(k);
  return Math.round((d - new Date(d.getFullYear(), 0, 1)) / 864e5) + 1;
}
export const levelFor = (k) => Math.min(dayOfYear(k), 365);

// ---- Scoring ----
export function adjustedMs(ms, mistakes, hints) { return ms + mistakes * 15000 + hints * 30000; }
export function scoreFor(mode, cfg, { ms, mistakes, hints }) {
  const sec = ms / 1000, adj = adjustedMs(ms, mistakes, hints);
  let score;
  if (mode === 'level') {
    const bonus = Math.max(0, Math.round(200 - sec / 1.5));
    score = Math.max(50, cfg.base - mistakes * 50 - hints * 75 + bonus);
  } else {
    score = Math.round(Math.min(1000, Math.max(100, 1000 - (adj / 1000) * 3)));
  }
  const sortKey = mode === 'level' ? (2000 - score) * 1e6 + Math.min(ms, 999999) : adj;
  const flawless = mistakes + hints;
  const stars = mode === 'level' ? (flawless === 0 ? 3 : flawless <= 2 ? 2 : 1) : (adj < 90000 ? 3 : adj < 240000 ? 2 : 1);
  return { score, sortKey, adj, stars };
}

export function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
