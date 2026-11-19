import { getPuzzle, configFor, levelFor, dateKey, parseKey, addDays, scoreFor, fmtTime } from './puzzle.js';
import { ANIMALS, pet, mountSprite } from './pets.js';
import { createBackend, USERNAME_RE, ls } from './backend.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 14v4M8 21h8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', fwd: '<path d="M9 5l7 7-7 7"/>',
  pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="M7 4l13 8-13 8z"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  eraser: '<path d="M20 20H9L4 15a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-7 8"/><path d="M7 11l6 6"/>',
  pencil: '<path d="M4 20l1-5L16 4a2.1 2.1 0 0 1 3 3L8 18z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  share: '<path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  flame: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z"/>',
  star: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.5 5.7 21l1.5-7L2 9.3l7-.8z"/>',
};

// ---------------- state ----------------
const S = {
  be: null, me: null, tab: 'home', today: dateKey(),
  set: { piece: 0, ...(ls.get('purr:settings', {})) },
  rank: { mode: 'level', date: dateKey(), tab: 'level' },
};
let G = null, timer = null, tick = null;
const hist = () => ls.get('purr:hist:' + (S.me?.uid || ''), {});
const saveHist = (h) => ls.set('purr:hist:' + (S.me?.uid || ''), h);
const gKey = (mode, date) => `purr:g2:${S.me.uid}:${mode}:${date}`;
const fmtDate = (k, o = { weekday: 'short', day: 'numeric', month: 'short' }) => parseKey(k).toLocaleDateString(undefined, o);

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

function sheet(html) {
  const el = document.createElement('div');
  el.className = 'scrim';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) el.remove(); });
  document.body.append(el);
  return el;
}

// ---------------- boot ----------------
async function boot() {
  mountSprite();
  app.innerHTML = `<div class="loader">${pet(0)}</div>`;
  S.be = await createBackend();
  try { S.me = await S.be.init(); } catch (e) {
    console.error(e);
    const code = e.code || e.message || '';
    const msg = /admin-restricted|operation-not-allowed/.test(code)
      ? 'Anonymous sign-in is turned off for this Firebase project. In the Firebase console open <b>Authentication → Sign-in method</b> and enable <b>Anonymous</b>, then retry.'
      : /firestore-unavailable|unavailable|permission-denied/.test(code)
        ? 'Sign-in works, but Firestore isn’t ready. In the Firebase console open <b>Firestore Database → Create database</b>, then run <b>firebase deploy --only firestore</b> to publish the rules, and retry.'
        : 'We couldn’t reach the game server. Check your connection and retry.';
    app.innerHTML = `<main class="screen onb"><div class="brand">${pet(0)}Petdoku</div><h1>Can’t connect yet</h1>
      <p class="lede">${msg}</p>
      <button class="btn block" onclick="location.reload()">Retry</button></main>`;
    return;
  }
  S.me ? go('home') : onboarding();
  document.addEventListener('visibilitychange', () => {
    S.today = dateKey();
    if (document.hidden && G && !G.done) setPaused(true);
    else if (!document.hidden && !G && S.me) go(S.tab);
  });
  setInterval(() => { const c = $('#cd'); if (c) c.textContent = untilMidnight(); }, 1000);
}
function untilMidnight() {
  const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  const s = Math.floor((m - n) / 1000), p = (x) => String(x).padStart(2, '0');
  if (dateKey() !== S.today) { S.today = dateKey(); if (!G && S.me) go(S.tab); }
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

// ---------------- onboarding ----------------
function onboarding() {
  let avatar = 0, name = '', ok = false, seq = 0, dt;
  app.innerHTML = `<main class="screen onb">
    <div class="brand">${pet(0)}Petdoku</div>
    <div><h1>A new pet puzzle, every single day.</h1></div>
    <p class="lede">Everyone gets the same board. Solve it, share it, and climb the leaderboard.</p>
    <div class="field"><label>Pick your pet</label><div class="avatars" id="av"></div></div>
    <div class="field"><label for="un">Choose a unique username</label>
      <div class="inp"><span class="at">@</span><input id="un" maxlength="16" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="whiskers_42"></div>
      <div class="hint" id="uh">3–16 letters, numbers or underscores.</div></div>
    <button class="btn block" id="go" disabled>Start playing</button>
    ${S.be.mode === 'local' ? '<p class="demo-note">Demo mode: add your Firebase config in <b>js/firebase-config.js</b> to share usernames and leaderboards across devices.</p>' : ''}
  </main>`;
  const av = $('#av');
  const drawAv = () => { av.innerHTML = ANIMALS.map((c, i) => `<button class="avatar" aria-label="${c.n}" aria-pressed="${i === avatar}" data-i="${i}">${pet(i)}</button>`).join(''); };
  drawAv();
  av.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { avatar = +b.dataset.i; drawAv(); } });
  const hint = (t, c = '') => { const h = $('#uh'); h.textContent = t; h.className = 'hint ' + c; };
  $('#un').addEventListener('input', (e) => {
    name = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); e.target.value = name; ok = false; $('#go').disabled = true;
    clearTimeout(dt);
    if (!name) return hint('3–16 letters, numbers or underscores.');
    if (!USERNAME_RE.test(name)) return hint('Needs at least 3 characters.', 'bad');
    hint('Checking…');
    const mine = ++seq;
    dt = setTimeout(async () => {
      let free = false; try { free = await S.be.usernameAvailable(name); } catch { return hint('Could not check right now.', 'bad'); }
      if (mine !== seq) return;
      ok = free; hint(free ? `@${name} is yours to take.` : `@${name} is already taken.`, free ? 'ok' : 'bad'); $('#go').disabled = !free;
    }, 350);
  });
  $('#go').addEventListener('click', async () => {
    if (!ok) return; $('#go').disabled = true;
    try { S.me = await S.be.createProfile(name, avatar); go('home'); }
    catch { hint('Someone just grabbed that name. Try another.', 'bad'); }
  });
}

