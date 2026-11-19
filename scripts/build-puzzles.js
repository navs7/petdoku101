// Pre-computes all 365 levels x 2 modes into public/puzzles.json (run: npm run build:puzzles).
// Entry: { s: size, r: region id per cell as a digit string, c: solution column per row as a digit string }.
import { writeFileSync } from 'node:fs';
import { configFor, generatePuzzle, solve } from '../public/js/puzzle.js';

const out = { v: 1, level: [], time: [] };
for (const mode of ['level', 'time']) {
  for (let lv = 1; lv <= 365; lv++) {
    const cfg = configFor(mode, lv), p = generatePuzzle(cfg);
    if (solve(p.regions, p.size, 2).count !== 1) throw new Error(`not unique: ${mode} ${lv}`);
    out[mode].push({ s: p.size, r: p.regions.join(''), c: p.solution.join('') });
  }
}
writeFileSync(new URL('../public/puzzles.json', import.meta.url), JSON.stringify(out));
console.log('wrote public/puzzles.json');
