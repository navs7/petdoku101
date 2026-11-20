// Hint engine: returns the NEXT SINGLE LOGICAL STEP for the current board, the way a careful player would
// find it. A step either crosses squares out or places exactly one pet. It never guesses and never
// reveals more than one pet. Pure functions (no DOM) so scripts/verify-hints.js can test every puzzle.
//
// Board values: 0 empty, 1 white ✕ note, 2 placed (correct) pet, 3 red ✕ (a wrong guess, known not to be a pet).
// The engine trusts only the pets and red ✕ tiles. The player's own ✕ notes are never trusted (they may be
// wrong); they only decide whether a step is already done on the board and can be skipped.

const near = (n, a, b) => Math.abs(((a / n) | 0) - ((b / n) | 0)) <= 1 && Math.abs((a % n) - (b % n)) <= 1;

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

function* combos(arr, k, start = 0, pick = []) {
  if (pick.length === k) { yield pick; return; }
  for (let i = start; i <= arr.length - (k - pick.length); i++) yield* combos(arr, k, i + 1, [...pick, arr[i]]);
}

// Step kinds:
//  cross   { pets, cells }                      squares ruled out by pets already on the board (free)
//  single  { type, idx, i }                     a row / column / colour with one square left: place the pet
//  confine { dir, lineType, lines, regions, cells }  k colours locked into k lines (or k lines into k colours): cross out the rest
//  block   { victim: {type, idx}, cells }       squares that would each leave that unit with no square: cross them out
//  reveal  { type, idx, i }                     no simple rule applies: place the pet (rare fallback)
// `cells` are the squares to cross out; `todo` are the ones not crossed on the board yet.
export function nextHint({ n, regions, solution, cells }) {
  const pets = [], dead = [];
  cells.forEach((v, i) => { if (v === 2) pets.push(i); else if (v === 3) dead.push(i); });
  if (pets.length === n) return null;
  const line = (type, i) => (type === 'row' ? (i / n) | 0 : i % n);

  // 1. squares the placed pets rule out but the player hasn't crossed yet
  const byPets = blockedCells(n, regions, pets);
  const uncrossed = [...byPets].filter((i) => cells[i] === 0);
  if (uncrossed.length) return { kind: 'cross', free: true, pets: pets.slice(), cells: uncrossed, todo: uncrossed };

  const rowsU = new Set(pets.map((p) => (p / n) | 0)), colsU = new Set(pets.map((p) => p % n)), regsU = new Set(pets.map((p) => regions[p]));
  const gone = new Set([...byPets, ...dead, ...pets]); // squares logically known not to hold a new pet

  for (let guard = 0; guard < 400; guard++) {
    const open = [];
    for (let i = 0; i < n * n; i++) if (!gone.has(i)) open.push(i);
    const units = [];
    for (let k = 0; k < n; k++) {
      if (!regsU.has(k)) units.push({ type: 'region', idx: k, open: open.filter((i) => regions[i] === k) });
      if (!rowsU.has(k)) units.push({ type: 'row', idx: k, open: open.filter((i) => ((i / n) | 0) === k) });
      if (!colsU.has(k)) units.push({ type: 'col', idx: k, open: open.filter((i) => i % n === k) });
    }

    // 2. a unit with one square left: the pet is forced
    for (const type of ['region', 'row', 'col']) {
      const u = units.find((x) => x.type === type && x.open.length === 1);
      if (u) return { kind: 'single', type, idx: u.idx, i: u.open[0], cells: [], todo: [] };
    }

    const regs = units.filter((u) => u.type === 'region');
    const confine = (k) => {
      if (k >= regs.length) return null;
      for (const lt of ['row', 'col']) {
        // k colours whose open squares all sit in k lines: those lines belong to those colours
        for (const combo of combos(regs, k)) {
          const ls = new Set(); combo.forEach((u) => u.open.forEach((i) => ls.add(line(lt, i))));
          if (ls.size !== k) continue;
          const ids = new Set(combo.map((u) => u.idx));
          const out = open.filter((i) => ls.has(line(lt, i)) && !ids.has(regions[i]));
          if (out.length) return { kind: 'confine', dir: 'regions', lineType: lt, lines: [...ls].sort((a, b) => a - b), regions: [...ids], cells: out, keep: combo.flatMap((u) => u.open) };
        }
        // k lines whose open squares all sit in k colours: those colours' pets are in those lines
        for (const combo of combos(units.filter((u) => u.type === lt), k)) {
          const rs = new Set(); combo.forEach((u) => u.open.forEach((i) => rs.add(regions[i])));
          if (rs.size !== k) continue;
          const ids = new Set(combo.map((u) => u.idx));
          const out = open.filter((i) => rs.has(regions[i]) && !ids.has(line(lt, i)));
          if (out.length) return { kind: 'confine', dir: 'lines', lineType: lt, lines: [...ids].sort((a, b) => a - b), regions: [...rs], cells: out, keep: combo.flatMap((u) => u.open) };
        }
      }
      return null;
    };
    // a square whose pet would rule out every open square of some other row / column / colour
    const block = () => {
      for (const t of open) {
        const b = blockedCells(n, regions, [t]);
        const u = units.find((x) => x.open.length && x.open.every((i) => b.has(i)));
        if (u) {
          const all = open.filter((x) => { const bx = blockedCells(n, regions, [x]); return u.open.every((i) => bx.has(i)); });
          return { kind: 'block', i: t, victim: { type: u.type, idx: u.idx }, cells: all, keep: u.open.slice() };
        }
      }
      return null;
    };

    const step = confine(1) || block() || confine(2) || confine(3);
    if (!step) break;
    step.todo = step.cells.filter((i) => cells[i] === 0);
    if (step.todo.length) return step;           // not on the board yet: this is the hint
    step.cells.forEach((i) => gone.add(i));      // already crossed by the player: build on it
  }

  // 3. nothing simple left: give the pet of the tightest colour
  let best = null;
  for (let k = 0; k < n; k++) {
    if (regsU.has(k)) continue;
    const size = unitCells(n, regions, 'region', k).filter((i) => !gone.has(i)).length;
    if (!best || size < best.size) best = { k, size };
  }
  const i = unitCells(n, regions, 'region', best.k).find((c) => solution[(c / n) | 0] === c % n);
  return { kind: 'reveal', type: 'region', idx: best.k, i, cells: [], todo: [] };
}

// What the hint changes on the board when applied: squares to cross (value 1) or one pet (value 2).
export function applyHint(cells, step) {
  if (step.kind === 'single' || step.kind === 'reveal') cells[step.i] = 2;
  else for (const i of step.todo) cells[i] = 1;
  return cells;
}