// ---------------- shell + tabs ----------------
function go(tab) {
  stopTimer(); G = null; S.tab = tab; S.today = dateKey();
  const view = { home, cal, ranks, me }[tab]();
  app.innerHTML = `<main class="screen">${view.html}</main>
    <nav class="nav" aria-label="Main">${[['home', 'Play', I.home], ['cal', 'Calendar', I.cal], ['ranks', 'Ranks', I.trophy], ['me', 'Me', I.user]]
      .map(([k, l, d]) => `<button data-tab="${k}" ${k === tab ? 'aria-current="page"' : ''}>${ico(d)}${l}</button>`).join('')}</nav>`;
  $('.nav').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });
  window.scrollTo(0, 0);
  view.bind?.($('.screen'));
  if (tab === 'home' && !ls.get('purr:seenHowTo')) howTo();
}

// ---------------- home ----------------
function home() {
  const t = S.today, lv = levelFor(t), h = hist()[t] || {};
  const lc = configFor('level', lv), tc = configFor('time', lv);
  const card = (mode, c, tag, title, blurb) => {
    const d = h[mode], saved = !d && ls.get(gKey(mode, t));
    return `<button class="mode ${mode} ${d ? 'done' : ''}" data-play="${mode}">
      <span class="tag">${tag}</span><h2>${title}</h2><p>${blurb}</p>
      <div class="pile">${pet(mode === 'level' ? 5 : 0)}${pet(mode === 'level' ? 0 : 3)}${pet(mode === 'level' ? 7 : 8)}</div>
      <span class="go">${d ? 'Solved' : saved ? 'Resume' : 'Play'} ${ico(d ? I.star : I.play, 'width="14" height="14" fill="currentColor"')}</span>
      ${d ? `<span class="score">${mode === 'level' ? d.score + ' pts' : fmtTime(d.adj)}</span>` : ''}</button>`;
  };
  const days = [...Array(7)].map((_, i) => addDays(t, i - 6));
  const H = hist();
  return {
    html: `<div class="top"><div class="brand">${pet(0)}Petdoku</div>
        <div class="chips"><span class="chip" title="Day streak">${ico(I.flame)}${S.me.streak || 0}</span></div></div>
      <div class="hello"><small>${fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long' })} · Puzzle ${lv} of 365</small><h1>Hi, @${esc(S.me.username)}</h1></div>
      <div class="cards">
        ${card('level', lc, `Daily level · ${lc.size}×${lc.size}`, lc.name, 'Fewest slips, best score.')}
        ${card('time', tc, `Time attack · ${tc.size}×${tc.size}`, 'Race', 'Fastest clock wins.')}
      </div>
      <div class="sec"><h3>This week</h3><span>${S.me.totalPoints || 0} pts all-time</span></div>
      <div class="week">${days.map((d) => `<div class="wd ${d === t ? 'today' : ''}">${fmtDate(d, { weekday: 'short' })}<b>${parseKey(d).getDate()}</b><i><em class="l ${H[d]?.level ? 'on' : ''}"></em><em class="t ${H[d]?.time ? 'on' : ''}"></em></i></div>`).join('')}</div>
      ${h.level || h.time ? `<div class="acts"><button class="btn ghost" data-share>${ico(I.share, 'width="20" height="20" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')}Share today’s status</button></div>` : ''}
      <p class="next">Next puzzle in <b id="cd">${untilMidnight()}</b></p>`,
    bind(el) {
      el.addEventListener('click', (e) => {
        const p = e.target.closest('[data-play]'); if (p) return open(p.dataset.play, t);
        if (e.target.closest('[data-share]')) share(t);
      });
    },
  };
}

