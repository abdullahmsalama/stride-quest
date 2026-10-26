// Gym track rules. Pure functions (no DOM), so they run in the browser and in Node tests.
// How it works:
//   • The week is the athlete's split (chosen from days, goal, experience, age and other sports).
//   • Training runs in blocks: a few build weeks (effort rises: 3 → 1 reps in the tank), then a deload
//     week (half the sets, same or slightly lighter weights). Deloads every 4-6 weeks follow the
//     2023 expert consensus (Bell et al.); an early deload is offered when the main lifts stall.
//   • Main lifts stay the same block after block: strength is a skill, the nervous system gets better
//     at the lift it practises. The other exercises rotate each block, for variety and different angles.
//     ("Muscle confusion" isn't real; changing everything all the time slows progress. Variety is still
//     good for motivation, so every 3 blocks the app also offers a different split.)
//   • Stages clear when logged lifts reach the stage's bodyweight standard (estimated 1RM, Epley).
//     For muscle, fitness and fat-loss goals, beating your own numbers by 5% also clears a stage.
//     Each world ends with a Test Day in the deload week.
//   • Loads: double progression. Hit the top of the rep range on every set → add weight; miss the
//     bottom twice → take 10% off and build back.
import { GYM_STAGES, GYM_WORLDS, GYM_MAX, TEST_LIFTS, EQUIP_CAP, SLOTS, GYM_DAYS, GYM_SPLITS, SPLITS_FOR, PAIRS } from './data/gym.js';
import { ageOf, isTeen } from './age.js';
import * as HOME from './home.js';
import { HOME_MAX } from './data/home.js';

const DAY = 864e5;
export const hasGym = s => !!s.gym && (s.profile?.tracks || []).includes('gym');
// Does the athlete run at all (Run, Hybrid and Triathlon all include running)?
export const hasRunning = s => (s.profile?.tracks || ['run']).some(t => t === 'run' || t === 'hybrid' || t === 'tri');
export const gymOnly = s => hasGym(s) && !hasRunning(s);

export const GOALS = [['muscle', '💪 Build muscle'], ['strength', '🏋️ Get strong'], ['fit', '❤️ Get fit and healthy'], ['cut', '🔥 Lose fat, keep muscle']];
export const EXPERIENCE = [['none', 'New to the gym'], ['lt1', 'Under 1 year'], ['y1_3', '1-3 years'], ['y3', 'More than 3 years']];
export const EQUIPMENT = [['gym', 'A full gym'], ['home', 'Dumbbells at home'], ['bw', 'No equipment (bodyweight)']];
export const FOCUS = [['balanced', 'Balanced, the whole body'], ['lower', 'Lower body and glutes'], ['upper', 'Upper body'], ['arms', 'Bigger arms']];
export const LENGTHS = [['45', '45 min'], ['60', '1 hour'], ['90', '90 min']];
const XP_RANK = { none: 0, lt1: 1, y1_3: 2, y3: 3 };

// Home workouts (s.gym.mode === 'home') run in this track: their stages, steps and tests come from home.js.
export const gymStage = s => (HOME.isHome(s) ? HOME.homeStage(s) : GYM_STAGES[Math.min(s.gym.stage, GYM_MAX - 1)]);
export const gymWorld = s => (HOME.isHome(s) ? HOME.homeWorld(s) : GYM_WORLDS[Math.min(s.gym.world, GYM_WORLDS.length - 1)]);
const sexKey = s => (s.profile?.sex === 'm' ? 'm' : 'f'); // "prefer not to say" gets the more forgiving standards

// Gym days a week: every training day when the gym is all they do, else their own number.
export function gymDays(s) {
  const td = (s.profile?.days || []).length || s.profile?.daysPerWeek || 3;
  const cap = (ageOf(s) ?? 30) >= 50 ? 4 : 6; // from 50, 3-4 lifting days recover best (the other days stay free)
  return Math.max(1, Math.min(cap, gymOnly(s) ? td : Math.min(td, s.gym.days || 3)));
}
// Build weeks before each deload: newer lifters, teens and 50+ adapt (or recover) on their own timescale.
export function blockLength(s) {
  const xp = XP_RANK[s.gym.exp] ?? 1, age = ageOf(s);
  if (age != null && age >= 50) return 4;
  if (isTeen(s) || xp <= 1) return 6;
  return xp === 2 ? 5 : 4;
}
// Highest stage this athlete can clear: equipment and Teen mode set limits.
export function stageCap(s) {
  if (HOME.isHome(s)) return HOME_MAX;
  return Math.min(EQUIP_CAP[s.gym.equip] || GYM_MAX, isTeen(s) ? 4 : GYM_MAX);
}

