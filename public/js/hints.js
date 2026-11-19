// Explains WHY a hinted pet belongs where it does, using only the rules a player can apply by eye.
// Pure functions (no DOM) so scripts/verify-hints.js can test them against every puzzle.
//
// A unit is a row, a column or a colour region that still needs its pet. A tile is "open" for a unit
// when no placed pet blocks it (same row / column / region, or touching) and it isn't a red-✕ tile.

const near = (n, a, b) => Math.abs(((a / n) | 0) - ((b / n) | 0)) <= 1 && Math.abs((a % n) - (b % n)) <= 1;

function unitsFor(n, regions, pets, dead) {
  const rows = new Set(), cols = new Set(), regs = new Set();
  for (const p of pets) { rows.add((p / n) | 0); cols.add(p % n); regs.add(regions[p]); }
  const open = [];
  for (let i = 0; i < n * n; i++) {
    if (pets.includes(i) || dead.has(i)) continue;
    if (rows.has((i / n) | 0) || cols.has(i % n) || regs.has(regions[i])) continue;
    if (pets.some((p) => near(n, i, p))) continue;
    open.push(i);
  }
  const units = [];
  for (let k = 0; k < n; k++) {
    if (!regs.has(k)) units.push({ type: 'region', idx: k, open: open.filter((i) => regions[i] === k) });
    if (!rows.has(k)) units.push({ type: 'row', idx: k, open: open.filter((i) => ((i / n) | 0) === k) });
    if (!cols.has(k)) units.push({ type: 'col', idx: k, open: open.filter((i) => i % n === k) });
  }
  return units;
}

// Place `c`, then keep placing any pet that is forced. Returns the first unit left with no open tile, or null.
function contradiction(n, regions, pets, dead, c) {
  const p = [...pets, c];
  for (let step = 0; step <= n; step++) {
    const units = unitsFor(n, regions, p, dead);
    const empty = units.find((u) => u.open.length === 0);
    if (empty) return { type: empty.type, idx: empty.idx, forced: step, chain: p.slice(pets.length) };
    const single = units.find((u) => u.open.length === 1);
    if (!single) return null;
    p.push(single.open[0]);
  }
  return null;
}

// state: { n, regions, solution, cells }  cells: 2 = placed (correct) pet, 3 = red ✕ tile.
// Returns { i, kind: 'region'|'row'|'col'|'deadend', type, idx, others: [{ i, why }] } or null when finished.
export function explain({ n, regions, solution, cells }) {
  const pets = [], dead = new Set();
  cells.forEach((v, i) => { if (v === 2) pets.push(i); else if (v === 3) dead.add(i); });
  const units = unitsFor(n, regions, pets, dead);
  if (!units.length) return null;
  const isSol = (i) => solution[(i / n) | 0] === i % n;

  // 1. a unit with exactly one open tile: the pet is forced
  for (const type of ['region', 'row', 'col']) {
    const u = units.find((x) => x.type === type && x.open.length === 1 && isSol(x.open[0]));
    if (u) return { i: u.open[0], kind: type, type, idx: u.idx, others: [] };
  }

  // 2. otherwise pick the unit that is easiest to argue by elimination: try each other tile and show
  //    the dead end it causes. Prefer units where every alternative has a visible dead end.
  let best = null;
  for (const u of units) {
    const target = u.open.find(isSol);
    if (target === undefined || u.open.length < 2) continue;
    const others = u.open.filter((c) => c !== target).map((c) => ({ i: c, why: contradiction(n, regions, pets, dead, c) }));
    const score = [others.filter((o) => !o.why).length, u.open.length];
    if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) best = { score, u, target, others };
  }
  if (!best) return null;
  return { i: best.target, kind: 'deadend', type: best.u.type, idx: best.u.idx, others: best.others };
}

// Every tile of a row / column / colour region.
export function unitCells(n, regions, type, idx) {
  const out = [];
  for (let i = 0; i < n * n; i++) if (type === 'region' ? regions[i] === idx : type === 'row' ? ((i / n) | 0) === idx : i % n === idx) out.push(i);
  return out;
}

// Tiles that the given pets rule out: same row, column or colour, or touching. The pets' own tiles are excluded.
export function blockedCells(n, regions, pets) {
  const out = new Set();
  for (let i = 0; i < n * n; i++) {
    if (pets.includes(i)) continue;
    if (pets.some((p) => ((p / n) | 0) === ((i / n) | 0) || p % n === i % n || regions[p] === regions[i] || near(n, i, p))) out.add(i);
  }
  return out;
}
