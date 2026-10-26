// Home workouts: short full-body circuits at home with bodyweight, resistance bands, light dumbbells
// or a chair. Pure functions (no DOM). It runs inside the Gym track (s.gym.mode === 'home'), so the
// week, calendar and map work like the gym; gym.js hands the home parts over to this file.
// How it works:
//   • Sessions are timed circuits (work / rest per move, a few rounds): easy to follow at home, no
//     counting sets or weights. 2-3 full-body sessions a week train every muscle 2-3 times, which is
//     the best use of short sessions (Schoenfeld 2016).
//   • Each move comes from a ladder (wall push-up → incline → knees → full → feet up). The stage picks
//     the rung; "Easier" / "Harder" in a session moves that move type one rung for good.
//   • Work time rises with the world (30 s on / 30 s off → 50 / 10). With "no jumping", every jump
//     move has a low-impact version (step jacks, skater steps, step-back burpees).
//   • Cardio: fit and fat-loss goals get one or two home cardio sessions a week (or a brisk walk).
//   • A stage clears after 6 sessions. On a world's last stage they open its Test Day: three simple
//     tests (push-ups, plank, legs). All three met = the next world.
//   • Didn't know their push-ups or plank? The first session is a Check-in that places them.
import { HOME_WORLDS, HOME_STAGES, HOME_MAX, HOME_TESTS, HOME_AGE_EASE, HOME_CHECKIN, CHECKIN_MAX_WORLD, LADDERS, STAGE_SESSIONS } from './data/home.js';
import { gymDays, hasRunning } from './gym.js';
import { ageOf } from './age.js';

export const isHome = s => s.gym?.mode === 'home';
export const HAVE = [['band', 'Resistance bands'], ['db', 'Light dumbbells or a kettlebell'], ['chair', 'A sturdy chair or step'], ['mat', 'A yoga mat']];
export const MINUTES = [['10', '10 min'], ['20', '20 min'], ['30', '30 min'], ['45', '45 min']];
export const GOALS = [['fit', '❤️ Get fit and feel better'], ['tone', '✨ Tone up'], ['strong', '💪 Get stronger'], ['cut', '🔥 Lose fat']];
export const JUMPS = [['yes', 'Yes, jumping is fine'], ['no', 'No jumping (knees, neighbours, downstairs flat)']];
export const FITNESS = [['start', 'Just starting'], ['some', 'I move a bit'], ['regular', 'I work out regularly']];

export const homeStage = s => HOME_STAGES[Math.min(s.gym.stage, HOME_MAX - 1)];
export const homeWorld = s => HOME_WORLDS[Math.min(s.gym.world, HOME_WORLDS.length - 1)];
const lastOfWorld = n => HOME_WORLDS[HOME_STAGES[Math.min(n, HOME_MAX - 1)].world].stages.at(-1) === n;

// ---------- moves ----------
// The rungs this athlete can use: their equipment, and no jumps if they said so.
export function ladder(s, cat) {
  const g = s.gym, have = new Set(g.have || []);
  const list = (LADDERS[cat] || []).filter(x => (!x.need || have.has(x.need)) && (g.jumps === 'no' ? !x.jump : !x.low));
  // Bands or dumbbells at home: back, shoulder and glute work uses them from the first session.
  const first = list.findIndex(x => x.need);
  return ['pull', 'shoulder', 'hinge'].includes(cat) && first > 0 ? list.slice(first) : list;
}
// Rung for a move type: the stage sets it (spread over the ladder), "Easier" / "Harder" shifts it.
// About one rung per world; what they could already do (push-ups, plank) sets a floor.
export function rungOf(s, cat, shift = 0) {
  const list = ladder(s, cat), floor = Math.max(0, list.findIndex(x => x.id === s.gym.floor?.[cat]));
  const world = HOME_STAGES[Math.min(s.gym.stage, HOME_MAX - 1)].world; // short ladders climb more slowly
  const base = Math.max(floor, Math.min(list.length - 1, Math.floor(world * list.length / HOME_WORLDS.length)));
  const i = Math.max(0, Math.min(list.length - 1, base + (s.gym.adj?.[cat] || 0) + shift));
  return { id: list[i]?.id, i, easier: i > 0, harder: i < list.length - 1 };
}
// Work / rest seconds by world.
export const pace = s => [[30, 30], [35, 25], [40, 20], [45, 15], [50, 10]][HOME_STAGES[Math.min(s.gym.stage, HOME_MAX - 1)].world];
const SHAPE = { 10: { moves: 4, rounds: 2, warm: 2, cool: 0, fin: 0 }, 20: { moves: 5, rounds: 3, warm: 3, cool: 2, fin: 0 }, 30: { moves: 6, rounds: 4, warm: 4, cool: 2, fin: 0 }, 45: { moves: 6, rounds: 5, warm: 5, cool: 3, fin: 7 } };
export const shapeOf = min => SHAPE[+min] || SHAPE[20];
const TEMPLATES = {
  A: ['squat', 'push', 'hinge', 'pull', 'core', 'cardio'],
  B: ['hinge', 'push', 'squat', 'shoulder', 'core2', 'cardio'],
};