// ---------- split ----------
// The best split for the athlete. otherSports: they also run / do Hybrid / Triathlon.
export function recommendGym({ days = 3, goal = 'muscle', exp = 'lt1', age = 30, otherSports = false, teen = false }) {
  const xp = XP_RANK[exp] ?? 1, notes = [];
  let d = Math.max(1, Math.min(6, days));
  if (age >= 50 && d > 4) { d = 4; notes.push('From 50, recovery between sessions takes longer: 3-4 lifting days give the best results, with the other days for walking, cardio or mobility.'); }
  const bro = goal === 'muscle' && xp >= 2 && !otherSports && !teen && age < 50;
  let id;
  if (d <= 2) id = 'full';
  else if (otherSports) id = d === 3 ? (xp >= 2 ? 'ulf' : 'full') : 'ul';
  else if (d === 3) id = xp <= 1 ? 'full' : goal === 'muscle' ? 'ppl3' : 'ulf';
  else if (d === 4) id = xp <= 1 ? 'ul' : bro ? 'bro4' : 'ul';
  else if (d === 5) id = xp <= 1 ? 'ulf5' : bro ? 'bro5' : 'ulppl';
  else id = 'ppl';
  if (otherSports && d >= 4) notes.push('You also run or race: Upper/Lower keeps heavy legs to two days you can put away from your key sessions.');
  if (otherSports && days > 4) notes.push('With running too, more than 4 lifting days rarely pays off: recovery is shared.');
  if (teen) notes.push('Teen mode: technique and steady reps first (no max-weight tests). Heavy work waits until 18.');
  return { id, days: d, label: GYM_SPLITS[id].label, why: GYM_SPLITS[id].why, notes };
}
const recFor = s => recommendGym({ days: gymDays(s), goal: s.gym.goal, exp: s.gym.exp, age: ageOf(s) ?? 30, otherSports: hasRunning(s), teen: isTeen(s) });
// Splits the athlete may pick for their days (bro splits only without running and outside Teen mode).
export function splitOptions(s) {
  const d = gymDays(s);
  return (SPLITS_FOR[d] || ['full']).filter(id => !(GYM_SPLITS[id].bro && (hasRunning(s) || isTeen(s))));
}
export function activeSplit(s) {
  const rec = recFor(s), pick = s.gym.split;
  if (pick && pick !== 'auto' && splitOptions(s).includes(pick)) return { id: pick, auto: false, rec };
  return { id: rec.id, auto: true, rec };
}
// Every 3 blocks: offer a different split for the same days, for a fresh stimulus and some variety.
export function rotateOffer(s) {
  if (HOME.isHome(s)) return null;
  const b = s.gym.block?.n || 0;
  if (b < 3 || b % 3 !== 0 || s.gym.offerSeen === b) return null;
  const cur = activeSplit(s).id, alt = splitOptions(s).find(id => id !== cur);
  return alt ? { id: alt, label: GYM_SPLITS[alt].label, block: b } : null;
}

// ---------- the week's sessions ----------
export function weekInfo(s, now = Date.now()) {
  if (HOME.isHome(s)) return { block: 1, week: s.gym.week || 1, len: 0, deload: false, comeback: false, home: true };
  const g = s.gym, len = blockLength(s), week = g.block?.week || 1;
  const deload = week > len;
  const last = Math.max(0, ...(s.history || []).filter(h => h.track === 'gym' && h.kind === 'session').map(h => h.ts));
  const comeback = !deload && last > 0 && now - last > 14 * DAY && !Object.keys(g.done || {}).length;
  return { block: (g.block?.n || 0) + 1, week, len, deload, comeback };
}
// Reps in the tank by week: ease in, build, push in the last build week.
function rirFor(base, week, len) { return week === 1 ? base + 1 : week >= len ? Math.max(1, base - 1) : base; }