function open(mode, date) {
  const d = hist()[date]?.[mode];
  if (d) return resultSheet(mode, date, d, true);
  startGame(mode, date);
}

// ---------------- calendar ----------------
function cal() {
  const y = parseKey(S.today).getFullYear(), H = hist();
  let out = '';
  for (let m = 0; m < 12; m++) {
    const n = new Date(y, m + 1, 0).getDate(), off = (new Date(y, m, 1).getDay() + 6) % 7;
    let cells = '<span></span>'.repeat(off);
    for (let d = 1; d <= n; d++) {
      const k = dateKey(new Date(y, m, d)), r = H[k] || {};
      cells += `<button class="day ${k === S.today ? 'today' : ''} ${k > S.today ? 'future' : ''} ${r.level && r.time ? 'full' : ''}" data-d="${k}" aria-label="${fmtDate(k)}">${d}<i><em class="l ${r.level ? 'on' : ''}"></em><em class="t ${r.time ? 'on' : ''}"></em></i></button>`;
    }
    const done = Object.keys(H).filter((k) => k.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).length;
    out += `<section class="month"><h3>${new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long' })}<span>${done} of ${n} days played</span></h3><div class="mgrid">${cells}</div></section>`;
  }
  return {
    html: `<h1 class="title">${y} calendar</h1><p class="sub">365 levels, one a day. Tap a past day to practise it.</p>
      <div class="legend"><span><em style="background:var(--accent)"></em>Level</span><span><em style="background:var(--sage)"></em>Time</span></div>${out}`,
    bind(el) {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-d]'); if (!b) return;
        const k = b.dataset.d, lv = levelFor(k), r = hist()[k] || {}, past = k < S.today;
        const row = (mode, c) => `<button class="btn ${r[mode] ? 'ghost' : ''}" data-m="${mode}">${mode === 'level' ? `Level · ${c.name} ${c.size}×${c.size}` : `Time attack · ${configFor('time', lv).size}×${configFor('time', lv).size}`}${r[mode] ? ' · view' : ''}</button>`;
        const s = sheet(`<h2>${fmtDate(k, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <p class="sub">Puzzle ${lv} of 365${past ? ' · practice run, not ranked' : ''}</p>
          <div class="pick">${row('level', configFor('level', lv))}${row('time', configFor('time', lv))}</div>`);
        s.addEventListener('click', (ev) => { const m = ev.target.closest('[data-m]'); if (m) { s.remove(); open(m.dataset.m, k); } });
      });
    },
  };
}

