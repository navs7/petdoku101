// Difficulty grading: solves a board the way the hint engine would (always the simplest step that
// works) and reports which kinds of reasoning it needed. No DOM, so scripts can use it.
//
// Step kinds, simplest first:
//   single  a row / column / colour with one square left
//   c1      one colour locked into one line, or one line locked into one colour
//   block   a square whose pet would leave another row / column / colour with no square
//   c2, c3  two / three colours locked into two / three lines (or the other way round)
//   reveal  none of the above works: the board needs deeper look-ahead
import { nextHint, applyHint } from './hints.js';

const WEIGHT = { c1: 1, block: 3, c2: 7, c3: 12, reveal: 40 };
const TIER = ['single', 'c1', 'block', 'c2', 'c3', 'reveal'];

export function gradePuzzle({ size: n, regions, solution }) {
  const cells = new Array(n * n).fill(0);
  const steps = { single: 0, c1: 0, block: 0, c2: 0, c3: 0, reveal: 0 };
  let opening = 0, pets = 0; // opening = reasoning steps needed before the first pet can be placed
  for (let guard = 0; guard < 4000; guard++) {
    const h = nextHint({ n, regions, solution, cells });
    if (!h) break;
    if (h.kind !== 'cross') {
      const k = h.kind === 'confine' ? 'c' + h.lines.length : h.kind;
      steps[k]++;
      if (k === 'single' || k === 'reveal') pets++; else if (!pets) opening++;
    }
    applyHint(cells, h);
  }
  let tier = 0, score = 0;
  TIER.forEach((k, i) => { if (steps[k]) tier = i; score += (WEIGHT[k] || 0) * steps[k]; });
  return { tier, score, opening, steps, eye: eyeSolve({ size: n, regions }, false), eye2: eyeSolve({ size: n, regions }, true) };
}

// "By eye" solver: uses only the steps a player can see on the board without working anything out.
//   pet     a colour, row or column with one open square: the pet goes there
//   colour  a colour whose open squares all sit in one row or column: the rest of that line is out
//   line    (only when `lines` is true) a row or column whose open squares are all one colour: the rest
//           of that colour is out
// It never asks "what would happen if a pet went here". Returns whether these steps alone finish the
// board, how many colour / line steps that took, and how many of them came before the first pet.
export function eyeSolve({ size: n, regions }, lines) {
  const N = n * n, open = new Array(N).fill(true), all = [...Array(N).keys()];
  const key = { region: (i) => regions[i], row: (i) => (i / n) | 0, col: (i) => i % n };
  const done = { region: new Set(), row: new Set(), col: new Set() };
  const left = (t, k) => all.filter((i) => open[i] && key[t](i) === k);
  const out = { solved: false, pets: 0, colour: 0, line: 0, opening: 0 };
  const cross = (cells, kind) => { cells.forEach((i) => { open[i] = false; }); out[kind]++; if (!out.pets) out.opening++; };
  const step = () => {
    for (const t of ['region', 'row', 'col']) for (let k = 0; k < n; k++) {
      if (done[t].has(k)) continue;
      const c = left(t, k);
      if (c.length !== 1) continue;
      const p = c[0], pr = key.row(p), pc = key.col(p);
      all.forEach((i) => { if (key.row(i) === pr || key.col(i) === pc || regions[i] === regions[p] || (Math.abs(key.row(i) - pr) <= 1 && Math.abs(key.col(i) - pc) <= 1)) open[i] = false; });
      done.region.add(regions[p]); done.row.add(pr); done.col.add(pc); out.pets++;
      return true;
    }
    for (const lt of ['row', 'col']) for (let k = 0; k < n; k++) {
      if (done.region.has(k)) continue;
      const c = left('region', k), ls = new Set(c.map(key[lt]));
      if (ls.size !== 1) continue;
      const rest = left(lt, [...ls][0]).filter((i) => regions[i] !== k);
      if (rest.length) { cross(rest, 'colour'); return true; }
    }
    if (lines) for (const lt of ['row', 'col']) for (let k = 0; k < n; k++) {
      if (done[lt].has(k)) continue;
      const c = left(lt, k), rs = new Set(c.map(key.region));
      if (rs.size !== 1) continue;
      const rest = left('region', [...rs][0]).filter((i) => key[lt](i) !== k);
      if (rest.length) { cross(rest, 'line'); return true; }
    }
    return false;
  };
  while (out.pets < n && step());
  out.solved = out.pets === n;
  return out;
}