const PRESCRIBE = {
  strength: { main: [5, '3-5', 2, '3-4 min'], compound: [3, '6-8', 2, '2-3 min'], iso: [2, '10-15', 2, '1-2 min'] },
  muscle: { main: [4, '6-10', 2, '2-3 min'], compound: [3, '8-12', 1, '2 min'], iso: [3, '10-15', 1, '1-2 min'] },
  fit: { main: [3, '8-12', 3, '2 min'], compound: [3, '10-12', 2, '90 s'], iso: [2, '12-15', 2, '60-90 s'] },
  cut: { main: [3, '5-8', 2, '2-3 min'], compound: [3, '8-12', 2, '2 min'], iso: [2, '10-15', 1, '60-90 s'] },
};
const HOLDS = new Set(['plank', 'side_plank', 'dead_bug']);
const HARD_BW = new Set(['pullup', 'chinup', 'dips']);
export function prescription(s, slot, id, { week = 1, len = 4, deload = false, comeback = false } = {}) {
  const kind = SLOTS[slot]?.kind || 'iso', g = s.gym, age = ageOf(s) ?? 30;
  let [sets, reps, rir, rest] = (PRESCRIBE[g.goal] || PRESCRIBE.muscle)[kind];
  if (kind === 'main' && ((XP_RANK[g.exp] ?? 1) === 0 || isTeen(s))) { reps = '8-10'; rir = 3; } // technique first
  if (age >= 50) sets = Math.max(2, sets - 1);
  if (g.equip === 'bw' && !HOLDS.has(id)) reps = kind === 'main' ? '8-15' : '10-20';
  if (HARD_BW.has(id)) reps = g.equip === 'bw' ? '3-8' : '5-10'; // pull-ups and dips: fewer reps (bands or slow negatives fill the set)
  rir = rirFor(rir, week, len);
  if (deload || comeback) { sets = Math.max(1, Math.ceil(sets / 2)); rir = 4; }
  if (HOLDS.has(id)) reps = id === 'dead_bug' ? '8 each side' : '30-45 s';
  return { sets, reps, rir, rest };
}
const pickEx = (slot, equip, block, extra) => { const list = SLOTS[slot][equip] || SLOTS[slot].gym; return SLOTS[slot].kind === 'main' ? list[0] : list[(block + extra) % list.length]; };
const nExercises = min => (+min >= 90 ? 6 : +min >= 60 ? 5 : 4);
const LEG_SLOTS = new Set(['squat', 'hinge', 'quad2', 'ham', 'quadIso', 'glutes', 'calves']);
// A split day's exercises for this athlete: focus, pairing, equipment, session length, block rotation.
export function dayPlan(s, dayId, info = weekInfo(s)) {
  const g = s.gym, day = GYM_DAYS[dayId], pair = PAIRS[g.pair] || PAIRS.classic;
  let slots = day.slots.map(x => x.replace('@push', pair.push).replace('@pull', pair.pull));
  const legDay = slots.slice(0, 2).some(x => LEG_SLOTS.has(x.replace('+', '')));
  const n = nExercises(g.minutes) - (FINISH[g.goal]?.every && !hasRunning(s) && +g.minutes <= 45 ? 1 : 0); // short sessions make room for the cardio finisher
  if (g.focus === 'lower') { slots = slots.filter(x => x !== 'glutes'); if (legDay) slots.splice(1, 0, 'glutes'); else slots.splice(n - 1, 0, 'glutes'); }
  if (g.focus === 'upper' && legDay) slots.splice(n - 1, 0, 'lateral');
  if (g.focus === 'arms' && !legDay) { for (const k of ['triceps', 'biceps']) if (!slots.slice(0, n).some(x => x.startsWith(k))) slots.splice(n - 1, 0, k); }
  const seen = new Set(), items = [];
  for (const raw of slots) {
    if (items.length >= n) break;
    const slot = raw.replace('+', ''), extra = raw.endsWith('+') ? 1 : 0;
    const id = pickEx(slot, g.equip || 'gym', info.block - 1, extra);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, slot, kind: SLOTS[slot].kind, legs: !!SLOTS[slot].legs, ...prescription(s, slot, id, info) });
  }
  const name = day.name === 'Chest' ? `Chest + ${pair.push === 'triceps' ? 'Triceps' : 'Biceps'}` : day.name === 'Back' ? `Back + ${pair.pull === 'biceps' ? 'Biceps' : 'Triceps'}` : day.name;
  return { name, items, legs: items.some(x => x.legs && x.kind !== 'iso') };
}