// ---------------- ranks ----------------
function ranks() {
  const R = S.rank;
  return {
    html: `<h1 class="title">Leaderboard</h1>
      <div class="seg" role="tablist">${[['level', 'Level'], ['time', 'Time'], ['season', 'All-time']].map(([k, l]) => `<button role="tab" data-t="${k}" aria-selected="${R.tab === k}">${l}</button>`).join('')}</div>
      <div id="db"></div><div class="rows" id="rows"><div class="empty">${pet(2)}Loading…</div></div>`,
    bind(el) {
      const load = async () => {
        const db = $('#db'), rows = $('#rows'), mine = S.me.uid, token = (load.t = (load.t || 0) + 1);
        if (R.tab === 'season') db.innerHTML = '<p class="sub">Total points from every ranked puzzle.</p>';
        else db.innerHTML = `<div class="datebar"><button class="iconbtn" data-dd="-1" aria-label="Previous day">${ico(I.back)}</button><b>${R.date === S.today ? 'Today' : fmtDate(R.date)}<small>Puzzle ${levelFor(R.date)} · ${R.tab === 'level' ? 'ranked by score' : 'ranked by time'}</small></b><button class="iconbtn" data-dd="1" aria-label="Next day" ${R.date >= S.today ? 'disabled' : ''}>${ico(I.fwd)}</button></div>`;
        let list = [];
        try { list = R.tab === 'season' ? await S.be.season() : await S.be.board(`${R.date}_${R.tab}`); }
        catch (e) { console.error(e); rows.innerHTML = `<div class="empty">Could not load the board.</div>`; return; }
        if (token !== load.t) return;
        if (!list.length) { rows.innerHTML = `<div class="empty">${pet(4)}<p>No one has finished yet.<br>Be the first on the board.</p></div>`; return; }
        rows.innerHTML = list.map((u, i) => {
          const val = R.tab === 'season' ? `${u.totalPoints}` : R.tab === 'level' ? `${u.score}` : fmtTime(u.adj);
          const sub = R.tab === 'season' ? `${u.solved || 0} solved · ${u.streak || 0} day streak` : R.tab === 'level' ? `${fmtTime(u.ms)} · ${u.mistakes} slips` : `${u.mistakes} slips · ${u.hints} hints`;
          return `<div class="row ${u.uid === mine ? 'me' : ''}" style="animation-delay:${i * 30}ms"><span class="rk">${i + 1}</span>${pet(u.avatar || 0)}<span class="nm">@${esc(u.username)}<small>${sub}</small></span><span class="val">${val}</span></div>`;
        }).join('');
      };
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-t]'), d = e.target.closest('[data-dd]');
        if (t) { R.tab = t.dataset.t; $$('[data-t]', el).forEach((b) => b.setAttribute('aria-selected', b === t)); load(); }
        if (d && !d.disabled) { R.date = addDays(R.date, +d.dataset.dd); load(); }
      });
      load();
    },
  };
}
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------------- profile ----------------
function me() {
  const u = S.me;
  return {
    html: `<div class="me-head">${pet(u.avatar || 0)}<div><h1>@${esc(u.username)}</h1><p class="sub">${S.be.mode === 'firebase' ? 'Playing online' : 'Demo mode · this device only'}</p></div></div>
      <div class="stats">
        <div class="stat"><b>${u.streak || 0}</b><span>Day streak</span></div><div class="stat"><b>${u.bestStreak || 0}</b><span>Best streak</span></div>
        <div class="stat"><b>${u.solved || 0}</b><span>Puzzles solved</span></div><div class="stat"><b>${u.totalPoints || 0}</b><span>Total points</span></div>
      </div>
      <div class="set">
        <div class="opt"><b>Your pet</b><div class="avatars" id="av">${ANIMALS.map((c, i) => `<button class="avatar" aria-label="${c.n}" aria-pressed="${i === (u.avatar || 0)}" data-i="${i}">${pet(i)}</button>`).join('')}</div></div>
        <button class="link" data-how>How to play</button>
        ${S.be.mode === 'local' ? '<button class="link" data-reset>Reset demo data</button>' : ''}
      </div>`,
    bind(el) {
      el.addEventListener('click', async (e) => {
        const a = e.target.closest("[data-i]");
        if (e.target.closest('[data-how]')) return howTo();
        if (a) { try { S.me = await S.be.setAvatar(+a.dataset.i); go('me'); } catch { toast('Could not save'); } }
        if (e.target.closest('[data-reset]') && confirm('Erase all demo data on this device?')) { localStorage.clear(); location.reload(); }
      });
    },
  };
}

