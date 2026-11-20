// One interface, two implementations: Firebase (Auth + Firestore) or a local-only demo store.
import { firebaseConfig, isConfigured, appCheck } from './firebase-config.js';

export const USERNAME_RE = /^[a-z0-9_]{3,16}$/;
const FB = 'https://www.gstatic.com/firebasejs/10.14.1';

const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};

function nextStats(profile, entry, today) {
  const yesterday = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 1); return d.toLocaleDateString('sv'); })();
  let streak = profile.streak || 0;
  if (profile.lastDate !== today) streak = profile.lastDate === yesterday ? streak + 1 : 1;
  return {
    streak, bestStreak: Math.max(profile.bestStreak || 0, streak), lastDate: today,
    totalPoints: (profile.totalPoints || 0) + entry.score, solved: (profile.solved || 0) + 1,
  };
}

// Records written by other players are untrusted input: anyone can write to Firestore with their own
// sign-in, bypassing this app. Everything read for display is rebuilt here from known fields with known
// types, so no stored value can reach the page as markup. (firestore.rules enforces the same shapes.)
const num = (v, lo, hi, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const int = (v, lo, hi, d = 0) => Math.round(num(v, lo, hi, d));
const name = (v) => (typeof v === 'string' && /^[a-z0-9_]{3,16}$/.test(v) ? v : 'player');
const id = (v) => (typeof v === 'string' ? v.slice(0, 128) : '');
export const cleanEntry = (e = {}) => ({
  uid: id(e.uid), username: name(e.username), avatar: int(e.avatar, 0, 8),
  score: int(e.score, 0, 1000), sortKey: num(e.sortKey, 0, 1e13), adj: num(e.adj, 0, 1e9), ms: int(e.ms, 0, 1e9),
  mistakes: int(e.mistakes, 0, 3), hints: int(e.hints, 0, 999), stars: int(e.stars, 1, 3, 1),
  ...(['easy', 'moderate', 'hard'].includes(e.diff) ? { diff: e.diff } : {}),
});
export const cleanUser = (u = {}) => ({
  uid: id(u.uid), username: name(u.username), avatar: int(u.avatar, 0, 8),
  streak: int(u.streak, 0, 1e5), bestStreak: int(u.bestStreak, 0, 1e5), totalPoints: int(u.totalPoints, 0, 1e9), solved: int(u.solved, 0, 1e6),
});

// ---------------- Local demo ----------------
function localBackend() {
  const users = () => ls.get('purr:users', {});
  let me = null;
  return {
    mode: 'local',
    async init() { me = ls.get('purr:me'); return me ? users()[me] || null : null; },
    async usernameAvailable(name) { return !Object.values(users()).some((u) => u.username === name); },
    async createProfile(username, avatar) {
      if (!(await this.usernameAvailable(username))) throw new Error('taken');
      const uid = 'local-' + Math.random().toString(36).slice(2, 10);
      const p = { uid, username, avatar, streak: 0, bestStreak: 0, totalPoints: 0, solved: 0, lastDate: null };
      const u = users(); u[uid] = p; ls.set('purr:users', u); ls.set('purr:me', uid); me = uid;
      return p;
    },
    async setAvatar(avatar) { const u = users(); u[me].avatar = avatar; ls.set('purr:users', u); return u[me]; },
    async submit(dayId, entry, today) {
      const key = 'purr:entries:' + dayId; const all = ls.get(key, {});
      if (all[me]) throw new Error('already');
      all[me] = { ...entry, uid: me, username: users()[me].username }; ls.set(key, all);
      const u = users(); u[me] = { ...u[me], ...nextStats(u[me], entry, today) }; ls.set('purr:users', u);
      return u[me];
    },
    async board(dayId) { return Object.values(ls.get('purr:entries:' + dayId, {})).map(cleanEntry).sort((a, b) => a.sortKey - b.sortKey).slice(0, 50); },
    async season() { return Object.values(users()).map(cleanUser).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 50); },
    async signOut() { ls.set('purr:me', null); me = null; },
  };
}

// ---------------- Firebase ----------------
// App Check attaches a short-lived proof to every Firestore request that it comes from this site.
// It must start before Auth and Firestore are used. On localhost it runs in debug mode: the browser
// console prints a debug token to register under App Check > Apps > Manage debug tokens.
async function startAppCheck(app) {
  if (!appCheck?.siteKey) return;
  try {
    const AC = await import(`${FB}/firebase-app-check.js`);
    if (['localhost', '127.0.0.1'].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    const provider = appCheck.provider === 'v3' ? new AC.ReCaptchaV3Provider(appCheck.siteKey) : new AC.ReCaptchaEnterpriseProvider(appCheck.siteKey);
    AC.initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  } catch (e) { console.warn('App Check could not start', e); }
}

async function firebaseBackend() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  await startAppCheck(app);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  let uid = null, profile = null;

  return {
    mode: 'firebase',
    async init() {
      uid = await new Promise((res, rej) => {
        const off = A.onAuthStateChanged(auth, async (u) => {
          off();
          if (u) return res(u.uid);
          try { res((await A.signInAnonymously(auth)).user.uid); } catch (e) { rej(e); }
        });
      });
      // A missing Firestore database makes reads hang, so fail loudly instead of spinning forever.
      const snap = await Promise.race([
        F.getDoc(F.doc(db, 'users', uid)),
        new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('Firestore not reachable'), { code: 'petdoku/firestore-unavailable' })), 10000)),
      ]);
      return (profile = snap.exists() ? snap.data() : null);
    },
    async usernameAvailable(name) { return !(await F.getDoc(F.doc(db, 'usernames', name))).exists(); },
    async createProfile(username, avatar) {
      const p = { uid, username, avatar, streak: 0, bestStreak: 0, totalPoints: 0, solved: 0, lastDate: null, createdAt: Date.now() };
      const b = F.writeBatch(db); // atomic: fails if the name is already claimed
      b.set(F.doc(db, 'usernames', username), { uid, createdAt: Date.now() });
      b.set(F.doc(db, 'users', uid), p);
      try { await b.commit(); } catch (e) { throw new Error('taken'); }
      return (profile = p);
    },
    async setAvatar(avatar) { await F.updateDoc(F.doc(db, 'users', uid), { avatar }); return (profile = { ...profile, avatar }); },
    async submit(dayId, entry, today) {
      const stats = { ...nextStats(profile, entry, today), lastGame: dayId }; // lastGame lets the rules tie these stats to the new entry
      const b = F.writeBatch(db); // entry is create-only, so a replay fails the whole batch
      b.set(F.doc(db, 'days', dayId, 'entries', uid), { ...entry, uid, username: profile.username });
      b.update(F.doc(db, 'users', uid), stats);
      try { await b.commit(); } catch (e) { throw new Error('already'); }
      return (profile = { ...profile, ...stats });
    },
    async board(dayId) {
      const q = F.query(F.collection(db, 'days', dayId, 'entries'), F.orderBy('sortKey'), F.limit(50));
      return (await F.getDocs(q)).docs.map((d) => cleanEntry(d.data()));
    },
    async season() {
      const q = F.query(F.collection(db, 'users'), F.orderBy('totalPoints', 'desc'), F.limit(50));
      return (await F.getDocs(q)).docs.map((d) => cleanUser(d.data()));
    },
    async signOut() { await A.signOut(auth); },
  };
}

export async function createBackend() {
  if (!isConfigured || new URLSearchParams(location.search).has('demo')) return localBackend(); // ?demo forces offline mode
  try { return await firebaseBackend(); } catch (e) { console.warn('Firebase unavailable, using local demo', e); return localBackend(); }
}
export { ls };