// Cardio, because lifting alone doesn't cover heart health: the WHO advises 150-300 min of moderate
// cardio a week plus strength twice. Every session starts with a short easy warm-up on a machine;
// finishers depend on the goal. Easy, low-impact cardio after lifting barely affects strength or muscle
// gains (Wilson 2012; Schumann 2022), so it goes after the weights, and not after leg days for
// muscle and strength goals. Athletes who also run get their cardio from running: warm-up only.
const FINISH = {
  fit: { every: true, min: 15, text: 'moderate: breathing harder, still able to talk in short sentences', intervals: true },
  cut: { every: true, min: 20, text: 'easy, steady zone 2: you could hold a conversation' },
  muscle: { per: 2, min: 12, text: 'easy: you could hold a conversation' },
  strength: { per: 2, min: 10, text: 'easy: you could hold a conversation' },
};
export function cardioFor(s, plans) {
  const out = plans.map(() => ({ warm: 'Warm-up: 5 min easy cardio (bike, rower, cross-trainer or brisk walk), then 1-2 light sets of the first exercise' }));
  const f = FINISH[s.gym.goal] || FINISH.muscle;
  if (hasRunning(s) || s.gym.equip === 'bw' && !f.every) return out;
  const machine = s.gym.equip === 'gym' ? 'bike, rower, cross-trainer or incline walk' : 'brisk walk, cycling, skipping or stairs';
  let left = f.per ?? plans.length, first = true;
  // Muscle and strength goals: after upper-body days first, so legs stay fresh for leg day.
  const heavy = p => (p.items.some(x => x.legs && x.kind === 'main') ? 2 : p.legs ? 1 : 0); // squat / deadlift day, other leg work, none
  const order = [...plans.keys()].sort((a, b) => (f.every ? 0 : heavy(plans[a]) - heavy(plans[b])) || a - b);
  for (const i of order) {
    if (left-- <= 0) break;
    const iv = f.intervals && first; first = false;
    out[i].finish = iv ? { min: 12, text: `Cardio finisher, 12 min intervals: 6 × 30 s hard / 90 s easy (${machine})` }
      : { min: f.min, text: `Cardio finisher, ${f.min} min ${f.text} (${machine})` };
  }
  return out;
}
// Cardio minutes in this week's sessions, and what to add on free days to reach 150.
export function weeklyCardio(s, now = Date.now()) {
  if (HOME.isHome(s)) return HOME.homeCardio(s);
  const steps = gymSteps(s, now).filter(x => x.type === 'lift');
  const inSessions = steps.reduce((t, x) => t + (x.finish?.min || 0) + 5, 0);
  const free = Math.max(0, 7 - gymDays(s));
  const need = Math.max(0, 150 - inSessions), walks = need ? Math.min(free, Math.ceil(need / 30)) : 0;
  return { inSessions, need, walks, free };
}

