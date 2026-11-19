// Region puzzle engine ("queens" style): place N pets on an N×N board of N coloured regions.
// Rules: exactly one pet in every row, column and region; no two pets touch (even diagonally).
// Same (mode, level) -> same puzzle on every device, and every puzzle has a UNIQUE solution.

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

// Prefer the pre-computed boards (public/puzzles.json); fall back to generating on the fly.
let bank;
export async function getPuzzle(mode, level, cfg) {
  try {
    bank ||= fetch('puzzles.json').then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
    const e = (await bank)[mode]?.[level - 1];
    if (e && e.s === cfg.size) return { size: e.s, regions: [...e.r].map(Number), solution: [...e.c].map(Number) };
  } catch { bank = null; }
  return generatePuzzle(cfg);
}

// ---- Daily schedule: level n (1..365) is fixed; the date picks n. ----
export const TIERS = [
  { name: 'Cozy', size: 6, base: 300 },
  { name: 'Easy', size: 7, base: 400 },
  { name: 'Warm', size: 8, base: 500 },
  { name: 'Medium', size: 8, base: 600 },
  { name: 'Tricky', size: 9, base: 700 },
  { name: 'Hard', size: 10, base: 800 },
  { name: 'Fierce', size: 10, base: 900 },
];
export function configFor(mode, level) {
  if (mode === 'level') { const t = TIERS[(level - 1) % 7]; return { ...t, seed: `petdoku-v1-level-${level}` }; }
  return { name: 'Race', size: 6 + (level % 5), base: 0, seed: `petdoku-v1-time-${level}` };
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
