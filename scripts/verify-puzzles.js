// Checks every board in public/puzzles.json (365 x easy, moderate, hard, time): right size, exactly one
// solution, the stored solution is that one, one region per colour, and the file matches what the
// seeded generator produces (so a device without the file would build the same board).
import { readFileSync } from 'node:fs';
import { configFor, generatePuzzle, solve, BANK_SETS } from '../public/js/puzzle.js';

const bank = JSON.parse(readFileSync(new URL('../public/puzzles.json', import.meta.url), 'utf8'));
let worst = 0, worstWhere = '', bad = 0, total = 0;
const t0 = Date.now();
for (const set of BANK_SETS) {
  if (bank[set]?.length !== 365) { bad++; console.log('FAIL', set, 'does not have 365 puzzles'); continue; }
  for (let lv = 1; lv <= 365; lv++) {
    const cfg = set === 'time' ? configFor('time', lv) : configFor('level', lv, set), N = cfg.size, e = bank[set][lv - 1];
    const regions = [...e.r].map(Number), solution = [...e.c].map(Number);
    total++;
    const t = Date.now();
    const p = generatePuzzle(cfg);
    const dt = Date.now() - t; if (dt > worst) { worst = dt; worstWhere = `${set} ${lv} (${N}x${N})`; }
    const s = solve(regions, N, 2);
    const size = e.s === N && regions.length === N * N && solution.length === N;
    const unique = s.count === 1 && s.first.join('') === e.c;
    const same = p.regions.join('') === e.r && p.solution.join('') === e.c;
    const sizes = new Set(regions).size === N;
    const valid = new Set(solution.map((c, r) => regions[r * N + c])).size === N;
    if (!size || !unique || !same || !sizes || !valid) { bad++; console.log('FAIL', set, lv, { size, unique, same, sizes, valid }); }
  }
}
console.log(`${total} puzzles checked in ${Date.now() - t0}ms, slowest to generate ${worst}ms [${worstWhere}], failures: ${bad}`);
process.exit(bad ? 1 : 0);
