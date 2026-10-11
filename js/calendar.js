// Flexible weekly calendar. The week is rebuilt from state every time: past days show what was done,
// today and later days get the next open steps, placed by simple safety rules. Missed sessions never
// pile up because the plan always restarts from today. Pure functions.
import { DAY, dayKey, weekKey, activeTrack, trackSteps, prepBlocksRun } from './engine.js';
import { hasTri } from './tri.js';
import { hasHybrid } from './hybrid.js';

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_DAYS = { 2: [1, 5], 3: [0, 2, 5], 4: [0, 2, 4, 5], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

export function defaultDays(perWeek) { return DEFAULT_DAYS[Math.min(6, Math.max(2, perWeek || 3))]; }
export const dayIndex = ts => (new Date(ts).getDay() + 6) % 7; // Mon = 0
const mondayOf = ts => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayIndex(ts)).getTime(); };
const dateOf = (monday, i) => { const d = new Date(monday); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + i).getTime(); };

export function schedule(s) {
  const days = s.profile.days?.length ? [...s.profile.days].sort((a, b) => a - b) : defaultDays(s.profile.daysPerWeek);
  const longDay = days.includes(s.profile.longDay) ? s.profile.longDay : days.includes(5) ? 5 : days.at(-1);
  return { days, longDay };
}