// Steps for the current gym week: the split's next sessions, then (on a world's last stage, in the
// deload week) the Test Day.
export function gymSteps(s, now = Date.now()) {
  if (HOME.isHome(s)) return HOME.homeSteps(s);
  const g = s.gym, info = weekInfo(s, now), sp = activeSplit(s), days = GYM_SPLITS[sp.id].days, n = gymDays(s);
  const w = GYM_WORLDS[GYM_STAGES[Math.min(g.stage, GYM_MAX - 1)].world];
  const testDue = info.deload && !g.finished && g.stage < stageCap(s) && GYM_STAGES[g.stage]?.std && w.stages.at(-1) === g.stage;
  const count = testDue ? Math.max(1, n - 1) : n;
  const steps = [], plans = [];
  for (let i = 0; i < count; i++) { const dayId = days[((g.rot || 0) + i) % days.length]; plans.push({ dayId, ...dayPlan(s, dayId, info) }); }
  const cardio = cardioFor(s, plans);
  plans.forEach((plan, i) => {
    const tag = info.deload ? 'Deload week: half the sets, same or 10% lighter weights' : info.comeback ? 'Welcome back: an easy week, half the sets, lighter weights' : `Week ${info.week} of ${info.len}: leave ${plan.items[0]?.rir ?? 2} reps in the tank`;
    const fin = cardio[i].finish;
    steps.push({ type: 'lift', title: plan.name, detail: `${plan.items.length} exercises${fin ? ` + ${fin.min} min cardio` : ''} · about ${g.minutes || 60} min · ${tag}`, ex: plan.items.map(x => x.id), gym: plan.items, legs: plan.legs, minutes: +g.minutes || 60, dayId: plan.dayId, warm: cardio[i].warm, finish: fin });
  });
  if (testDue) {
    const lifts = testLifts(s);
    steps.push({ type: 'gate', boss: true, test: true, title: `🏆 ${w.test}`, detail: `Warm up well, then work up to one heavy set of ${isTeen(s) ? '5-8' : '3-5'} good reps on ${lifts.map(l => l.name).join(', ')}. Log the weight and reps: it clears ${w.name} when you reach the standard (or beat your own numbers by 5%).`, ex: lifts.map(l => l.id), legs: true });
  }
  return steps;
}

// ---------- lifts, standards, loads ----------
export const e1rm = (kg, reps) => (!(kg > 0) || !(reps > 0) || reps > 12 ? 0 : reps === 1 ? kg : kg * (1 + reps / 30));
export function bwOf(s) {
  const last = (s.bodyLog || []).at(-1), toKg = (v, u) => (+v > 0 ? +v * (u === 'lb' ? 0.4536 : 1) : 0);
  return toKg(last?.bw, last?.unit) || +s.gym?.bw || +s.nutrition?.kg || toKg(s.answers?.bodyweight, s.answers?.liftUnit) || 0;
}
const NAMES = { squat: 'squat', bench: 'bench press', deadlift: 'deadlift', push: 'push-ups', pull: 'pull-ups', legs: 'Bulgarian split squats' };
export function testLifts(s) {
  if (HOME.isHome(s)) return HOME.homeTests(s).map(t => ({ key: t.id, id: t.id, name: t.label }));
  return TEST_LIFTS[s.gym.equip || 'gym'].map(([key, id, f]) => ({ key, id, factor: f, name: NAMES[key] }));
}
// Best estimated 1RM (or best reps, bodyweight) on an exercise since a time.
export function best(s, id, since = 0) {
  const log = (s.gym.lifts?.[id] || []).filter(x => x.ts >= since);
  if (s.gym.equip === 'bw' || HOME.isHome(s)) return Math.max(0, ...log.flatMap(x => x.reps || []));
  return Math.max(0, ...log.map(x => Math.max(0, ...(x.reps || []).map(r => e1rm(x.kg, r)))));
}
// Where each test lift stands against a stage's standard.
export function standing(s, stage = s.gym.stage, since = 0) {
  if (HOME.isHome(s)) return HOME.homeStanding(s, stage, since);
  const st = GYM_STAGES[Math.min(stage, GYM_MAX - 1)], bw = bwOf(s), sex = sexKey(s), bwMode = s.gym.equip === 'bw';
  const std = bwMode ? st.bw?.[sex] : st.std?.[sex];
  return testLifts(s).map((l, i) => {
    const have = best(s, l.id, since);
    if (!std) return { ...l, have, need: null, ok: false };
    if (bwMode) return { ...l, have, need: std[i], ok: have >= std[i], text: `${std[i]} ${l.key === 'legs' ? 'each leg' : 'reps'}` };
    const needKg = bw ? std[i] * bw * l.factor : null;
    return { ...l, have, needKg, need: std[i], ok: !!needKg && have >= needKg, text: needKg ? `${Math.round(needKg)} kg est. 1RM (${std[i]}× bodyweight)` : `${std[i]}× bodyweight` };
  });
}
// The "beat your own numbers" path: 2 of the 3 test lifts up 5% on their level at the start of the stage.
export function progressed(s) {
  if (s.gym.goal === 'strength') return false;
  const base = s.gym.base || {};
  return testLifts(s).filter(l => base[l.id] > 0 && best(s, l.id, s.gym.stageAt || 0) >= base[l.id] * 1.05).length >= 2;
}

