// Challenges and friends, shared through links (no server). Each link carries a small JSON payload
// in the URL hash: an invite (f), a challenge (c) or a result (r). Pure functions, testable in Node.
import { runLevel } from './engine.js';

// Each option is [value, the Run level it suits].
export const TEMPLATES = {
  distance: { icon: '🏃', name: 'Distance run', title: v => `Run ${v} km in one go`, opts: [[3, 3], [5, 4], [10, 7], [15, 8], [21.1, 9], [42.2, 11]] },
  weekRuns: { icon: '📅', name: 'Consistency', title: (v, d) => `${v} runs in ${d} days`, opts: [[2, 1], [3, 2], [4, 4], [5, 6]] },
  weekKm: { icon: '📏', name: 'Volume', title: (v, d) => `${v} km in ${d} days`, opts: [[10, 3], [20, 5], [30, 7], [50, 10], [70, 11]] },
  time5k: { icon: '⏱️', name: '5K time', title: v => `5K in under ${v} min`, opts: [[40, 4], [35, 5], [30, 6], [25, 8], [22, 10], [20, 12]] },
  streak: { icon: '🔥', name: 'Streak', title: v => `Active ${v} days in a row`, opts: [[3, 1], [7, 1], [14, 2], [30, 3]], noImpact: true },
  prep: { icon: '🧱', name: 'Prep sessions', title: (v, d) => `${v} Prep sessions in ${d} days`, opts: [[2, 1], [3, 1], [4, 2]], noImpact: true },
  plank: { icon: '🧘', name: 'Plank', title: v => `Hold a plank for ${v}s`, opts: [[30, 1], [60, 2], [90, 4], [120, 6]], noImpact: true },
};
export const DAY_OPTIONS = [3, 7, 14, 30];

export const challengeTitle = (c, p = c.p, tpl = c.tpl) => TEMPLATES[tpl].title(TEMPLATES[tpl].opts[p][0], c.days);
export const challengeLevel = (c, p = c.p) => TEMPLATES[c.tpl].opts[p][1];
export const versionTitle = (c, v) => challengeTitle(c, v.p, v.tpl);

// When even the smallest version is too big, switch to a related challenge that fits.
const FALLBACK = { distance: ['weekRuns', 'streak'], weekKm: ['weekRuns', 'streak'], time5k: ['distance', 'weekRuns', 'streak'], weekRuns: ['streak'], prep: ['streak'], plank: ['streak'], streak: [] };

// The biggest version that suits `level`: { tpl, p }, or null when the challenge already fits.
export function scaledFor(c, level) {
  if (TEMPLATES[c.tpl].opts[c.p][1] <= level) return null;
  const bestIn = (tpl, below = Infinity) => {
    let best = -1;
    TEMPLATES[tpl].opts.forEach(([, l], i) => { if (l <= level && i < below) best = i; });
    return best;
  };
  const own = bestIn(c.tpl, c.p);
  if (own >= 0) return { tpl: c.tpl, p: own };
  for (const tpl of FALLBACK[c.tpl]) { const i = bestIn(tpl); if (i >= 0) return { tpl, p: i }; }
  return { tpl: 'streak', p: 0 };
}

// How a challenge fits a runner: ready | stretch | big | way | rebuild | paused
export function fit(c, who) {
  const tpl = TEMPLATES[c.tpl];
  if (who.redFlag && !tpl.noImpact) return 'paused';
  if (who.rebuild && !tpl.noImpact) return 'rebuild';
  const diff = challengeLevel(c) - who.level;
  if (diff <= 0) return 'ready';
  if (diff === 1) return 'stretch';
  if (diff <= 3) return 'big';
  return 'way';
}

const lvlName = n => `Level ${n} (${runLevel(n).name})`;

