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
  return { tier, score, opening, steps };
}