const top = r => +String(r).split('-').pop() || 10;
const low = r => +String(r).split('-')[0] || 8;
const roundTo = (kg, step) => Math.max(step, Math.round(kg / step) * step);
// Suggested weight for an exercise in a session, from the last time it was logged.
export function suggestLoad(s, item, info = weekInfo(s)) {
  if (HOME.isHome(s)) return null;
  if (s.gym.equip === 'bw' || HOLDS.has(item.id)) return null;
  const log = (s.gym.lifts?.[item.id] || []).filter(x => !x.told && x.kg > 0), last = log.at(-1); // the lifts they told us only set the first weight
  const db = s.gym.equip === 'home' || /^db_|dumbbell|hammer|lateral|rear_delt|incline_db/.test(item.id);
  const step = item.legs && !db ? 5 : db || item.kind === 'iso' ? 2 : 2.5;
  const lighter = info.deload || info.comeback;
  if (!last) {
    const est = (s.gym.est || {})[item.id];
    if (!est) return { kg: null, why: `First time: pick a weight you could lift about ${top(item.reps) + item.rir} times, then do ${item.reps}.` };
    const kg = roundTo(est / (1 + (top(item.reps) + item.rir) / 30) * (lighter ? 0.9 : 1), step);
    return { kg, why: 'From the lifts you told us.' };
  }
  const reps = last.reps || [];
  if (lighter) return { kg: roundTo(last.kg * 0.9, step), why: info.deload ? 'Deload: about 10% lighter, easy reps.' : 'Easing back in: about 10% lighter.' };
  if (reps.length && reps.every(r => r >= top(item.reps))) return { kg: roundTo(last.kg + step, step), why: `You hit ${top(item.reps)} on every set last time: up ${step} kg.` };
  const prev = log.at(-2), missed = x => x && (x.reps || []).some(r => r < low(item.reps));
  if (missed(last) && missed(prev) && prev.kg === last.kg) return { kg: roundTo(last.kg * 0.9, step), why: 'Two tough sessions at this weight: 10% off, then build back up past it.' };
  return { kg: last.kg, why: missed(last) ? 'Same weight: aim for the bottom of the range on every set.' : 'Same weight: add a rep or two.' };
}
// Main lifts that haven't gone up in their last 3 logs (an early deload helps).
export function stalled(s) {
  if (HOME.isHome(s)) return [];
  const out = [];
  for (const [id, log] of Object.entries(s.gym.lifts || {})) {
    if (log.length < 4 || !Object.values(SLOTS).some(sl => sl.kind === 'main' && Object.values(sl).some(v => Array.isArray(v) && v.includes(id)))) continue;
    const e = x => Math.max(0, ...(x.reps || []).map(r => e1rm(x.kg, r)));
    const before = Math.max(...log.slice(0, -3).map(e)), recent = Math.max(...log.slice(-3).map(e));
    if (recent <= before) out.push(id);
  }
  return out;
}