// Message to the person who received the challenge.
export function fitMessageForMe(c, who) {
  const f = fit(c, who);
  const L = challengeLevel(c);
  const sp = scaledFor(c, who.level);
  const scaled = sp ? `“${versionTitle(c, sp)}”` : 'a smaller version';
  const from = c.from?.name || 'Your friend';
  return {
    fit: f,
    text: {
      ready: 'Right in your zone 💪 You have everything you need for this one.',
      stretch: 'A nice stretch, just one level above where you are. Perfect for growing.',
      big: `Big stretch! This is ${lvlName(L)} territory and you're on Level ${who.level}. You can chase it, but ${scaled} is the one you can win this week.`,
      way: `Whoa, ${from} dreams big! This is ${lvlName(L)} territory and you're on Level ${who.level}. That's not a “no”, it's a “not yet”. Take ${scaled} today, and save the big one as a goal: every level you clear brings it closer.`,
      rebuild: "You're on the Rebuild Track, so running challenges wait for now. Save it and it'll be right here when you're back on your feet.",
      paused: 'Running is paused until a professional clears you. Save this one for later. Your friends will still be here!',
    }[f],
    scaled: f === 'big' || f === 'way' ? sp : null,
  };
}

// Message to the sender, about the friend they picked (or anyone).
export function fitMessageForSender(c, friend, me) {
  const L = challengeLevel(c);
  const notes = [];
  if (friend) {
    const f = fit(c, friend);
    const sp = scaledFor(c, friend.level);
    const scaled = sp ? `“${versionTitle(c, sp)}”` : 'a smaller version';
    notes.push({
      fit: f,
      scaled: f === 'way' || f === 'big' ? sp : null,
      text: {
        ready: `Great fit for ${friend.name}: right at their level.`,
        stretch: `A nice stretch for ${friend.name}, one level up. Good pick.`,
        big: `Heads up: ${friend.name} is on Level ${friend.level}, and this is ${lvlName(L)} territory. They'll also be offered ${scaled}, which they can win now.`,
        way: `${friend.name} is on Level ${friend.level}, and this is ${lvlName(L)} territory: way above for now. They'll get ${scaled} to win today, and can save the big one as a goal. Want to send the scaled one instead?`,
        rebuild: `${friend.name} is on the Rebuild Track, so they'll save running challenges for later. A no-impact one (streak, Prep, plank) works now.`,
        paused: `${friend.name} has running paused for now. A plank, streak or Prep challenge is a kind alternative.`,
      }[f],
    });
  } else {
    notes.push({ fit: 'anyone', text: 'Anyone with the link can join. Each person sees how it fits their own level, and gets a scaled version if it is a big jump.' });
  }
  if (me && L - me.level >= 2) notes.push({ fit: 'self', text: `This is above your own level too (${lvlName(L)}). Bold! Send it as a goal you chase together.` });
  return notes;
}

