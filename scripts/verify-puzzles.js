// Checks every board in public/puzzles.json (365 x easy, moderate, hard, time, plus the "old" boards
// kept for days before GRADED_FROM): right size, exactly one solution, the stored solution is that one,
// one region per colour, and the file matches what the seeded generator produces (so a device without
// the file would build the same board).
// Graded boards (Score Attack levels and Time Attack) are also checked against their difficulty band (BANDS in puzzle.js): the stored
// board must be inside it, and it must be the first attempt that is. That last check rebuilds every
// earlier attempt, which is slow for 10×10, so hard-band boards are sampled (every 12th day) unless run with --full.
import { readFileSync } from 'node:fs';
import { configFor, generatePuzzle, generateGraded, solve, BANK_SETS, BANDS } from '../public/js/puzzle.js';
import { gradePuzzle } from '../public/js/grade.js';

const FULL = process.argv.includes('--full');
const bank = JSON.parse(readFileSync(new URL('../public/puzzles.json', import.meta.url), 'utf8'));
let worst = 0, worstWhere = '', bad = 0, total = 0, firstChecked = 0;
const t0 = Date.now();

function check(label, lv, cfg, e) {
  const N = cfg.size, regions = [...e.r].map(Number), solution = [...e.c].map(Number);
  total++;
  const t = Date.now();
  const p = cfg.grade ? generateGraded(cfg, e.a) : generatePuzzle(cfg);
  const dt = Date.now() - t; if (dt > worst) { worst = dt; worstWhere = `${label} ${lv} (${N}x${N})`; }
  const s = solve(regions, N, 2);
  const res = {
    size: e.s === N && regions.length === N * N && solution.length === N,
    unique: s.count === 1 && s.first.join('') === e.c,
    same: p.regions.join('') === e.r && p.solution.join('') === e.c,
    sizes: new Set(regions).size === N,
    valid: new Set(solution.map((c, r) => regions[r * N + c])).size === N,
  };
  if (cfg.grade) {
    res.band = BANDS[cfg.grade](gradePuzzle({ size: N, regions, solution })) === 0;
    if (FULL || cfg.grade !== 'hard' || lv % 12 === 0) {
      firstChecked++;
      res.first = generateGraded(cfg).attempt === e.a;
    }
  }
  if (Object.values(res).includes(false)) { bad++; console.log('FAIL', label, lv, res); }
}

for (const set of BANK_SETS) {
  if (bank[set]?.length !== 365) { bad++; console.log('FAIL', set, 'does not have 365 puzzles'); continue; }
  for (let lv = 1; lv <= 365; lv++) check(set, lv, set === 'time' ? configFor('time', lv) : configFor('level', lv, set), bank[set][lv - 1]);
}
// Days before GRADED_FROM: configFor only returns the old seed when given such a date, so pass one.
for (const [set, byLevel] of Object.entries(bank.old || {})) {
  for (const [lv, e] of Object.entries(byLevel)) check('old ' + set, +lv, set === 'time' ? configFor('time', +lv, undefined, '2026-11-01') : configFor('level', +lv, set, '2026-11-01'), e);
}
console.log(`${total} puzzles checked in ${Date.now() - t0}ms (first-attempt check on ${firstChecked}), slowest to generate ${worst}ms [${worstWhere}], failures: ${bad}`);
process.exit(bad ? 1 : 0);