// ---------- placement ----------
const toKg = (v, unit) => (+v > 0 ? +v * (unit === 'lb' ? 0.4536 : 1) : 0);
export function placeGym(s, a, now) {
  if (a.gMode === 'home') return HOME.placeHome(s, a, now);
  const equip = a.gEquip || 'gym', xp = XP_RANK[a.gExp] ?? 1, unit = a.liftUnit || 'kg';
  const gym = {
    goal: a.gGoal || 'muscle', exp: a.gExp || 'lt1', days: +a.gDays || Math.min(4, (a.days || []).length || 3), minutes: +a.gMin || 60,
    equip, focus: a.gFocus || ((a.sex || s.profile?.sex) === 'f' ? 'lower' : 'balanced'), pair: 'classic', split: 'auto', stage: 0, world: 0, done: {}, rot: 0,
    block: { n: 0, week: 1 }, lifts: {}, est: {}, base: {}, stageAt: now, stageBlock: 0, bw: toKg(a.bodyweight, unit) || 0, finished: false,
  };
  // Lifts they told us: estimated 1RMs (seeded as logs so standards and loads use them).
  const typed = [['gSquat', 'gSquatR', TEST_LIFTS[equip][0]?.[1]], ['gBench', 'gBenchR', TEST_LIFTS[equip][1]?.[1]], ['gDead', 'gDeadR', TEST_LIFTS[equip][2]?.[1]]];
  const probe = { ...s, gym, profile: { ...s.profile, sex: a.sex || s.profile?.sex } };
  if (equip === 'bw') {
    [['gPush', 'pushup'], ['gPull', 'pullup'], ['gLegs', 'bulgarian_split_squat']].forEach(([k, id]) => { if (+a[k] > 0) gym.lifts[id] = [{ ts: now - DAY, kg: 0, reps: [+a[k]], told: true }]; });
  } else {
    for (const [k, r, id] of typed) {
      const kg = toKg(a[k], unit), reps = +a[r] || 5;
      if (kg > 0 && id) { gym.lifts[id] = [{ ts: now - DAY, kg, reps: [Math.min(12, reps)], told: true }]; gym.est[id] = e1rm(kg, Math.min(12, reps)); }
    }
  }
  // Stage: the first one whose standard isn't met yet, capped by experience, equipment and age.
  const told = Object.keys(gym.lifts).length;
  let stage = [0, 1, 2, 3][xp];
  if (told >= 2) {
    stage = 1;
    while (stage < GYM_MAX && standing(probe, stage).filter(x => x.ok).length >= Math.min(told, 3)) stage++;
    stage = Math.min(stage, [1, 3, 6, GYM_MAX][xp]);
    if (xp === 0) stage = Math.min(stage, 1);
  }
  gym.stage = Math.min(stage, stageCap(probe));
  gym.world = GYM_STAGES[Math.min(gym.stage, GYM_MAX - 1)].world;
  gym.base = Object.fromEntries(testLifts(probe).map(l => [l.id, best(probe, l.id)]).filter(([, v]) => v > 0));
  return gym;
}