// ---------- links ----------
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function encodeLink(base, payload) { return `${base}#sq=${b64(JSON.stringify(payload))}`; }
export function decodeHash(hash) {
  const m = /[#&]sq=([A-Za-z0-9_-]+)/.exec(hash || '');
  if (!m) return null;
  try {
    const p = JSON.parse(unb64(m[1]));
    if (!p || !['f', 'c', 'r'].includes(p.t) || !p.from?.id) return null;
    if (p.t === 'c' && (!TEMPLATES[p.tpl] || !TEMPLATES[p.tpl].opts[p.p] || !DAY_OPTIONS.includes(p.days))) return null;
    return p;
  } catch { return null; }
}

// ---------- state ----------
const clone = s => JSON.parse(JSON.stringify(s));
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function ensureSocial(s) {
  if (!s.id) s.id = uid();
  s.friends ||= {};
  s.challenges ||= { received: [], sent: [] };
  return s;
}

export function me(s) {
  return { id: s.id, name: s.profile.name || 'A runner', level: s.run.level, prep: s.prep.level, rebuild: !!s.rebuild.active, redFlag: !!s.rebuild.redFlag };
}

const clean = (v, n) => String(v ?? '').replace(/[<>]/g, '').slice(0, n);

export function addFriend(state, person, now) {
  const s = ensureSocial(clone(state));
  if (!person?.id || person.id === s.id) return s;
  const prev = s.friends[person.id] || {};
  s.friends[person.id] = {
    id: person.id, name: clean(person.name, 30) || prev.name || 'Runner',
    level: Math.min(13, Math.max(1, parseInt(person.level, 10) || prev.level || 1)),
    prep: Math.min(7, Math.max(0, parseInt(person.prep, 10) || 0)),
    rebuild: !!person.rebuild, redFlag: !!person.redFlag,
    since: prev.since || now, updated: now,
  };
  return s;
}

export function newChallenge(s, { tpl, p, days, msg, to }, now) {
  return { t: 'c', id: uid(), tpl, p, days, msg: clean(msg, 140), from: me(s), to: to ? { id: to.id, name: to.name } : null, created: now };
}

export function recordSent(state, c) {
  const s = ensureSocial(clone(state));
  s.challenges.sent.unshift({ ...c, results: [] });
  return s;
}

// choice: 'original' | 'scaled' | 'later' | 'decline'; scaled = { tpl, p } from scaledFor
export function receive(state, c, choice, scaled, now) {
  let s = addFriend(state, c.from, now);
  if (choice === 'decline') return s;
  s.challenges.received = s.challenges.received.filter(x => x.id !== c.id);
  const v = choice === 'scaled' && scaled ? scaled : { tpl: c.tpl, p: c.p };
  s.challenges.received.unshift({
    id: c.id, tpl: v.tpl, p: v.p, scaled: v.tpl !== c.tpl || v.p !== c.p, originalTitle: challengeTitle(c),
    days: c.days, msg: clean(c.msg, 140), from: c.from,
    status: choice === 'later' ? 'later' : 'active', acceptedAt: now, due: now + c.days * 864e5,
  });
  return s;
}

export function startSaved(state, id, now) {
  const s = clone(state);
  const c = s.challenges.received.find(x => x.id === id);
  if (c) { c.status = 'active'; c.acceptedAt = now; c.due = now + c.days * 864e5; }
  return s;
}

export const CHALLENGE_XP = 25;
export function completeReceived(state, id, now) {
  const s = clone(state);
  const c = s.challenges.received.find(x => x.id === id);
  if (!c || c.status === 'done') return s;
  c.status = 'done';
  c.doneAt = now;
  s.xp += CHALLENGE_XP;
  s.history.push({ ts: now, kind: 'challenge', title: `Challenge done: ${challengeTitle(c)}`, xp: CHALLENGE_XP });
  if (!s.badges.challenger) s.badges.challenger = now;
  return s;
}

export function dropReceived(state, id) {
  const s = clone(state);
  s.challenges.received = s.challenges.received.filter(x => x.id !== id);
  return s;
}

export function resultPayload(s, c) {
  return { t: 'r', cid: c.id, title: challengeTitle(c), scaled: !!c.scaled, from: me(s), ts: Date.now() };
}

export function applyResult(state, r, now) {
  const s = addFriend(state, r.from, now);
  const sent = s.challenges.sent.find(x => x.id === r.cid);
  if (sent && !sent.results.some(x => x.by === r.from.id)) sent.results.push({ by: r.from.id, name: clean(r.from.name, 30), scaled: !!r.scaled, title: clean(r.title, 80), ts: now });
  return { state: s, matched: !!sent };
}

// Automatic progress for the countable challenges, from the runner's own log.
export function progress(s, c, now) {
  const since = c.acceptedAt;
  const [v] = TEMPLATES[c.tpl].opts[c.p];
  const sessions = s.history.filter(h => h.kind === 'session' && h.ts >= since);
  if (c.tpl === 'weekRuns') return { have: sessions.filter(h => h.track !== 'prep' && !/^Prep/.test(h.title || '')).length, need: v };
  if (c.tpl === 'prep') return { have: sessions.filter(h => h.track === 'prep').length, need: v };
  return null;
}
