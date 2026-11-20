// Pre-computes every board into public/puzzles.json (run: npm run build:puzzles):
// 365 puzzles for each Score Attack level (easy, moderate, hard) and 365 for Time Attack.
// Entry: { s: size, r: region id per cell as a digit string, c: solution column per row as a digit string }.
import { writeFileSync } from 'node:fs';
import { configFor, generatePuzzle, solve, BANK_SETS } from '../public/js/puzzle.js';

const out = { v: 2 };
for (const set of BANK_SETS) {
  out[set] = [];
  for (let lv = 1; lv <= 365; lv++) {
    const cfg = set === 'time' ? configFor('time', lv) : configFor('level', lv, set), p = generatePuzzle(cfg);
    if (solve(p.regions, p.size, 2).count !== 1) throw new Error(`not unique: ${set} ${lv}`);
    out[set].push({ s: p.size, r: p.regions.join(''), c: p.solution.join('') });
  }
  console.log(set, 'done');
}
writeFileSync(new URL('../public/puzzles.json', import.meta.url), JSON.stringify(out));
console.log('wrote public/puzzles.json');