// ---------- after a session ----------
// Saves the logged sets, rolls the week and block, and clears stages whose standard is now met.
// `logs`: { exerciseId: { kg, reps: [..] } }. Mutates `s` (the engine passes a copy).
export function afterGymStep(s, step, logs, now, msgs) {
  if (HOME.isHome(s)) return HOME.afterHome(s, step, now, msgs);
  const g = s.gym;
  g.lifts ||= {};
  for (const [id, x] of Object.entries(logs || {})) {
    const reps = (x.reps || []).map(Number).filter(r => r > 0).slice(0, 10);
    if (!reps.length) continue;
    (g.lifts[id] ||= []).push({ ts: now, kg: +x.kg || 0, reps });
    g.lifts[id] = g.lifts[id].slice(-30);
    if (!(g.base?.[id] > 0) && testLifts(s).some(l => l.id === id)) g.base = { ...(g.base || {}), [id]: best(s, id) };
  }
  if (step.type === 'gate') return; // the Test Day is judged by passTest
  checkStage(s, now, msgs);
  // Week done: next week of the block (or the deload, or a new block with fresh accessories).
  // (A Test Day week rolls on once the test is logged or skipped.)
  const steps = gymSteps(s, now);
  if (steps.every((_, i) => g.done[i])) rollWeek(s, steps.length, now, msgs);
}
function rollWeek(s, n, now, msgs) {
  const g = s.gym, len = blockLength(s);
  g.done = {};
  g.rot = ((g.rot || 0) + n) % 60;
  if ((g.block.week || 1) > len) {
    g.block = { n: (g.block.n || 0) + 1, week: 1 };
    if (g.stage === 0) { g.stage = 1; g.stageAt = now; msgs.push('🎓 Learn the Moves done: your technique is in. Stage 1 · Foundation starts, with your first strength targets.'); }
    msgs.push(`🔄 Block ${g.block.n + 1} starts: same main lifts, fresh accessory exercises.`);
  } else {
    g.block.week = (g.block.week || 1) + 1;
    if (g.block.week > len) msgs.push('😮‍💨 Deload week next: half the sets, lighter weights. You come back stronger.');
  }
}
// Not the world's last stage: logs meeting the standard (or the 5% progress path after a full block) clear it.
function checkStage(s, now, msgs) {
  const g = s.gym;
  if (g.finished || g.stage === 0 || g.stage >= stageCap(s)) return;
  const w = GYM_WORLDS[GYM_STAGES[g.stage].world];
  if (w.stages.at(-1) === g.stage) {
    if (standing(s).every(x => x.ok) && !g.readySaid) { g.readySaid = true; msgs.push(`🏆 Your lifts meet the ${GYM_STAGES[g.stage].name} standard. Your ${w.test} comes in the deload week!`); }
    return;
  }
  const blockDone = (g.block.n || 0) > (g.stageBlock ?? -1);
  if (standing(s).every(x => x.ok) || (blockDone && progressed(s))) stageUp(s, now, msgs, standing(s).every(x => x.ok) ? 'standard' : 'progress');
}
function stageUp(s, now, msgs, how) {
  const g = s.gym, was = GYM_STAGES[g.stage];
  g.stage += 1; g.stageAt = now; g.stageBlock = g.block.n || 0; g.readySaid = false;
  g.base = Object.fromEntries(testLifts(s).map(l => [l.id, best(s, l.id)]).filter(([, v]) => v > 0));
  msgs.push(`${how === 'progress' ? '📈 You beat your own numbers by 5%+' : '💪 Standard reached'}: ${was.name} cleared! Next: ${GYM_STAGES[Math.min(g.stage, GYM_MAX - 1)].name}.`);
}
// Test Day: `logs` hold the heavy set on each test lift.
export function passTest(s, logs, now, msgs) {
  if (HOME.isHome(s)) return HOME.passHomeTest(s, logs, now, msgs);
  const g = s.gym, w = gymWorld(s);
  afterGymStep(s, { type: 'gate' }, logs, now, msgs);
  const since = now - 1, lifts = gymSteps(s, now).filter(x => x.type !== 'gate').length;
  const st = standing(s, g.stage, since), ok = st.every(x => x.ok) || progressedSince(s, since);
  if (!ok) {
    const short = st.filter(x => !x.ok).map(x => `${x.name}: ${x.text}`).join(' · ');
    msgs.push(`Good test! Not quite there yet (${short}). Your next block builds towards it 💪`);
    rollWeek(s, lifts, now, msgs);
    return false;
  }
  if (g.stage >= GYM_MAX - 1) { g.finished = true; msgs.push(`👑 ${w.name} conquered. Legend of the gym!`); rollWeek(s, lifts, now, msgs); return true; }
  stageUp(s, now, msgs, st.every(x => x.ok) ? 'standard' : 'progress');
  g.world = GYM_STAGES[g.stage].world;
  msgs.push(`🏆 ${w.test} passed! Welcome to ${gymWorld(s).emoji} ${gymWorld(s).name}.`);
  rollWeek(s, lifts, now, msgs);
  return true;
}
function progressedSince(s, since) {
  if (s.gym.goal === 'strength') return false;
  const base = s.gym.base || {};
  return testLifts(s).filter(l => base[l.id] > 0 && best(s, l.id, since) >= base[l.id] * 1.05).length >= 2;
}
// Not testing this time: the next block starts.
export function skipTest(state, now) {
  if (HOME.isHome(state)) return HOME.skipHomeTest(state);
  const s = JSON.parse(JSON.stringify(state)), msgs = [];
  rollWeek(s, gymSteps(s, now).filter(x => x.type !== 'gate').length, now, msgs);
  return s;
}
// Start the deload now (main lifts stalled, or the athlete feels run down).
export function deloadNow(state) {
  if (HOME.isHome(state)) return state;
  const s = JSON.parse(JSON.stringify(state));
  s.gym.block.week = blockLength(s) + 1; s.gym.done = {};
  return s;
}