// ---------------- game ----------------
const X_SVG = '<svg class="x" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="#fff" stroke-width="3.6" stroke-linecap="round" fill="none"/></svg>';
const COLORS = ['#E3B93F', '#E6A8C7', '#C45C8E', '#8E7BD0', '#4FB3A6', '#5B9BE0', '#7DBE5A', '#EE8A4C', '#E0645C', '#A79384'];
function stopTimer() { clearInterval(timer); timer = null; }
function startGame(mode, date) {
  app.innerHTML = `<div class="loader">${pet(S.me.avatar || 0)}</div>`;
  setTimeout(async () => {
    const level = levelFor(date), cfg = configFor(mode, level), p = await getPuzzle(mode, level, cfg), n = p.size;
    const sv = ls.get(gKey(mode, date));
    const ok = sv && sv.cells?.length === n * n;
    G = {
      mode, date, level, cfg, n, regions: p.regions, solution: p.solution,
      cells: ok ? sv.cells : new Array(n * n).fill(0), ms: ok ? sv.ms : 0, mistakes: ok ? sv.mistakes : 0, hints: ok ? sv.hints : 0,
      undo: [], paused: false, done: false, practice: date !== S.today, last: performance.now(), pop: -1,
    };
    renderGame();
    timer = setInterval(() => {
      const now = performance.now();
      if (!G.paused && !G.done) { G.ms += now - G.last; const t = $('#tm'); if (t) t.textContent = fmtTime(G.ms); }
      G.last = now; if (!G.done && Math.floor(now / 3000) !== G._sv) { G._sv = Math.floor(now / 3000); persist(); }
    }, 250);
  }, 40);
}
const persist = () => G && !G.done && ls.set(gKey(G.mode, G.date), { cells: G.cells, ms: G.ms, mistakes: G.mistakes, hints: G.hints });

// Cells holding a pet that breaks a rule (same row / column / region, or touching).
function conflicts() {
  const { n, cells, regions } = G, pets = [], bad = new Set();
  cells.forEach((v, i) => { if (v === 2) pets.push(i); });
  for (let a = 0; a < pets.length; a++) for (let b = a + 1; b < pets.length; b++) {
    const x = pets[a], y = pets[b], rx = (x / n) | 0, ry = (y / n) | 0, cx = x % n, cy = y % n;
    if (rx === ry || cx === cy || regions[x] === regions[y] || (Math.abs(rx - ry) <= 1 && Math.abs(cx - cy) <= 1)) { bad.add(x); bad.add(y); }
  }
  return bad;
}

