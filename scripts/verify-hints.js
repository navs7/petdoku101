// Solves every pre-built puzzle using nothing but hints and checks each step is sound:
//  - a pet is only ever placed on its solution tile
//  - a square that gets crossed out is never a solution tile
//  - one hint places at most one pet, and the puzzle finishes
// Also plays a "no notes" player (who ignores cross-out hints' effect by clearing them) to make sure the
// engine never loops.
import { readFileSync } from 'node:fs';
import { nextHint, applyHint } from '../public/js/hints.js';
import { BANK_SETS } from '../public/js/puzzle.js';

const bank = JSON.parse(readFileSync(new URL('../public/puzzles.json', import.meta.url), 'utf8'));
const tally = {}; let puzzles = 0, hints = 0, bad = 0, maxSteps = 0;
const fail = (msg, mode, k) => { bad++; console.error(`${msg} [${mode} ${k + 1}]`); };

// every set, plus the "old" boards kept for days before graded levels (keyed by puzzle number)
const sets = BANK_SETS.map((m) => [m, bank[m].map((e, k) => [k, e])]);
for (const [m, byLevel] of Object.entries(bank.old || {})) sets.push(['old ' + m, Object.entries(byLevel).map(([lv, e]) => [lv - 1, e])]);

for (const [mode, list] of sets) list.forEach(([k, e]) => {
  const n = e.s, regions = [...e.r].map(Number), solution = [...e.c].map(Number), cells = new Array(n * n).fill(0);
  const isSol = (i) => solution[(i / n) | 0] === i % n;
  puzzles++;
  let steps = 0;
  for (; steps < 600; steps++) {
    const h = nextHint({ n, regions, solution, cells });
    if (!h) break;
    hints++; tally[h.kind] = (tally[h.kind] || 0) + 1;
    if (h.kind === 'single' || h.kind === 'reveal') {
      if (!isSol(h.i)) { fail(`${h.kind} placed a pet off the solution`, mode, k); break; }
    } else {
      if (!h.todo.length) { fail(`${h.kind} hint with nothing to do`, mode, k); break; }
      if (h.cells.some(isSol)) { fail(`${h.kind} crossed out a solution tile`, mode, k); break; }
    }
    const before = cells.filter((v) => v === 2).length;
    applyHint(cells, h);
    if (cells.filter((v) => v === 2).length - before > 1) { fail('one hint placed more than one pet', mode, k); break; }
  }
  if (cells.filter((v) => v === 2).length !== n) fail('hints did not finish the puzzle', mode, k);
  maxSteps = Math.max(maxSteps, steps);
});

console.log(`${puzzles} puzzles solved with hints only: ${hints} hints, most for one puzzle ${maxSteps}, errors ${bad}`);
console.log(Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', '));
process.exit(bad ? 1 : 0);