function circuit(s, which) {
  const g = s.gym, sh = shapeOf(g.minutes), [work, rest] = pace(s);
  let cats = [...TEMPLATES[which]];
  if (g.goal === 'strong' || hasRunning(s)) cats = cats.map(c => (c === 'cardio' ? (which === 'A' ? 'shoulder' : 'pull') : c)); // strength first; runners get their cardio from running
  if (g.goal === 'tone' && which === 'B') cats = cats.map(c => (c === 'core2' ? 'hinge' : c)); // a little more glute work
  const moves = [], seen = new Set();
  for (const cat of cats) {
    if (moves.length >= sh.moves) break;
    let r = rungOf(s, cat);
    if (seen.has(r.id)) r = rungOf(s, cat, r.easier ? -1 : 1); // the same move twice: its neighbour on the ladder
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id); moves.push({ id: r.id, cat, easier: r.easier, harder: r.harder });
  }
  const fin = sh.fin ? { min: sh.fin, text: `Cardio finisher, ${sh.fin} min: ${g.jumps === 'no' ? 'march, step jacks and skater steps' : 'jumping jacks, skaters and mountain climbers'}, 40 s on / 20 s off` } : null;
  return { moves, rounds: sh.rounds, work, rest, warm: sh.warm, cool: sh.cool, fin };
}
function cardioSession(s) {
  const g = s.gym, list = ladder(s, 'cardio'), base = rungOf(s, 'cardio').i, sh = shapeOf(g.minutes);
  const pick = [...new Set([0, 1, 2, 3].map(k => list[Math.min(list.length - 1, Math.max(0, base - 1 + k))]?.id))].filter(Boolean);
  const [work, rest] = g.stage < 4 ? [30, 30] : [40, 20];
  const rounds = Math.max(2, Math.round((+g.minutes - sh.warm - sh.cool) * 60 / (pick.length * (work + rest))));
  return { moves: pick.map(id => ({ id, cat: 'cardio' })), rounds, work, rest, warm: sh.warm, cool: sh.cool, fin: null };
}
// Cardio sessions a week: fit and fat-loss goals, if there are enough days (not for runners: they run).
export function cardioDays(s) {
  if (hasRunning(s)) return 0;
  const d = gymDays(s), goal = s.gym.goal;
  if (goal === 'cut') return d >= 5 ? 2 : d >= 3 ? 1 : 0;
  if (goal === 'fit') return d >= 3 ? 1 : 0;
  return d >= 5 ? 1 : 0;
}
export const circuitMinutes = c => Math.round((c.moves.length * c.rounds * (c.work + c.rest)) / 60) + c.warm + c.cool + (c.fin?.min || 0);

// ---------- the week ----------
export function homeSteps(s) {
  if (s.gym.checkin) return [{ type: 'gate', test: true, checkin: true, title: '📋 Check-in: find your level', detail: 'Warm up for 5 minutes, then do each test once, with a good rest between: as many push-ups as you can (full, then on your knees), your longest plank, and squats in 1 minute. Your circuits are set from your results.', ex: HOME_CHECKIN.map(x => x.id), legs: true }];
  const g = s.gym, n = gymDays(s), cd = Math.min(cardioDays(s), n - 1), strength = n - cd, steps = [];
  // Strength days alternate A / B (across weeks too); cardio days go in between.
  const order = [];
  for (let i = 0, si = 0, ci = 0; i < n; i++) {
    const cardioHere = ci < cd && i % 2 === 1;
    if (cardioHere || si >= strength) { order.push('C'); ci++; } else { order.push((g.rot + si) % 2 ? 'B' : 'A'); si++; }
  }
  const lowImpact = g.jumps === 'no' ? ' · no jumping' : '';
  for (const which of order) {
    const c = which === 'C' ? cardioSession(s) : circuit(s, which), min = circuitMinutes(c);
    steps.push(which === 'C'
      ? { type: 'engine', label: 'Cardio', title: `Home cardio · ${min} min`, detail: `${c.moves.length} moves, ${c.rounds} rounds, ${c.work} s on / ${c.rest} s off${lowImpact}. Or a brisk walk outside for the same time.`, home: c, ex: c.moves.map(x => x.id), minutes: min, legs: false }
      : { type: 'lift', label: 'Circuit', title: `Full-body circuit ${which} · ${min} min`, detail: `${c.moves.length} moves, ${c.rounds} rounds, ${c.work} s on / ${c.rest} s off${lowImpact}`, home: c, ex: c.moves.map(x => x.id), minutes: min, legs: true });
  }
  if (testDue(s)) {
    const t = homeTests(s);
    steps.push({ type: 'gate', boss: true, test: true, title: `🏆 ${homeWorld(s).test}`, detail: `Warm up for 5 minutes, then do each test once, with a good rest between: ${t.map(x => `${x.label} (${x.need} ${x.unit === 's' ? 's' : 'reps'})`).join(', ')}. Log what you did.`, ex: t.map(x => x.id), legs: true });
  }
  return steps;
}
const testDue = s => !s.gym.finished && lastOfWorld(s.gym.stage) && (s.gym.count || 0) >= STAGE_SESSIONS;

