// Generates all 365 levels x 2 modes; checks uniqueness, determinism, solution validity and timing.
import { configFor, generatePuzzle, solve } from '../public/js/puzzle.js';

let worst = 0, worstWhere = '', bad = 0;
const t0 = Date.now();
for (const mode of ['level', 'time']) {
  for (let lv = 1; lv <= 365; lv++) {
    const cfg = configFor(mode, lv), N = cfg.size;
    const t = Date.now();
    const p = generatePuzzle(cfg);
    const dt = Date.now() - t; if (dt > worst) { worst = dt; worstWhere = `${mode} ${lv} (${N}x${N})`; }
    const again = generatePuzzle(cfg);
    const unique = solve(p.regions, N, 2).count === 1;
    const same = JSON.stringify(p.regions) === JSON.stringify(again.regions);
    const sizes = new Set(p.regions).size === N;
    const valid = p.solution.every((c, r) => p.regions[r * N + c] !== undefined) && new Set(p.solution.map((c, r) => p.regions[r * N + c])).size === N;
    if (!unique || !same || !sizes || !valid) { bad++; console.log('FAIL', mode, lv, { unique, same, sizes, valid }); }
  }
}
console.log(`730 puzzles checked in ${Date.now() - t0}ms, slowest ${worst}ms [${worstWhere}], failures: ${bad}`);
process.exit(bad ? 1 : 0);