function renderGame() {
  const { cfg, mode, n } = G;
  app.innerHTML = `<main class="play">
    <div class="bar"><button class="iconbtn" data-act="back" aria-label="Back">${ico(I.back)}</button>
      <h2>${mode === 'level' ? 'Daily level ' + G.level : 'Time attack ' + G.level}<small>${cfg.name} · ${n}×${n}${G.practice ? ' · practice' : ''}</small></h2>
      <div class="timer"><span id="tm">${fmtTime(G.ms)}</span><button class="iconbtn" data-act="pause" aria-label="Pause">${ico(I.pause)}</button></div></div>
    <div class="stat-row" id="st"></div>
    <div class="board-wrap" style="position:relative"><div class="board" id="bd" style="--n:${n}"></div></div>
    <div class="tools">
      <button class="tool" data-act="undo">${ico(I.undo)}Undo</button>
      <button class="tool" data-act="hint">${ico(I.bulb)}Hint<b id="hc" hidden></b></button>
      <button class="tool" data-act="clear">${ico(I.eraser)}Clear</button>
      <button class="tool" data-act="help"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17.5v.1"/></svg>Rules</button></div>
  </main>`;
  paint();
  $('.play').addEventListener('click', (e) => {
    const c = e.target.closest('[data-i]'), a = e.target.closest('[data-act]');
    if (c) tap(+c.dataset.i);
    if (a) act(a.dataset.act);
  });
}
function paint() {
  if (!G) return;
  const { n, cells, regions } = G, bad = conflicts(), icon = S.me.avatar || 0; // the pet you picked is the pet you place
  let b = '';
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, c = i % n, v = cells[i];
    const cls = ['cell', c < n - 1 && regions[i] !== regions[i + 1] && 'rB', r < n - 1 && regions[i] !== regions[i + n] && 'bB', c === n - 1 && 'eR', r === n - 1 && 'eB',
      bad.has(i) && 'bad', i === G.pop && 'pop', v === 1 && 'marked'].filter(Boolean).join(' ');
    const inner = v === 2 ? pet(icon) : v === 1 ? X_SVG : '';
    b += `<button class="${cls}" data-i="${i}" style="background:${COLORS[regions[i]]};--i:${i}" aria-label="Row ${r + 1} column ${c + 1}, region ${regions[i] + 1}, ${v === 2 ? 'pet' : v === 1 ? 'marked' : 'empty'}">${inner}</button>`;
  }
  $('#bd').innerHTML = b; G.pop = -1;
  const placed = cells.filter((v) => v === 2).length, pen = G.mode === 'level' ? '−50 pts each' : '+15 s each';
  $('#st').innerHTML = `<span>Pets <b>${placed}/${n}</b></span><span>Slips <b>${G.mistakes}</b> <small style="font-weight:500">(${pen})</small></span><span>Hints <b>${G.hints}</b></span>`;
  const hc = $('#hc'); hc.hidden = !G.hints; hc.textContent = G.hints;
}
function setPaused(p) {
  if (!G || G.done) return; G.paused = p; G.last = performance.now();
  const wrap = $('.board-wrap'); if (!wrap) return;
  $('#bd').classList.toggle('paused', p); $('.pause')?.remove();
  if (p) { wrap.insertAdjacentHTML('beforeend', `<div class="pause"><button class="btn" data-act="resume">${ico(I.play, 'width="18" height="18" fill="currentColor"')}Resume</button></div>`); persist(); }
}
function act(a) {
  if (!G) return;
  if (a === 'back') { persist(); go('home'); }
  else if (a === 'pause') setPaused(!G.paused);
  else if (a === 'resume') setPaused(false);
  else if (a === 'help') { setPaused(true); howTo(); }
  else if (G.paused || G.done) return;
  else if (a === 'undo') { const u = G.undo.pop(); if (u) { G.cells[u.i] = u.v; paint(); persist(); } }
  else if (a === 'hint') hint();
  else if (a === 'clear') { if (G.cells.some(Boolean) && confirm('Clear the whole board? Your timer keeps running.')) { G.cells.fill(0); G.undo = []; paint(); persist(); } }
}
// empty -> ✕ note -> pet -> empty
function tap(i) {
  if (!G || G.paused || G.done) return;
  G.undo.push({ i, v: G.cells[i] });
  const v = (G.cells[i] + 1) % 3; G.cells[i] = v;
  if (v === 2) { G.pop = i; if (conflicts().has(i)) { G.mistakes++; buzz(60); } else buzz(12); }
  paint(); persist(); checkWin();
}
function hint() {
  const { n, solution, cells } = G;
  const r = solution.findIndex((c, row) => cells[row * n + c] !== 2); if (r < 0) return;
  const i = r * n + solution[r];
  for (let c = 0; c < n; c++) if (c !== solution[r] && cells[r * n + c] === 2) cells[r * n + c] = 0; // wrong pet in this row
  G.undo.push({ i, v: cells[i] }); cells[i] = 2; G.pop = i; G.hints++;
  toast(G.mode === 'level' ? 'Hint used · −75 pts' : 'Hint used · +30 s');
  paint(); persist(); checkWin();
}

