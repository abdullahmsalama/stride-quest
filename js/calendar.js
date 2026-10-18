// Flexible weekly calendar. The week is rebuilt from state every time: past days show what was done,
// today and later days get the next open steps, placed by simple safety rules. Missed sessions never
// pile up because the plan always restarts from today. Pure functions.
import { DAY, dayKey, weekKey, activeTrack, trackSteps, prepBlocksRun } from './engine.js';
import { legDays } from './data/other.js';
import { hasTri } from './tri.js';
import { hasHybrid } from './hybrid.js';
import { hasGym, hasRunning, gymDays, gymOnly } from './gym.js';
import { phase as racePhase } from './target.js';

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
  if (step.type === 'lift' && step.gym) return step.legs ? 'strength' : 'upper'; // a gym session: heavy legs or not
  if (step.type === 'lift' || (step.type === 'maint' && /squat|deadlift|lunge|sled|lift/.test(t) && !/deload/.test(t))) return /squat|deadlift|lunge|sled|carry|full body|lower/.test(t) ? 'strength' : 'upper';
  if (step.type === 'engine' || step.type === 'maint') return /deload|easy 30 min \+ mobility|mobility and easy/.test(t) ? 'easy' : /threshold|interval|race|simulation|vo2|emom|x \(|splits/.test(t) ? 'hard' : /long|60-75|45 min/.test(t) ? 'long' : 'easy';
  if (step.type === 'bike') return /long ride|brick|\b(5|6|9|10|12)0 km/.test(t) ? 'long' : /threshold|ftp|race effort/.test(t) ? 'hard' : 'bike';
  // Runs: judged on the title only (hints like "easy, conversational pace" or "hills unlock at P4" aren't the session).
  const tt = String(step.title || '').toLowerCase();
  if (/long run|long easy|time on feet|back-to-back/.test(tt)) return 'long';
  if (/^(easy|walk)|jog \/|\/ \d+ min walk|walk break/.test(tt)) return 'easy';
  if (/tempo|interval|hill|(race|goal|threshold|marathon|10k|5k|half-marathon) pace|timed|x \d+(\.\d+)? ?(km|m)\b|hard/.test(tt)) return 'hard'; // strides alone stay easy
  return 'easy';
}
const HARD = new Set(['test', 'long', 'hard', 'impact']);