// What kind of load a step puts on the body.
export function classify(step, prepLevel = 0) {
  if (step.type === 'gate' || step.type === 'proveit') return 'test';
  if (step.type === 'prep' || step.type === 'slot') return prepLevel >= 3 ? 'impact' : 'strength';
  const t = `${step.title} ${step.detail || ''}`.toLowerCase();
  if (step.type === 'swim') return 'swim';
  if (step.type === 'lift' || (step.type === 'maint' && /squat|deadlift|lunge|sled|lift/.test(t) && !/deload/.test(t))) return /squat|deadlift|lunge|sled|carry|full body|lower/.test(t) ? 'strength' : 'upper';
  if (step.type === 'engine' || step.type === 'maint') return /deload|easy 30 min \+ mobility|mobility and easy/.test(t) ? 'easy' : /threshold|interval|race|simulation|vo2|emom|x \(|splits/.test(t) ? 'hard' : /long|60-75|45 min/.test(t) ? 'long' : 'easy';
  if (step.type === 'bike') return /long ride|brick|\b(5|6|9|10|12)0 km/.test(t) ? 'long' : /threshold|ftp|race effort/.test(t) ? 'hard' : 'bike';
  if (/long run|long easy|time on feet|back-to-back|long run/.test(t)) return 'long';
  if (/tempo|interval|hill|pace|timed|x 1 km|hard/.test(t)) return 'hard'; // strides alone stay easy
  return 'easy';
}
const HARD = new Set(['test', 'long', 'hard', 'impact']);

// Next open steps, in order: a run-level Prep slot becomes the next open Prep Track step.
function candidates(s) {
  const track = activeTrack(s);
  const steps = trackSteps(s, track);
  const prepOpen = track === 'rebuild' ? [] : trackSteps(s, 'prep').filter(p => p.status === 'open');
  let prepI = 0;
  const out = [];
  for (const st of steps) {
    if (st.type === 'rest') continue;
    if (st.status === 'slot') {
      const p = prepOpen[prepI++];
      if (p) out.push({ track: 'prep', level: s.prep.level, ...p });
      continue;
    }
    if (st.status === 'open') out.push({ track, level: levelOf(s, track), ...st });
  }
  // Prep steps not tied to a slot still count as optional extras.
  const extras = [];
  for (; prepI < prepOpen.length; prepI++) extras.push({ track: 'prep', level: s.prep.level, ...prepOpen[prepI], extra: true });
  if (!hasTri(s) && !hasHybrid(s)) return [...out, ...extras];

  // Several tracks: one queue per kind of session, mixed by a weekly pattern.
  const lane = (t, lvl) => trackSteps(s, t).filter(st => st.status === 'open').map(st => ({ track: t, level: lvl, ...st }));
  // A Hybrid deload week is light everywhere: only easy runs and Prep, no hard or long sessions.
  const deload = hasHybrid(s) && s.hybrid.block.type === 'deload';
  const queues = { run: deload ? out.filter(x => !['hard', 'test', 'long'].includes(classify(x, s.prep.level))) : out };
  const gates = [];
  if (hasTri(s)) { queues.swim = lane('swim', s.tri.swim.stage); queues.bike = lane('bike', s.tri.bike.stage); gates.push(...lane('triGate', s.tri.world)); }
  if (hasHybrid(s)) {
    queues.strength = lane('strength', s.hybrid.strength.stage);
    queues.engine = lane('engine', s.hybrid.engine.stage);
    queues.maint = lane('hyMaint', s.hybrid.maint.week);
    gates.push(...lane('hyGate', s.hybrid.world));
  }
  const pattern = weekPattern(s);
  const mixed = [];
  for (let i = 0; Object.values(queues).some(q => q.length) && i < 80; i++) {
    const q = queues[pattern[i % pattern.length]];
    if (q?.length) mixed.push(q.shift());
  }
  for (const q of Object.values(queues)) mixed.push(...q); // anything the pattern didn't reach
  return [...gates, ...mixed, ...extras];
}

// The main track sets the rhythm; other tracks slot in after every two of its sessions.
export function weekPattern(s) {
  const hyb = () => {
    const t = s.hybrid.block.type;
    return t === 'deload' ? ['maint', 'run', 'maint', 'maint'] : t === 'engine' ? ['engine', 'maint', 'run', 'engine', 'maint', 'run'] : ['strength', 'run', 'strength', 'maint', 'strength', 'run'];
  };
  const BASE = { run: () => ['run'], tri: () => ['swim', 'bike', 'run'], hybrid: hyb };
  const tracks = (s.profile.tracks || ['run']).filter(t => t === 'run' || (t === 'tri' && hasTri(s)) || (t === 'hybrid' && hasHybrid(s)));
  const primary = tracks.includes(s.profile.primary) ? s.profile.primary : tracks[0] || 'run';
  const main = BASE[primary]();
  const others = tracks.filter(t => t !== primary && t !== 'run').flatMap(t => BASE[t]().filter(k => k !== 'run'));
  if (!others.length) return main;
  const out = [];
  let o = 0;
  main.forEach((k, i) => { out.push(k); if (i % 2 === 1) out.push(others[o++ % others.length]); });
  return out;
}
const levelOf = (s, track) => (track === 'run' ? s.run.level : track === 'prep' ? s.prep.level : track === 'rebuild' ? s.rebuild.stage : 'refresher');
// (swim / bike / triGate items carry their own level from candidates)
export const itemKey = it => `${it.track}:${it.level}:${it.idx}`;

export function warningsFor(byDay) {
  const out = [];
  for (let d = 0; d < 7; d++) {
    const today = byDay[d].filter(x => !x.done), next = byDay[d + 1]?.filter(x => !x.done) || [];
    const hardToday = today.find(x => HARD.has(x.cls) && x.cls !== 'impact');
    const hardNext = next.find(x => HARD.has(x.cls) && x.cls !== 'impact');
    if (hardToday && hardNext) out.push({ day: d + 1, text: `Two hard days in a row (${DAY_NAMES[d]} and ${DAY_NAMES[d + 1]}). An easy day between helps you recover.` });
    const legs = today.find(x => x.cls === 'strength' || x.cls === 'impact');
    if (legs && hardNext) out.push({ day: d, text: `Leg work on ${DAY_NAMES[d]} is the day before a key session. Move one of them if you can.` });
    if (today.filter(x => HARD.has(x.cls)).length > 1) out.push({ day: d, text: `Two demanding sessions on ${DAY_NAMES[d]}. Spread them out if you can.` });
  }
  return out;
}

// Build the week containing `now`. `skip`: item keys already planned elsewhere (e.g. the rest of this
// week, when previewing next week), so nothing shows twice.
export function buildWeek(s, now, { skip } = {}) {
  const monday = mondayOf(now);
  const wk = weekKey(now);
  const today = dayIndex(now);
  const { days, longDay } = schedule(s);
  const byDay = Array.from({ length: 7 }, () => []);
  const mode = s.mode || null;

  // Past: what was actually done this week.
  for (const h of s.history) {
    // A failed attempt still used the day: nothing else is planned on it.
    if ((h.kind !== 'session' && h.kind !== 'attempt') || h.ts < monday || weekKey(h.ts) !== wk) continue;
    byDay[dayIndex(h.ts)].push({ title: h.title, track: h.track, done: true, xp: h.xp, cls: 'done', ...(h.partial ? { partial: true } : {}), ...(h.kind === 'attempt' ? { attempt: true } : {}) });
  }

  // Free slots from today on: available days with nothing done yet.
  const slots = [];
  for (let d = today; d < 7; d++) if (days.includes(d) && !byDay[d].some(x => x.done)) slots.push(d);

  const notes = [];
  if (mode?.type === 'sick') {
    for (const d of slots) {
      if (mode.where === 'above') byDay[d].push({ title: 'Optional: easy 20 min walk or gentle mobility', cls: 'easy', optional: true, sick: true });
      else byDay[d].push({ title: 'Rest and recover', cls: 'rest', sick: true });
    }
    notes.push(mode.where === 'above' ? 'Symptoms above the neck: only easy movement, and only if you feel like it.' : 'Fever or symptoms below the neck: full rest. Training waits, nothing is lost.');
    return { weekKey: wk, monday, today, days: frame(byDay, monday, today, days), warnings: [], notes, mode };
  }

  let list = candidates(s);
  if (skip?.size) list = list.filter(it => !skip.has(itemKey(it)));
  const moves = s.calendar?.moves?.[wk] || {};
  const blocked = prepBlocksRun(s) != null;
  list = list.map(it => ({ ...it, cls: classify(it, s.prep.level), key: itemKey(it) }));

  // Main sessions (not extra prep) fill the slots first; extras only if slots are left.
  const main = list.filter(x => !x.extra), extra = list.filter(x => x.extra);
  const take = [...main, ...extra].slice(0, slots.length);
  const free = new Set(slots);
  const placed = [];
  const hardDays = () => placed.filter(p => HARD.has(p.it.cls) && p.it.cls !== 'impact').map(p => p.d);
  const put = (it, d) => { free.delete(d); placed.push({ it, d }); };
  const far = (cands, avoid) => cands.sort((a, b) => Math.min(...avoid.map(x => Math.abs(x - b)), 9) - Math.min(...avoid.map(x => Math.abs(x - a)), 9))[0];

  // Moved items keep the day the athlete chose.
  for (const it of take) if (moves[it.key] != null && moves[it.key] >= today) put(it, moves[it.key]);
  const rest = take.filter(it => !placed.some(p => p.it === it));
  for (const it of rest.filter(x => x.cls === 'long')) put(it, free.has(longDay) ? longDay : [...free].at(-1) ?? slots.at(-1));
  for (const it of rest.filter(x => x.cls === 'test')) { const f = [...free]; put(it, far(f.length ? f : slots, hardDays().filter(d => d !== undefined))); }
  for (const it of rest.filter(x => x.cls === 'hard')) { const f = [...free]; put(it, far(f.length ? f : slots, hardDays())); }
  for (const it of rest.filter(x => x.cls === 'strength' || x.cls === 'impact')) {
    const f = [...free];
    const ok = f.filter(d => !hardDays().includes(d + 1));
    put(it, (ok.length ? ok : f)[0] ?? slots[0]);
  }
  // Swims and easy rides spread between the harder days; everything else fills what's left.
  for (const it of rest.filter(x => x.cls === 'swim' || x.cls === 'bike')) { const f = [...free]; put(it, far(f.length ? f : slots, placed.filter(p => p.it.track === it.track).map(p => p.d)) ?? slots[0]); }
  for (const it of rest.filter(x => !placed.some(p => p.it === x))) { const f = [...free]; put(it, f[0] ?? slots[0]); }

  let keyCount = 0;
  for (const { it, d } of placed.sort((a, b) => a.d - b.d)) {
    const keySession = HARD.has(it.cls) && it.cls !== 'impact' || (it.track === 'prep' && blocked) || (it.track !== 'prep' && keyCount === 0);
    if (keySession) keyCount++;
    const optional = !keySession && (it.extra || mode?.type === 'busy');
    if (mode?.type === 'busy' && optional) continue;
    byDay[d].push({ ...it, keySession, optional, moved: moves[it.key] != null });
  }
  if (mode?.type === 'busy') notes.push('Busy week: only Key sessions are planned. Short 20-minute versions still count.');
  const left = list.length - take.length;
  if (!slots.length) notes.push('No training days left this week. Next week picks up from here.');
  return { weekKey: wk, monday, today, days: frame(byDay, monday, today, days), warnings: warningsFor(byDay), notes, mode, left };
}

// A rolling view around today: `back` days before, today, and `ahead` days after, across week
// boundaries. Earlier weeks show what was done; next week is a preview of what comes after this one.
export function buildWindow(s, now, back = 2, ahead = 4) {
  const w = buildWeek(s, now);
  const planned = new Set(w.days.slice(w.today).flatMap(d => d.items.filter(i => !i.done && i.key).map(i => i.key)));
  const next = buildWeek(s, dateOf(w.monday, 7) + 6 * 36e5, { skip: planned });
  const prev = buildWeek(s, dateOf(w.monday, -7) + 6 * 36e5);
  const all = [
    ...prev.days.map(d => ({ ...d, items: d.items.filter(i => i.done), past: true, today: false, week: 'prev' })),
    ...w.days.map(d => ({ ...d, week: 'this' })),
    ...next.days.map(d => ({ ...d, past: false, today: false, week: 'next' })),
  ];
  const at = 7 + w.today;
  return { days: all.slice(at - back, at + ahead + 1), week: w, next };
}

function frame(byDay, monday, today, avail) {
  return byDay.map((items, i) => ({ i, name: DAY_NAMES[i], date: dateOf(monday, i), today: i === today, past: i < today, available: avail.includes(i), items }));
}

// Move one planned item to another day this week (today or later).
export function moveItem(state, key, day, now) {
  const s = JSON.parse(JSON.stringify(state));
  const wk = weekKey(now);
  s.calendar ||= { moves: {} };
  s.calendar.moves = { [wk]: { ...(s.calendar.moves?.[wk] || {}), [key]: day } }; // keep only this week
  return s;
}

// Preview the warnings a move would cause, without changing state.
export function previewMove(state, key, day, now) {
  return buildWeek(moveItem(state, key, day, now), now).warnings;
}

export function setSchedule(state, days, longDay) {
  const s = JSON.parse(JSON.stringify(state));
  const sorted = [...new Set(days)].filter(d => d >= 0 && d < 7).sort((a, b) => a - b);
  s.profile.days = sorted;
  s.profile.daysPerWeek = Math.max(2, Math.min(6, sorted.length));
  s.profile.longDay = sorted.includes(longDay) ? longDay : sorted.includes(5) ? 5 : sorted.at(-1);
  return s;
}

export { DAY, dayKey };