// ---------- tests ----------
// A world's tests with each goal resolved for this athlete: a { m, f } goal picks by sex (unknown sex → m),
// and `age: true` goals ease from 50 and 60.
const ageEase = s => { const a = ageOf(s); return (a != null && HOME_AGE_EASE.find(x => a >= x.from)?.factor) || 1; };
export const homeTests = (s, world = HOME_STAGES[Math.min(s.gym.stage, HOME_MAX - 1)].world) => {
  const f = ageEase(s);
  return HOME_TESTS[Math.min(world, HOME_TESTS.length - 1)].map(t => {
    const need = typeof t.need === 'object' ? t.need[s.profile?.sex === 'f' ? 'f' : 'm'] : t.need;
    return { ...t, need: t.age && f < 1 ? Math.max(1, Math.round(need * f)) : need };
  });
};
// Best logged result on a test move (reps or seconds).
const bestOf = (s, id, since = 0) => Math.max(0, ...(s.gym.lifts?.[id] || []).filter(x => x.ts >= since).flatMap(x => x.reps || []));
export function homeStanding(s, stage = s.gym.stage, since = 0) {
  return homeTests(s, HOME_STAGES[Math.min(stage, HOME_MAX - 1)].world).map(t => {
    const have = bestOf(s, t.id, since);
    return { key: t.id, id: t.id, name: t.label, have, need: t.need, ok: have >= t.need, text: `${t.need} ${t.unit === 's' ? 's' : 'reps'}` };
  });
}

// ---------- placement ----------
export function placeHome(s, a, now) {
  const have = HAVE.map(([k]) => k).filter(k => a[`hv_${k}`]);
  let stage = { start: 0, some: 2, regular: 4 }[a.hFit] ?? 0;
  const push = +a.hPush || 0, plank = +a.hPlank || 0, checkin = !push && !plank; // no numbers: a Check-in first
  if (push >= 15 && plank >= 45) stage = Math.max(stage, 4); else if (push >= 8 && plank >= 30) stage = Math.max(stage, 2);
  const gym = { mode: 'home', have, minutes: +a.hMin || 20, goal: a.hGoal || 'fit', jumps: a.hJump || 'no', fitness: a.hFit || 'start', days: +a.hDays || Math.min(4, (a.days || []).length || 3),
    stage, world: HOME_STAGES[stage].world, done: {}, rot: 0, count: 0, week: 1, adj: {}, lifts: {}, stageAt: now, finished: false,
    floor: floorsOf(push >= 10, push >= 8, plank), ...(checkin ? { checkin: true } : {}) };
  return gym;
}

// What they can already do sets a floor on the push-up and plank ladders.
const floorsOf = (full, knee, plank) => ({ ...(full ? { push: 'pushup' } : knee ? { push: 'knee_pushup' } : {}), ...(plank >= 45 ? { core: 'plank' } : {}) });
// Check-in results ({ id: n }): the highest world whose Test Day they already pass, up to CHECKIN_MAX_WORLD.
const PUSH = LADDERS.push.map(x => x.id);
export function checkinWorld(s, res) {
  const val = id => (PUSH.includes(id) ? Math.max(0, ...PUSH.slice(PUSH.indexOf(id)).map(k => res[k] || 0)) : res[id] || 0);
  let w = 0;
  while (w < CHECKIN_MAX_WORLD && homeTests(s, w).every(t => val(t.id) >= t.need)) w++;
  return w;
}
function placeFromCheckin(s, logs, now, msgs) {
  const g = s.gym, res = {};
  for (const [id, x] of Object.entries(logs || {})) {
    const v = (x.reps || []).map(Number).filter(r => r > 0);
    if (v.length) { res[id] = v[0]; (g.lifts[id] ||= []).push({ ts: now, kg: 0, reps: v.slice(0, 1) }); }
  }
  const w = checkinWorld(s, res);
  g.stage = HOME_WORLDS[w].stages[0]; g.world = w; g.count = 0; g.stageAt = now; g.adj = {}; g.done = {};
  g.floor = floorsOf((res.pushup || 0) >= 10, (res.pushup || 0) >= 3 || (res.knee_pushup || 0) >= 8, res.plank || 0);
  delete g.checkin;
  msgs.push(`📋 Check-in done! You start in ${homeWorld(s).emoji} ${homeWorld(s).name}, ${homeStage(s).name}. Your circuits are set from your results.`);
  return true;
}