async function checkWin() {
  const placed = G.cells.filter((v) => v === 2).length;
  if (placed !== G.n || conflicts().size) return;
  G.done = true; stopTimer(); paint();
  $$('.cell').forEach((c) => c.classList.add('win'));
  localStorage.removeItem(gKey(G.mode, G.date));
  const { mode, date, cfg } = G, r = scoreFor(mode, cfg, G);
  const rec = { score: r.score, sortKey: r.sortKey, adj: r.adj, stars: r.stars, ms: Math.round(G.ms), mistakes: G.mistakes, hints: G.hints, level: G.level, practice: G.practice };
  const h = hist(); (h[date] ||= {})[mode] = rec; saveHist(h);
  buzz([20, 40, 20]);
  if (!G.practice) {
    try {
      S.me = await S.be.submit(`${date}_${mode}`, { mode, date, level: G.level, score: r.score, sortKey: r.sortKey, adj: r.adj, ms: rec.ms, mistakes: rec.mistakes, hints: rec.hints, stars: r.stars, avatar: S.me.avatar || 0, at: Date.now() }, S.today);
    } catch (e) { toast(e.message === 'already' ? 'Already ranked for this puzzle' : 'Saved locally; could not reach the leaderboard'); }
  }
  setTimeout(() => resultSheet(mode, date, rec, false), 1100);
}

// ---------------- result + share ----------------
async function resultSheet(mode, date, d, fromHome) {
  const ranked = !d.practice && date === S.today;
  const s = sheet(`<div class="win">
      ${pet(S.me.avatar || 0, 'win-cat')}<h2>${fromHome ? 'Already solved' : 'Purr-fect!'}</h2>
      <div class="stars">${[1, 2, 3].map((n) => ico(I.star, `class="${n <= d.stars ? 'on' : ''}" style="animation-delay:${n * 120}ms"`)).join('')}</div>
      <p class="sub">${mode === 'level' ? 'Daily level' : 'Time attack'} ${d.level} · ${fmtDate(date)}${ranked ? '' : ' · practice'}</p>
      <div class="facts"><div><b>${mode === 'level' ? d.score : fmtTime(d.adj)}</b><span>${mode === 'level' ? 'points' : 'final time'}</span></div><div><b>${fmtTime(d.ms)}</b><span>solve time</span></div><div><b>${d.mistakes}/${d.hints}</b><span>slips / hints</span></div></div>
      <p class="sub" id="rk">${ranked ? 'Checking your rank…' : ''}</p>
      <div class="acts"><button class="btn" data-share>${ico(I.share, 'width="20" height="20" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')}Share result</button>
        <button class="btn ghost" data-lb>See leaderboard</button><button class="btn ghost" data-close data-home>Done</button></div></div>`);
  s.addEventListener('click', (e) => {
    if (e.target.closest('[data-share]')) share(date);
    if (e.target.closest('[data-lb]')) { s.remove(); S.rank.tab = mode; S.rank.date = date; go('ranks'); }
    if (e.target.closest('[data-home]')) go('home');
  });
  if (ranked) {
    try {
      const list = await S.be.board(`${date}_${mode}`), i = list.findIndex((u) => u.uid === S.me.uid);
      const el = $('#rk'); if (el) el.textContent = i >= 0 ? `You are #${i + 1} of ${list.length} today.` : 'Your result is saved.';
    } catch { /* offline */ }
  }
}
function shareText(date) {
  const h = hist()[date] || {}, lv = levelFor(date), paws = (n) => '🐾'.repeat(n);
  const l = [`🐾 Petdoku #${lv} · ${fmtDate(date)}`];
  if (h.level) l.push(`Level  ${paws(h.level.stars)}  ${h.level.score} pts · ${fmtTime(h.level.ms)} · ${h.level.mistakes} slips`);
  if (h.time) l.push(`Time   ${paws(h.time.stars)}  ${fmtTime(h.time.adj)}`);
  if (!h.level && !h.time) l.push('Not solved yet…');
  l.push(location.origin + '/');
  return l.join('\n');
}
async function share(date) {
  const text = shareText(date);
  try { if (navigator.share) return await navigator.share({ text }); } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Copied. Paste it anywhere!'); } catch { prompt('Copy your result:', text); }
}

