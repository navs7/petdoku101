// Walks every pre-built puzzle by repeatedly asking for a hint and checks that each explanation is sound:
// the hinted tile is the solution tile, and every alternative the explanation rejects is really wrong.
import { readFileSync } from 'node:fs';
import { explain } from '../public/js/hints.js';

const bank = JSON.parse(readFileSync(new URL('../public/puzzles.json', import.meta.url), 'utf8'));
let puzzles = 0, hints = 0, forced = 0, dead = 0, unexplained = 0, bad = 0;
for (const mode of ['level', 'time']) for (const e of bank[mode]) {
  const n = e.s, regions = [...e.r].map(Number), solution = [...e.c].map(Number), cells = new Array(n * n).fill(0);
  puzzles++;
  for (let step = 0; step < n; step++) {
    const ex = explain({ n, regions, solution, cells });
    if (!ex) break;
    hints++;
    if (solution[(ex.i / n) | 0] !== ex.i % n) { bad++; console.error('hint is not the solution tile', mode, e.s); break; }
    if (ex.kind === 'deadend') {
      dead++;
      for (const o of ex.others) {
        if (solution[(o.i / n) | 0] === o.i % n) { bad++; console.error('rejected the solution tile'); }
        if (!o.why) unexplained++;
      }
    } else forced++;
    cells[ex.i] = 2;
  }
}
console.log(`${puzzles} puzzles, ${hints} hints: ${forced} forced-tile, ${dead} elimination (${unexplained} alternatives without a visible dead end), ${bad} errors`);
process.exit(bad ? 1 : 0);