// ---------- after a session ----------
export function afterHome(s, step, now, msgs) {
  const g = s.gym;
  if (step.type !== 'gate') {
    g.count = (g.count || 0) + 1;
    if (!lastOfWorld(g.stage) && g.count >= STAGE_SESSIONS) stageUp(s, now, msgs);
    else if (lastOfWorld(g.stage) && g.count === STAGE_SESSIONS && !g.finished) msgs.push(`🏆 ${homeWorld(s).test} is open! Do it on a day you feel fresh.`);
  }
  // Week done (all circuits and cardio; an open Test Day carries over into the next week).
  const steps = homeSteps(s);
  if (steps.every((x, i) => x.type === 'gate' || g.done[i])) rollWeek(s, steps);
}
function rollWeek(s, steps) {
  const g = s.gym;
  g.done = {}; g.week = (g.week || 1) + 1;
  g.rot = ((g.rot || 0) + steps.filter(x => x.type === 'lift').length) % 2;
}
function stageUp(s, now, msgs) {
  const g = s.gym, was = homeStage(s);
  g.stage += 1; g.count = 0; g.stageAt = now; g.adj = {}; // a new stage: new rungs, so "easier / harder" starts again
  g.world = HOME_STAGES[Math.min(g.stage, HOME_MAX - 1)].world;
  msgs.push(`💪 ${was.name} cleared! Next: ${homeStage(s).name}. Your moves step up a little.`);
}
// Test Day: `logs` hold one result per test ({ id: { reps: [n] } }).
export function passHomeTest(s, logs, now, msgs) {
  const g = s.gym, w = homeWorld(s);
  g.lifts ||= {};
  if (g.checkin) return placeFromCheckin(s, logs, now, msgs);
  for (const [id, x] of Object.entries(logs || {})) {
    const v = (x.reps || []).map(Number).filter(r => r > 0);
    if (v.length) { (g.lifts[id] ||= []).push({ ts: now, kg: 0, reps: v.slice(0, 1) }); g.lifts[id] = g.lifts[id].slice(-30); }
  }
  const steps = homeSteps(s), st = homeStanding(s, g.stage, now - 1);
  if (!st.every(x => x.ok)) {
    msgs.push(`Good test! Not quite there yet (${st.filter(x => !x.ok).map(x => `${x.name}: ${x.text}`).join(' · ')}). 3 more sessions, then try again 💪`);
    g.count = STAGE_SESSIONS - 3; clearGate(g, steps);
    return false;
  }
  clearGate(g, steps);
  if (g.stage >= HOME_MAX - 1) { g.finished = true; msgs.push(`👑 ${w.name} conquered. Home Champion!`); return true; }
  stageUp(s, now, msgs);
  msgs.push(`🏆 ${w.test} passed! Welcome to ${homeWorld(s).emoji} ${homeWorld(s).name}.`);
  return true;
}
// The test's tick goes (the rest of the week stays as it is): the step it sat on disappears.
function clearGate(g, steps) { steps.forEach((x, i) => { if (x.type === 'gate') delete g.done[i]; }); }
export function skipHomeTest(state) {
  const s = JSON.parse(JSON.stringify(state));
  if (s.gym.checkin) { delete s.gym.checkin; return s; } // no Check-in: they keep the level from "how fit do you feel"
  s.gym.count = STAGE_SESSIONS - 3;
  return s;
}
// "Easier" / "Harder" on a move type: one rung, kept until the next stage.
export function adjust(state, cat, d) {
  const s = JSON.parse(JSON.stringify(state)), r = rungOf(s, cat);
  if ((d < 0 && !r.easier) || (d > 0 && !r.harder)) return s;
  if (d < 0 && s.gym.floor?.[cat] === r.id) delete s.gym.floor[cat]; // too hard after all: the floor goes
  s.gym.adj = { ...(s.gym.adj || {}), [cat]: (s.gym.adj?.[cat] || 0) + d };
  return s;
}
// Weekly cardio minutes: cardio sessions in full, circuits count about half (they're mixed).
export function homeCardio(s) {
  const steps = homeSteps(s).filter(x => x.home);
  const inSessions = steps.reduce((t, x) => t + (x.type === 'engine' ? x.minutes : Math.round(x.minutes / 2)), 0);
  const free = Math.max(0, 7 - gymDays(s)), need = Math.max(0, 150 - inSessions);
  return { inSessions, need, walks: need ? Math.min(free, Math.ceil(need / 30)) : 0, free };
}
