// Pre-computes every board into public/puzzles.json (run: npm run build:puzzles):
// 365 puzzles for each Score Attack level (easy, moderate, hard) and 365 for Time Attack, plus the
// ungraded Score Attack boards of the days before GRADED_FROM under "old" (keyed by puzzle number).
// Entry: { s: size, r: region id per cell as a digit string, c: solution column per row as a digit string,
//          a: which attempt of the graded generator this is (Score Attack levels only) }.
// The Hard level tries several 10×10 boards per day, so the work is spread over worker threads.
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { configFor, buildPuzzle, solve, levelFor, addDays, BANK_SETS, DIFFS, GRADED_FROM } from '../public/js/puzzle.js';

const CAL_START = '2026-11-01'; // first playable day (CAL_START in app.js)

function jobs() {
  const out = [];
  for (const set of BANK_SETS) for (let lv = 1; lv <= 365; lv++) out.push({ set, lv });
  for (let d = CAL_START; d < GRADED_FROM; d = addDays(d, 1)) for (const set of Object.keys(DIFFS)) out.push({ set, lv: levelFor(d), date: d });
  return out;
}

if (!isMainThread) {
  for (const j of workerData) {
    const cfg = j.set === 'time' ? configFor('time', j.lv) : configFor('level', j.lv, j.set, j.date), p = buildPuzzle(cfg);
    if (solve(p.regions, p.size, 2).count !== 1) throw new Error(`not unique: ${j.set} ${j.lv}`);
    const e = { s: p.size, r: p.regions.join(''), c: p.solution.join('') };
    if (cfg.grade) e.a = p.attempt;
    parentPort.postMessage({ ...j, e, miss: p.miss || 0, grade: p.grade });
  }
} else {
  const all = jobs(), W = Math.max(1, Math.min(cpus().length - 1, 12));
  const out = { v: 3, old: {} }, t0 = Date.now();
  let done = 0, outside = 0;
  await Promise.all(Array.from({ length: W }, (_, w) => new Promise((ok, no) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: all.filter((_, i) => i % W === w) });
    worker.on('message', (m) => {
      if (m.date) ((out.old[m.set] ||= {})[m.lv] = m.e); else ((out[m.set] ||= [])[m.lv - 1] = m.e);
      if (m.miss) { outside++; console.log(`outside its band: ${m.set} ${m.lv}`, JSON.stringify(m.grade)); }
      if (++done % 200 === 0) console.log(`${done} / ${all.length}`);
    });
    worker.on('error', no); worker.on('exit', ok);
  })));
  for (const set of BANK_SETS) if (out[set]?.filter(Boolean).length !== 365) throw new Error('incomplete set ' + set);
  writeFileSync(new URL('../public/puzzles.json', import.meta.url), JSON.stringify(out));
  console.log(`wrote public/puzzles.json in ${Math.round((Date.now() - t0) / 1000)}s; boards outside their band: ${outside}`);
}