// ---------------- how to play ----------------
const DEMO = { reg: [0, 0, 1, 1, 0, 2, 1, 1, 2, 2, 3, 3, 2, 2, 3, 3], sol: [1, 3, 0, 2] }; // 4×4 teaching board
const DEMO_PETS = DEMO.sol.map((c, r) => r * 4 + c);
function mini({ pets = [], bad = [], dim = new Set() } = {}) {
  const icon = S.me?.avatar || 0;
  const cells = DEMO.reg.map((g, i) =>
    `<div class="cell ${bad.includes(i) ? 'bad' : ''} ${dim.has(i) ? 'dim' : ''}" style="background:${COLORS[g]};--i:${i}">${pets.includes(i) ? pet(icon) : ''}</div>`).join('');
  return `<div class="board mini">${cells}</div>`;
}
const HOW = [
  { t: 'One pet in every colour', p: 'Each coloured region gets exactly one pet. Work out where each one belongs.',
    art: () => mini({ pets: DEMO_PETS }) },
  { t: 'One per row, one per column', p: 'No row or column may hold two pets. Here the highlighted row and column are already taken.',
    art: () => {
      const dim = new Set();
      for (let i = 0; i < 16; i++) if (((i / 4) | 0) !== 1 && i % 4 !== 3) dim.add(i);
      return mini({ pets: DEMO_PETS, dim });
    } },
  { t: 'No touching', p: 'Pets can’t sit next to each other, not even diagonally. Touching pets turn red.',
    art: () => mini({ pets: [1, 6], bad: [1, 6] }) },
  { t: 'Tap to play', p: 'Tap once for a ✕ to rule a tile out, twice for a pet, a third time to clear it.',
    art: () => {
      const t = (inner) => `<div class="cell" style="background:${COLORS[0]}">${inner}</div>`;
      return `<div class="cycle">${t('')}<b>›</b>${t(X_SVG)}<b>›</b>${t(pet(S.me?.avatar || 0))}</div>`;
    } },
];
function howTo() {
  if ($('.howto')) return;
  let i = 0;
  const el = document.createElement('div');
  el.className = 'howto'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'How to play');
  document.body.append(el);
  const draw = () => {
    const s = HOW[i], last = i === HOW.length - 1;
    el.innerHTML = `<button class="skip" data-skip>${last ? '' : 'Skip'}</button>
      <div class="hslide"><div class="art">${s.art()}</div><h2>${s.t}</h2><p>${s.p}</p></div>
      <div class="dots">${HOW.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn block" data-next>${last ? 'Let’s play' : 'Next'}</button>`;
  };
  const close = () => { ls.set('purr:seenHowTo', 1); el.remove(); };
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-skip]')) close();
    if (e.target.closest('[data-next]')) { if (i === HOW.length - 1) close(); else { i++; draw(); } }
  });
  draw();
}

if (location.search.includes('demo')) window.__game = () => G; // debug hook for demo mode only
boot();