// Next open steps, in order: a run-level Prep slot becomes the next open Prep Track step.
function candidates(s, now = Date.now()) {
  const track = activeTrack(s);
  const steps = trackSteps(s, track);
  // No Prep (jumps, landings) while rebuilding or during the comeback checks after illness or a break.
  // Gym only: no running, so no run or Prep sessions either.
  const runs = hasRunning(s);
  const prepOpen = !runs || track === 'rebuild' || track === 'refresher' ? [] : trackSteps(s, 'prep').filter(p => p.status === 'open');
  let prepI = 0;
  const out = [];
  for (const st of runs ? steps : []) {
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
  if (!hasTri(s) && !hasHybrid(s) && !hasGym(s)) return [...out, ...extras];

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
  if (hasGym(s)) queues.gym = lane('gym', s.gym.stage);
  // The week's pattern, minus what's already been done this week, so one sport doesn't take every day.
  const pattern = weekPattern(s), wk = weekKey(now), KEY = { hyMaint: 'maint' };
  const doneThisWeek = (s.history || []).filter(h => h.kind === 'session' && weekKey(h.ts) === wk).map(h => KEY[h.track] || h.track);
  const first = [...pattern];
  for (const k of doneThisWeek) { const i = first.indexOf(k); if (i >= 0) first.splice(i, 1); }
  const order = [...first, ...Array(80).fill(0).flatMap(() => pattern)].slice(0, 80);
  const mixed = [];
  for (let i = 0; Object.values(queues).some(q => q.length) && i < 80; i++) {
    const q = queues[order[i]];
    if (q?.length) mixed.push(q.shift());
  }
  for (const q of Object.values(queues)) mixed.push(...q); // anything the pattern didn't reach
  // A race boss (a real race: Hyrox, Alpha X, a triathlon) isn't a session on a random day: it lives on the map
  // and in competition mode, where the athlete picks the race and its date.
  return [...gates.filter(g => !g.boss || /simulation/i.test(g.title) && !/race\b/i.test(g.title.replace(/race or simulation/i, ''))), ...mixed, ...extras];
}

// The main track sets the rhythm; other tracks slot in after every two of its sessions.
export function weekPattern(s) {
  const hyb = () => {
    const t = s.hybrid.block.type;
    if (t === 'strength' && s.hybrid.split?.days) { // their chosen number of strength days, spread evenly
      const D = schedule(s).days.length, n = Math.min(s.hybrid.split.days, D), at = new Set([...Array(n).keys()].map(k => Math.floor((k * D) / n)));
      const fill = ['run', 'maint', 'run', 'run', 'maint', 'run'];
      let o = 0;
      return [...Array(D).keys()].map(i => (at.has(i) ? 'strength' : fill[o++ % fill.length]));
    }
    return t === 'deload' ? ['maint', 'run', 'maint', 'maint'] : t === 'engine' ? ['engine', 'maint', 'run', 'engine', 'maint', 'run'] : ['strength', 'run', 'strength', 'maint', 'strength', 'run'];
  };
  const BASE = { run: () => ['run', 'run'], tri: () => ['swim', 'bike', 'run'], hybrid: hyb };
  const all = (s.profile.tracks || ['run']).filter(t => t === 'run' || (t === 'tri' && hasTri(s)) || (t === 'hybrid' && hasHybrid(s)) || (t === 'gym' && hasGym(s)));
  if (all.includes('gym')) { // gym days spread evenly through the week; the other sports fill the rest
    const rest = all.length > 1 ? weekPattern({ ...s, profile: { ...s.profile, tracks: all.filter(t => t !== 'gym'), primary: s.profile.primary === 'gym' ? undefined : s.profile.primary } }) : [];
    if (!rest.length) return ['gym'];
    const D = schedule(s).days.length, n = Math.min(gymDays(s), Math.max(1, D - 1)), at = new Set([...Array(n).keys()].map(k => Math.floor((k * D) / n)));
    let o = 0;
    return [...Array(D).keys()].map(i => (at.has(i) ? 'gym' : rest[o++ % rest.length]));
  }
  const tracks = all;
  const primary = tracks.includes(s.profile.primary) ? s.profile.primary : tracks[0] || 'run';
  const main = BASE[primary]();
  if (primary !== 'run' && tracks.includes('run') && tracks.length === 2) main.splice(Math.ceil(main.length / 2), 0, 'run'); // they chose Run too: keep more runs
  const others = tracks.filter(t => t !== primary && t !== 'run').flatMap(t => BASE[t]().filter(k => k !== 'run'));
  if (!others.length) return primary === 'run' ? ['run'] : main;
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
    byDay[dayIndex(h.ts)].push({ title: h.title, track: h.track, done: true, ts: h.ts, xp: h.xp, cls: 'done', ...(h.partial ? { partial: true } : {}), ...(h.kind === 'attempt' ? { attempt: true } : {}) });
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

  let list = candidates(s, now);
  if (skip?.size) list = list.filter(it => !skip.has(itemKey(it)));
  const moves = s.calendar?.moves?.[wk] || {};
  const blocked = prepBlocksRun(s) != null;
  list = list.map(it => ({ ...it, cls: classify(it, s.prep.level), key: itemKey(it) }));

  // Main sessions (not extra prep) fill the slots first; extras only if slots are left.
  // The long session comes first (a missed easy run never pushes it out), and a session moved to a
  // non-training day doesn't use up one of the training days.
  let main0 = list.filter(x => !x.extra), extra = list.filter(x => x.extra);
  // Prep (strength, landings, jumps) is added to a run day rather than taking one, when there are
  // enough sessions to fill the training days: running volume isn't cut to make room for it.
  let addOns = [];
  const nonPrep = main0.filter(x => x.track !== 'prep');
  if (!blocked && nonPrep.length >= slots.length && slots.length) { addOns = main0.filter(x => x.track === 'prep').slice(0, 2); main0 = nonPrep; extra = []; }
  const long1 = main0.find(x => x.cls === 'long');
  const main = long1 ? [long1, ...main0.filter(x => x !== long1)] : main0;
  const movedOff = [...main, ...extra].filter(it => moves[it.key] != null && moves[it.key] >= today && !slots.includes(moves[it.key]));
  const take = [...movedOff, ...[...main, ...extra].filter(it => !movedOff.includes(it)).slice(0, slots.length)];
  const free = new Set(slots);
  const placed = [];
  // Heavy outside sessions (gym, football, padel, cycling): hard runs stay off that day (strongly) and the
  // day after (mildly); when the week is full, the least bad day wins.
  const outside = legDays(s.otherTraining);
  const hardDays = () => placed.filter(p => HARD.has(p.it.cls) && p.it.cls !== 'impact').map(p => p.d);
  const put = (it, d) => { free.delete(d); placed.push({ it, d }); };
  const score = (d, avoid) => Math.min(...avoid.map(x => Math.abs(x - d)), 9) - (outside.get(d) || 0);
  const far = (cands, avoid) => [...cands].sort((a, b) => score(b, avoid) - score(a, avoid))[0];

  // Moved items keep the day the athlete chose.
  for (const it of take) if (moves[it.key] != null && moves[it.key] >= today) put(it, moves[it.key]);
  // Gym only: the split's days go in order (chest, back, legs…), one per training day.
  if (gymOnly(s)) for (const it of take) if (!placed.some(p => p.it === it)) put(it, [...free][0] ?? slots[0]);
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

  // Add-ons go after an easy session, never the day before a hard one.
  for (const it of addOns) {
    const hd = hardDays();
    const host = placed.filter(p => ['easy', 'swim', 'bike'].includes(p.it.cls) && !hd.includes(p.d + 1) && !placed.some(q => q.addOn && q.d === p.d)).map(p => p.d)[0];
    if (host != null) placed.push({ it: { ...it, addOn: true, phaseNote: 'Add-on: 15-20 min after your easy session' }, d: host, addOn: true });
  }
  let keyCount = 0;
  for (const { it, d } of placed.sort((a, b) => a.d - b.d)) {
    const keySession = HARD.has(it.cls) && it.cls !== 'impact' || (it.track === 'prep' && blocked) || (it.track !== 'prep' && keyCount === 0);
    if (keySession) keyCount++;
    const optional = !keySession && (it.extra || mode?.type === 'busy');
    if (mode?.type === 'busy' && optional) continue;
    byDay[d].push({ ...it, keySession, optional, moved: moves[it.key] != null });
  }
  if (mode?.type === 'busy') notes.push('Busy week: only Key sessions are planned. Short 20-minute versions still count.');
  if (s.target?.date) raceWeekPlan(s, byDay, monday, notes, today, slots);
  const left = list.length - take.length;
  if (!slots.length) notes.push('No training days left this week. Next week picks up from here.');
  // Other activities logged this week (gym, football…): shown as done, but they don't take the day:
  // the planned session for that day still stands.
  for (const h of s.history) if (h.kind === 'activity' && !h.linked && h.ts >= monday && weekKey(h.ts) === wk) byDay[dayIndex(h.ts)].push({ title: h.title, done: true, ts: h.ts, cls: 'done', activity: true });
  return { weekKey: wk, monday, today, days: frame(byDay, monday, today, days), warnings: warningsFor(byDay), notes, mode, left };
}

// Competition mode changes the sessions, not just the words: race prep keeps strength heavy but short,
// the taper cuts volume, race week keeps only easy sessions (plus a race-pace touch and, for Hyrox /
// Alpha X, light station practice), race day is the race, and the week after is recovery.
const STRENGTHY = it => it.track === 'strength' || it.track === 'gym' || (it.track === 'hyMaint' && (it.cls === 'strength' || it.cls === 'upper'));
function raceWeekPlan(s, byDay, monday, notes, today = 0, slots = []) {
  const t = s.target, hybridRace = ['hyrox', 'alphax'].includes(t.distance);
  const counts = { strength: 0, hard: 0 };
  let said = null;
  for (let d = 0; d < 7; d++) {
    const ph = racePhase(t, dateOf(monday, d) + 12 * 36e5);
    if (!ph || ph.id === 'build' || ph.id === 'done') continue;
    const keep = [];
    for (const it of byDay[d]) {
      if (it.done || it.sick || it.activity) { keep.push(it); continue; }
      const heavy = STRENGTHY(it), hard = it.cls === 'hard' || it.cls === 'test', long = it.cls === 'long';
      if (ph.id === 'peak') {
        if (heavy && ++counts.strength > 2) continue;
        keep.push(heavy ? { ...it, phaseNote: 'Race prep: heavy but short, 2-3 sets, leave 2 reps in the tank' } : it);
      } else if (ph.id === 'taper') {
        if (it.type === 'gate' || it.track === 'triGate' || it.track === 'hyGate') continue;
        if (heavy && ++counts.strength > 1) continue;
        if (hard && ++counts.hard > 1) continue;
        keep.push(heavy ? { ...it, phaseNote: 'Taper: half the sets, same weight' } : long ? { ...it, phaseNote: 'Taper: about two-thirds of the usual length' } : hard ? { ...it, phaseNote: 'Taper: shorter, keep the pace' } : it);
      } else if (ph.id === 'raceweek') {
        if (heavy && hybridRace && ph.d >= 3 && ++counts.strength === 1) { keep.push({ ...it, cls: 'easy', phaseNote: 'Race week: light station practice instead, 20 min at about half effort (sled, wall balls, lunges)' }); continue; }
        if (hard && ph.d >= 2 && ++counts.hard === 1) { keep.push({ ...it, cls: 'easy', phaseNote: 'Race week: just a race-pace touch: 10 min easy + 4 x 1 min at race pace' }); continue; }
        if (heavy || hard || long || it.cls === 'impact' || it.type === 'gate' || it.track === 'prep') continue;
        keep.push({ ...it, phaseNote: 'Race week: short and easy' });
      } else if (ph.id === 'race') {
        continue;
      } else if (ph.id === 'recover') {
        if (heavy || hard || long || it.cls === 'impact' || it.type === 'gate') continue;
        keep.push({ ...it, phaseNote: 'Recovery week: easy and short, only if you feel like it' });
      }
    }
    if (ph.id === 'race') keep.push({ title: `🏁 Race day: ${t.name}`, cls: 'test', race: true, keySession: true });
    // A race-week training day that lost its session still gets a short, easy one (the day before: a shakeout).
    if (ph.id === 'raceweek' && slots.includes(d) && !keep.some(it => !it.done && !it.activity)) keep.push(ph.d === 1
      ? { title: 'Shakeout: 15 min easy + 3 short strides', cls: 'easy', optional: true, phaseNote: 'Race week: the day before, just loosen up' }
      : { title: 'Easy 20-30 min', cls: 'easy', optional: true, phaseNote: 'Race week: short and easy' });
    byDay[d] = keep;
    if (d === Math.max(0, today) || (!said && d > today)) said = ph;
  }
  if (said) notes.push({ peak: 'Race prep: strength stays heavy but short (at most 2 sessions).', taper: 'Taper week: less volume, same intensity. No gates or tests.', raceweek: 'Race week: only short, easy sessions. Heavy lifting and hard sessions wait until after the race.', race: 'Race day this week!', recover: 'Recovery week after your race: easy movement only.' }[said.id]);
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
