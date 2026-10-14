// Game rules. Pure functions over a plain state object, so they run in the browser and in Node tests.
// Every function that changes state returns a new state; `now` is a timestamp in ms.
import { RUN_LEVELS, PREP_STAGES, REBUILD_STAGES, WORLDS, DAILY_ORDERS } from './data/tracks.js';
import * as TRI from './tri.js';
import * as HYB from './hybrid.js';
import * as ST from './standards.js';
import * as BG from './background.js';
import { TRI_WORLDS } from './data/tri.js';
import { HYBRID_WORLDS } from './data/hybrid.js';

export const DAY = 864e5;
export const XP = { run: 30, swim: 30, bike: 30, lift: 30, engine: 30, maint: 25, prep: 20, slot: 20, rest: 10, gate: 100, proveit: 30, painCheck: 5, daily: 5, restDay: 10, weekBonus: 50 };
const SESSION_TYPES = new Set(['run', 'prep', 'slot', 'gate', 'proveit']);

// ---------- dates ----------
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function weekKey(ts) {
  const d = new Date(ts);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(monday.getTime());
}
const daysBetween = (a, b) => Math.floor((startOfDay(b) - startOfDay(a)) / DAY);
const startOfDay = ts => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const clone = s => JSON.parse(JSON.stringify(s));

// ---------- state ----------
export function newState(now) {
  return {
    v: 1,
    createdAt: now,
    profile: { name: '', goal: '', daysPerWeek: 3 },
    run: { level: 1, done: {}, startedAt: now, stars: {}, reclaim: null, gatePassed: false },
    prep: { level: 0, done: {}, startedAt: now, mastered: false },
    rebuild: { active: false, stage: 0, done: {}, savedRunLevel: null, redFlag: false },
    refresher: null,
    needsReassessment: null,
    xp: 0,
    history: [],
    pending: [],
    weekBonus: {},
    daily: {},
    badges: {},
    returnHandledFor: null,
  };
}

export const runLevel = n => RUN_LEVELS[n - 1];
export const worldOf = level => WORLDS.find(w => w.id === level.world);

// ---------- placement ----------
const CONTINUOUS_MIN = { none: 0, jogwalk20: 0, '10-15': 12, '20-30': 25, '30-45': 40, '45-75': 60, '75-120': 90, '120+': 150 };

const CRITERIA = {
  1: () => true,
  2: a => a.continuous !== 'none',
  3: a => CONTINUOUS_MIN[a.continuous] >= 10,
  4: a => a.longestKm >= 5,
  5: a => a.best5k > 0 && a.best5k <= 35 * ST.timeFactor(a.sex) && a.runsLast4w / 4 >= 2,
  6: a => a.best5k > 0 && a.best5k <= 30 * ST.timeFactor(a.sex),
  7: a => a.longestKm >= 8,
  8: a => a.best10k > 0 && a.best10k <= 60 * ST.timeFactor(a.sex),
  9: a => a.longestKm >= 14,
  10: a => !!a.halfDone,
  11: a => a.longestKm >= 25 && a.weeklyKm >= 40,
  12: a => !!a.marathonDone,
  13: a => !!a.ultraDone || a.longestKm >= 50,
};

// Highest level whose criteria are met. Someone who has barely run in the last 4 weeks is
// treated like a long break (over 12 weeks: up to 3 levels lower).
export function qualifyingLevel(a) {
  let q = 1;
  for (let n = 13; n >= 1; n--) if (CRITERIA[n](a)) { q = n; break; }
  if ((a.runsLast4w ?? 0) < 2) q = Math.max(1, q - 3);
  return q;
}

// Prep stage from the self-test: consecutive gates passed, capped at P3 until the
// in-app landing and hop tests are done.
export function prepFromSelfTest(selfTest = {}) {
  let p = 0;
  for (const k of ['t0', 't1', 't2', 't3']) { if (selfTest[k]) p++; else break; }
  return Math.min(p, 3);
}

// Prep stage to start at. Running at a level already shows the body prep that level needs, so
// experienced runners are credited with it, unless they told us otherwise:
// - a body-check test left unticked is a weakness: start just before it;
// - pain or warning signs: stay careful (no higher than P2; the Rebuild Track takes over anyway).
export function prepCredit(a, q = qualifyingLevel(a)) {
  const byLevel = runLevel(Math.min(Math.max(q, 1), RUN_LEVELS.length)).needsPrep;
  const st = a.selfTest || {};
  const failed = ['t0', 't1', 't2', 't3'].findIndex(k => st[k] === false);
  let p = failed >= 0 ? Math.min(byLevel, failed) : Math.max(byLevel, prepFromSelfTest(st));
  if (a.pain === 'mild' || a.pain === 'more' || (a.redFlags || []).length) p = Math.min(p, 2);
  return Math.max(0, Math.min(p, PREP_STAGES.length - 1));
}

export function placeFromAnswers(state, a, now) {
  const s = clone(state);
  const q = qualifyingLevel(a);
  let placed = Math.max(1, q - 1);
  if (s.needsReassessment) {
    placed = Math.max(s.needsReassessment.oldLevel - 3, placed, 1);
    s.needsReassessment = null;
  }
  s.answers = a;
  s.profile = { ...s.profile, sex: a.sex || s.profile.sex, name: a.name || s.profile.name, goal: a.goal || '', daysPerWeek: clampInt(a.daysPerWeek, 2, 6, 3) };
  s.run = { ...s.run, level: placed, done: {}, startedAt: now, gatePassed: false };
  s.prep = { ...s.prep, level: prepCredit(a, q), done: {}, startedAt: now, credited: 1 };
  const redFlag = (a.redFlags || []).length > 0;
  if (a.pain === 'mild' || a.pain === 'more' || redFlag) {
    s.rebuild = { active: true, stage: 0, done: {}, savedRunLevel: placed, redFlag, seeProfessional: a.pain === 'more' || redFlag };
  }
  s.placedAt = now;
  return { state: s, qualifying: q, placed };
}
const clampInt = (v, lo, hi, def) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };

// ---------- which track is active ----------
// rebuild > refresher > run. The Prep Track runs beside run/refresher, and pauses during rebuild.
export function activeTrack(s) {
  if (s.rebuild.active) return 'rebuild';
  if (s.refresher) return 'refresher';
  return 'run';
}

// Steps for a track, resolved for the runner (alt versions when Prep is too low) with status.
export function trackSteps(s, track) {
  let steps, done;
  if (track === 'run') { steps = runLevel(s.run.level).steps; done = s.run.done; }
  else if (track === 'prep') { steps = PREP_STAGES[s.prep.level].steps; done = s.prep.done; }
  else if (track === 'rebuild') { steps = REBUILD_STAGES[s.rebuild.stage].steps; done = s.rebuild.done; }
  else if (track === 'refresher') { steps = s.refresher?.steps || []; done = s.refresher?.done || {}; }
  else if (track === 'swim') { steps = TRI.swimSteps(s); done = s.tri.swim.done; }
  else if (track === 'bike') { steps = TRI.bikeSteps(s); done = s.tri.bike.done; }
  else if (track === 'triGate') { steps = TRI.gateSteps(s); done = s.tri.done; }
  else if (track === 'strength') { steps = HYB.strengthSteps(s); done = s.hybrid.strength.done; }
  else if (track === 'engine') { steps = HYB.engineSteps(s); done = s.hybrid.engine.done; }
  else if (track === 'hyGate') { steps = HYB.gateSteps(s); done = s.hybrid.done; }
  else if (track === 'hyMaint') { steps = HYB.maintSteps(s); done = s.hybrid.maint.done; }
  const gateOpen = gateUnlocked(s, track);
  const sex = s.profile.sex;
  return steps.map((st, idx) => {
    let step = { ...st, idx, title: ST.sexText(st.title, sex), detail: ST.sexText(st.detail, sex) };
    if (st.prepReq != null && s.prep.level < st.prepReq && st.alt) step = { ...step, ...st.alt, title: ST.sexText(st.alt.title, sex), detail: ST.sexText(st.alt.detail, sex), swapped: true };
    const d = done[idx];
    let status = d ? (d.provisional ? 'provisional' : 'done') : 'open';
    // Every lock carries a plain reason, shown wherever the step is.
    let why = null;
    const lock = reason => { status = 'locked'; why = reason; };
    if (status === 'open' && st.type === 'gate' && !gateOpen) lock(gateWhy(s, track));
    if (status === 'open' && track === 'run' && st.type === 'slot') status = 'slot';
    if (track === 'rebuild' && s.rebuild.redFlag && status === 'open' && !(s.rebuild.stage === 0 && idx === 1)) lock(WHY.redFlag);
    if ((track === 'swim' || track === 'bike') && s.rebuild.redFlag && status === 'open') lock(WHY.redFlag);
    if ((track === 'triGate' || track === 'hyGate') && s.rebuild.active && status === 'open') lock(s.rebuild.redFlag ? WHY.redFlag : WHY.rebuild); // races wait until rebuilt
    if ((track === 'strength' || track === 'engine') && status === 'open' && !HYB.inFocus(s, track)) { lock(WHY.held(track)); step = { ...step, held: true }; }
    if ((track === 'strength' || track === 'engine' || track === 'hyMaint') && s.rebuild.redFlag && status === 'open') lock(WHY.redFlag);
    // Rebuild (no red flags): erg, swim, bike and upper-body work carry on; running and jumping wait.
    if ((track === 'strength' || track === 'engine' || track === 'hyMaint') && s.rebuild.active && !s.rebuild.redFlag && status === 'open' && IMPACT.test(`${st.title} ${st.detail || ''}`)) lock(WHY.rebuildImpact);
    if (why) step = { ...step, lockReason: why };
    return { ...step, status, xp: XP[st.type] || 0 };
  });
}

const IMPACT = /\brun\b|running|race|simulation|\bsim\b|burpee|jump|lunge|sprint|wall ball|brick/i;
export const WHY = {
  redFlag: 'Paused: you reported warning signs. Once a physio or doctor clears you, tap "I\'ve been cleared".',
  rebuild: 'Races wait while you\'re on the Rebuild Track. Finish it, or tap "I\'m pain-free" if the pain has gone.',
  rebuildImpact: 'Running and jumping wait while you\'re on the Rebuild Track. Erg, bike and upper-body work carry on if they\'re pain-free.',
  held: lane => `This is a ${lane === 'strength' ? 'Engine' : 'Strength'} block: ${lane} is on maintenance and builds again next block.`,
};
function gateWhy(s, track) {
  if (track === 'run') { const p = levelProgress(s); return `Earn ${p.target} XP in this level first (${p.earned} so far).`; }
  if (track === 'triGate' || track === 'hyGate') return 'Opens when all three lanes reach this world\'s flags.';
  if (track === 'rebuild' && s.rebuild.redFlag) return WHY.redFlag;
  return 'Do 2 of the sessions above first.';
}

export function levelXpTarget(steps) {
  const total = steps.filter(st => st.type !== 'gate').reduce((t, st) => t + (XP[st.type] || 0), 0);
  return Math.round(total * 0.7 / 10) * 10;
}
function earnedInLevel(steps, done) {
  return steps.reduce((t, st, i) => t + (done[i] && st.type !== 'gate' ? XP[st.type] || 0 : 0), 0);
}

// Run gate: needs 70% of the level's step XP. Prep/rebuild gates: 2 of the 3 sessions.
export function gateUnlocked(s, track) {
  if (track === 'run') { const st = runLevel(s.run.level).steps; return earnedInLevel(st, s.run.done) >= levelXpTarget(st) * (BG.fast(s, 'run') ? 0.5 : 1); }
  if (track === 'prep') return Object.keys(s.prep.done).length >= 2;
  if (track === 'rebuild') return !s.rebuild.redFlag && Object.keys(s.rebuild.done).length >= 2;
  if (track === 'refresher') return true;
  if (track === 'swim') return BG.fast(s, 'swim') || Object.keys(s.tri.swim.done).length >= 2;
  if (track === 'bike') return BG.fast(s, 'bike') || Object.keys(s.tri.bike.done).length >= 2;
  if (track === 'triGate') return TRI.lanesReady(s);
  if (track === 'strength') return BG.fast(s, 'strength') || Object.keys(s.hybrid.strength.done).length >= 2;
  if (track === 'engine') return BG.fast(s, 'engine') || Object.keys(s.hybrid.engine.done).length >= 2;
  if (track === 'hyGate') return HYB.lanesReady(s);
  if (track === 'hyMaint') return true;
  return false;
}

export function levelProgress(s) {
  const steps = runLevel(s.run.level).steps;
  return { earned: earnedInLevel(steps, s.run.done), target: Math.round(levelXpTarget(steps) * (BG.fast(s, 'run') ? 0.5 : 1) / 10) * 10, fast: BG.fast(s, 'run') };
}

// Former athletes: credit the technique they kept, then put Tri / Hybrid worlds where the lanes now are.
export function applyBackground(state, background) {
  const s = clone(state);
  s.background = (background || []).filter(b => b && b.sport && b.level);
  if (s.tri) {
    s.tri.swim.stage = Math.max(s.tri.swim.stage, BG.skillFloor(s.background, 'swim'));
    s.tri.bike.stage = Math.max(s.tri.bike.stage, BG.skillFloor(s.background, 'bike'));
    const n = TRI_WORLDS.length, w = [...Array(n).keys()].findIndex(i => TRI.laneStatus(s, i).some(l => !l.ok));
    s.tri.world = Math.max(s.tri.world, w < 0 ? n - 1 : w);
  }
  if (s.hybrid) {
    s.hybrid.strength.stage = Math.max(s.hybrid.strength.stage, BG.skillFloor(s.background, 'strength'));
    s.hybrid.engine.stage = Math.max(s.hybrid.engine.stage, BG.skillFloor(s.background, 'engine'));
    const n = HYBRID_WORLDS.length, w = [...Array(n).keys()].findIndex(i => HYB.laneStatus(s, i).some(l => !l.ok));
    s.hybrid.world = Math.max(s.hybrid.world, w < 0 ? n - 1 : w);
  }
  return s;
}

// ---------- XP helpers ----------
export function streakMultiplier(s, now) {
  let weeks = 0;
  for (let i = 1; i <= 8; i++) { if (s.weekBonus[weekKey(now - i * 7 * DAY)]) weeks++; else break; }
  return weeks >= 4 ? 1.25 : weeks >= 2 ? 1.1 : 1;
}

// Consecutive days with any activity. Days inside a sick pause are neutral: the streak freezes.
export function dayStreak(s, now) {
  const days = new Set(s.history.filter(h => h.kind !== 'sickday' && h.kind !== 'event').map(h => dayKey(h.ts)));
  Object.keys(s.daily).forEach(k => { if (s.daily[k].rest || (s.daily[k].orders || []).length) days.add(k); });
  let n = 0;
  for (let i = 0; i < 1000; i++) {
    const ts = now - i * DAY, k = dayKey(ts);
    if (days.has(k)) n++;
    else if (i === 0 || paused(s, ts)) continue;
    else break;
  }
  return n;
}

export function paused(s, ts) {
  return (s.pauses || []).some(p => ts >= startOfDay(p.from) && (p.to == null || ts < startOfDay(p.to) + DAY));
}

function award(s, amount, now, entry) {
  s.xp += amount;
  s.history.push({ ts: now, xp: amount, ...entry });
}

function sessionsThisWeek(s, now) {
  const wk = weekKey(now);
  return s.history.filter(h => h.kind === 'session' && weekKey(h.ts) === wk).length;
}

function afterSession(s, now, msgs) {
  const wk = weekKey(now);
  if (!s.weekBonus[wk] && sessionsThisWeek(s, now) >= s.profile.daysPerWeek) {
    s.weekBonus[wk] = true;
    award(s, XP.weekBonus, now, { kind: 'bonus', title: 'Weekly consistency bonus' });
    msgs.push(`Weekly consistency bonus: +${XP.weekBonus} XP`);
  }
  badge(s, 'first_step', now, msgs);
  if (new Date(now).getHours() < 7) badge(s, 'early_bird', now, msgs);
  const streak = dayStreak(s, now);
  if (streak >= 7) badge(s, 'streak_7', now, msgs);
  if (streak >= 30) badge(s, 'streak_30', now, msgs);
  if (streak >= 100) badge(s, 'streak_100', now, msgs);
}

export const BADGES = {
  first_step: { name: 'First Step', emoji: '👟', desc: 'Completed your first session' },
  early_bird: { name: 'Early Bird', emoji: '🌅', desc: 'Logged a session before 7am' },
  streak_7: { name: 'Streak 7', emoji: '🔁', desc: '7 days in a row with activity' },
  streak_30: { name: 'Streak 30', emoji: '🔥', desc: '30 days in a row with activity' },
  streak_100: { name: 'Streak 100', emoji: '💯', desc: '100 days in a row with activity' },
  first_boss: { name: 'First Race', emoji: '🏁', desc: 'Beat a boss level' },
  comeback: { name: 'Comeback', emoji: '🔄', desc: 'Finished a refresher course' },
  rebuilt: { name: 'Rebuilt', emoji: '🩹', desc: 'Finished the Rebuild Track' },
  prep_master: { name: 'Elastic', emoji: '🪃', desc: 'Finished the whole Prep Track' },
  challenger: { name: 'Challenger', emoji: '🏆', desc: 'Completed a friend challenge' },
  tri_gate: { name: 'Transition', emoji: '⚡', desc: 'Cleared a triathlon transition gate' },
  hybrid_gate: { name: 'Station Master', emoji: '🏋️', desc: 'Cleared a Hybrid race gate' },
  finisher: { name: 'Finisher', emoji: '🏅', desc: 'Finished a race, any time counts' },
};
function badge(s, id, now, msgs) {
  if (s.badges[id]) return;
  s.badges[id] = now;
  msgs.push(`Badge unlocked: ${BADGES[id].emoji} ${BADGES[id].name}`);
}

// ---------- completing steps ----------
// opts: { pain (0-10), passed (Prove It / boss result), now,
//   result: 'full' | 'partial' | 'none', actual / note (the athlete's own words, for the coach),
//   backdated (done on an earlier day; `now` is that day), morningOk (backdated: fine the morning after?) }
// Returns { state, outcome } where outcome.status is one of:
//   done | provisional | repeat | stepBack | rebuildPrompt
export function completeStep(state, track, idx, opts) {
  const s = clone(state);
  const now = opts.now;
  const pain = opts.pain ?? 0;
  const step = trackSteps(s, track)[idx];
  const msgs = [];
  const out = st => ({ state: s, outcome: { status: st, messages: msgs, xp: s.xp - state.xp } });
  if (!step || step.status === 'done' || step.status === 'locked') return out('ignored');
  const isRest = step.type === 'rest';

  const words = { ...(clean(opts.actual) ? { actual: clean(opts.actual) } : {}), ...(clean(opts.note) ? { note: clean(opts.note) } : {}) };
  if (!isRest) award(s, XP.painCheck, now, { kind: 'check', title: 'Pain check-in', pain });

  if (!isRest && pain >= 5) {
    if (track === 'rebuild') {
      s.rebuild.stage = Math.max(0, s.rebuild.stage - 1);
      s.rebuild.done = {};
      msgs.push('Pain 5/10 or more: stepping back one stage. Please consider getting it checked by a physio or doctor.');
      return out('stepBack');
    }
    if (s.rebuild.active) { msgs.push('Pain 5/10 or more: stop and rest today. Please get it checked if it continues.'); return out('repeat'); }
    msgs.push('Pain 5/10 or more: stop this session. The Rebuild Track is the safer path for now.');
    return out('rebuildPrompt');
  }
  if (!isRest && pain >= 3) {
    msgs.push(`Pain ${pain}/10: this step is not counted yet. Repeat it when it feels better.`);
    return out('repeat');
  }

  // Pain 0-2: the step counts.
  const mult = streakMultiplier(s, now);
  const base = step.type === 'slot' ? XP.prep : XP[step.type] || 0;
  // Attempted but not finished: effort still earns something, the step stays open to finish later.
  if (!isRest && (opts.result === 'partial' || opts.result === 'none')) {
    const part = opts.result === 'partial' ? Math.round(base * 0.5 * mult) : 0;
    award(s, part, now, { kind: opts.result === 'partial' ? 'session' : 'attempt', partial: true, track, level: levelNumber(s, track), idx, title: step.title, pain, ...words });
    msgs.push(opts.result === 'partial' ? `Partly done: +${part} XP for the effort. The step stays open: finish it another day 💪` : 'Logged. Not every day is a good day: the step stays open for when you\'re ready 💛');
    if (opts.result === 'partial') afterSession(s, now, msgs);
    return out('partial');
  }
  // Done on an earlier day: the morning after has already happened, so ask instead of waiting.
  const nextDayCheck = step.type === 'run' || step.type === 'proveit' || (step.type === 'gate' && step.nextDay);
  if (opts.backdated && nextDayCheck && opts.morningOk === false) {
    msgs.push('Sore the morning after (above 2/10): this one isn\'t counted yet. Repeat it when it feels better.');
    return out('repeat');
  }
  const gained = Math.round(base * mult);
  const doneMap = doneMapOf(s, track);
  const provisional = step.type === 'gate' && step.nextDay && !opts.backdated;
  doneMap[idx] = { ts: now, pain, ...(provisional ? { provisional: true } : {}), ...(opts.passed != null ? { passed: !!opts.passed } : {}), ...(opts.race ? { race: opts.race } : {}) };
  award(s, gained, now, { kind: isRest ? 'rest' : 'session', track, level: levelNumber(s, track), idx, title: step.title, pain, ...words, ...(opts.backdated ? { backdated: true } : {}) });
  msgs.push(`+${gained} XP${mult > 1 ? ` (streak x${mult})` : ''}`);
  if (isRest) s.daily[dayKey(now)] = { ...(s.daily[dayKey(now)] || {}), rest: true };

  // Pending next-morning check for runs and next-day gates.
  if (!opts.backdated && (step.type === 'run' || step.type === 'proveit' || provisional)) {
    s.pending.push({ ts: now, track, level: levelNumber(s, track), idx, gate: provisional, pain });
  }

  // A Prep Track step also fills the next empty Prep slot in the run level.
  if (track === 'prep' && activeTrack(s) === 'run') {
    const slotIdx = runLevel(s.run.level).steps.findIndex((st, i) => st.type === 'slot' && !s.run.done[i]);
    if (slotIdx >= 0) { s.run.done[slotIdx] = { ts: now, pain, viaPrep: true }; msgs.push('Also filled a Prep slot in your run level.'); }
  }

  if (step.type === 'gate' && !provisional) passGate(s, track, now, msgs, opts);
  if (track === 'refresher') refresherProgress(s, step, opts, now, msgs);
  if (!isRest) afterSession(s, now, msgs);
  return out(provisional ? 'provisional' : 'done');
}

const clean = t => String(t ?? '').replace(/[<>]/g, '').trim().slice(0, 300);

function levelNumber(s, track) {
  if (track === 'run') return s.run.level;
  if (track === 'prep') return s.prep.level;
  if (track === 'rebuild') return s.rebuild.stage;
  if (track === 'swim') return s.tri.swim.stage;
  if (track === 'bike') return s.tri.bike.stage;
  if (track === 'triGate') return s.tri.world;
  if (track === 'strength') return s.hybrid.strength.stage;
  if (track === 'engine') return s.hybrid.engine.stage;
  if (track === 'hyGate') return s.hybrid.world;
  if (track === 'hyMaint') return s.hybrid.maint.week;
  return 'refresher';
}

function doneMapOf(s, track) {
  return { run: s.run.done, prep: s.prep.done, rebuild: s.rebuild.done, refresher: s.refresher?.done,
    swim: s.tri?.swim.done, bike: s.tri?.bike.done, triGate: s.tri?.done,
    strength: s.hybrid?.strength.done, engine: s.hybrid?.engine.done, hyGate: s.hybrid?.done, hyMaint: s.hybrid?.maint.done }[track];
}

function passGate(s, track, now, msgs, opts = {}) {
  if (track === 'run') {
    const lvl = runLevel(s.run.level);
    const stars = starsFor(s, now);
    s.run.stars[lvl.n] = Math.max(s.run.stars[lvl.n] || 0, stars);
    msgs.push(`${lvl.name} cleared with ${'⭐'.repeat(stars)}`);
    if (lvl.steps.find(st => st.type === 'gate')?.boss) badge(s, 'first_boss', now, msgs);
    s.run.gatePassed = true;
    tryAdvanceRun(s, now, msgs);
    if (TRI.hasTri(s) && TRI.lanesReady(s)) msgs.push(`🌉 Your running unlocked the ${TRI.triWorld(s).name} transition gate on the Tri map!`);
    if (HYB.hasHybrid(s) && HYB.lanesReady(s)) msgs.push(`🏁 Your running unlocked the ${HYB.hybWorld(s).name} race gate on the Hybrid map!`);
  } else if (track === 'prep') {
    if (s.prep.level >= 7) { s.prep.mastered = true; s.prep.done = {}; badge(s, 'prep_master', now, msgs); return; }
    s.prep.level += 1;
    s.prep.done = {};
    s.prep.startedAt = now;
    msgs.push(`Prep stage up: P${s.prep.level} ${PREP_STAGES[s.prep.level].name}`);
    tryAdvanceRun(s, now, msgs);
  } else if (track === 'swim' || track === 'bike') {
    const lane = s.tri[track];
    lane.stage += 1;
    lane.done = {};
    const ladder = track === 'swim' ? TRI.SWIM_MAX : TRI.BIKE_MAX;
    msgs.push(lane.stage >= ladder ? `${TRI.LANE_ICON[track]} ${TRI.LANE_LABEL[track]} ladder complete!`
      : `${TRI.LANE_ICON[track]} ${TRI.LANE_LABEL[track]} stage up: ${(track === 'swim' ? TRI.swimStage(s) : TRI.bikeStage(s)).name}`);
    if (TRI.lanesReady(s)) msgs.push(`🌉 All three lanes are ready: the ${TRI.triWorld(s).name} transition gate is open!`);
  } else if (track === 'strength' || track === 'engine') {
    const lane = s.hybrid[track];
    lane.stage += 1;
    lane.done = {};
    const max = track === 'strength' ? HYB.STR_MAX : HYB.ENG_MAX;
    msgs.push(lane.stage >= max ? `${HYB.LANE_ICON[track]} ${HYB.LANE_LABEL[track]} ladder complete!`
      : `${HYB.LANE_ICON[track]} ${HYB.LANE_LABEL[track]} stage up: ${(track === 'strength' ? HYB.strengthStage(s) : HYB.engineStage(s)).name}`);
    if (HYB.lanesReady(s)) msgs.push(`🏁 All three lanes are ready: the ${HYB.hybWorld(s).name} race gate is open!`);
  } else if (track === 'hyGate') {
    const w = HYB.hybWorld(s);
    const r = raceResult(s, 'hyGate');
    s.hybrid.done = {};
    s.hybrid.stars = { ...(s.hybrid.stars || {}), [s.hybrid.world]: Math.max(s.hybrid.stars?.[s.hybrid.world] || 0, r.stars) };
    badge(s, 'finisher', now, msgs);
    if (r.label) msgs.push(r.label);
    // Strong Finish needs a solid solo time to unlock the Pro League.
    if (s.hybrid.world === 4 && !(r.solo && (r.tier === 'solid' || r.tier === 'fast'))) {
      s.hybrid.speedFocus = true; s.hybrid.block.next = 'engine';
      msgs.push(`Great finish! 🏅 The Pro League opens with a solo race under ${r.std ? fmtMin(r.std.solid) : 'your solid standard'}. Your plan now leans on engine and race-pace work.`);
      return;
    }
    if (r.tier === 'slow') { s.hybrid.speedFocus = true; s.hybrid.block.next = 'engine'; msgs.push('You finished, that counts! Next up: some speed work to move faster through the stations and runs.'); }
    badge(s, 'hybrid_gate', now, msgs);
    if (w.gate.boss) badge(s, 'first_boss', now, msgs);
    if (s.hybrid.world >= HYBRID_WORLDS.length - 1) { s.hybrid.finished = true; msgs.push(`👑 ${w.name} conquered!`); return; }
    s.hybrid.world += 1;
    msgs.push(`🏁 ${w.name} cleared! Welcome to ${HYB.hybWorld(s).emoji} ${HYB.hybWorld(s).name}`);
  } else if (track === 'triGate') {
    const w = TRI.triWorld(s);
    const r = raceResult(s, 'triGate');
    s.tri.done = {};
    s.tri.stars = { ...(s.tri.stars || {}), [s.tri.world]: Math.max(s.tri.stars?.[s.tri.world] || 0, r.stars) };
    if (w.gate.boss) badge(s, 'finisher', now, msgs);
    if (r.label) msgs.push(r.label);
    // 70.3 and full distance only count inside the official cut-off.
    if (r.std?.cutoff && r.minutes > r.std.cutoff) {
      s.tri.speedFocus = true;
      msgs.push(`You went the whole distance, respect! 🏅 To clear ${w.name} the finish needs to be within the official cut-off (${fmtMin(r.std.cutoff)}). Your plan adds pacing and speed work for your limiter.`);
      return;
    }
    if (r.tier === 'slow') { s.tri.speedFocus = true; msgs.push('Finished! Next up: some pace work on your limiter to move faster.'); }
    badge(s, 'tri_gate', now, msgs);
    if (w.gate.boss) badge(s, 'first_boss', now, msgs);
    if (s.tri.world >= TRI_WORLDS.length - 1) { s.tri.finished = true; msgs.push(`🏆 ${w.name} conquered. Full-distance triathlete!`); return; }
    s.tri.world += 1;
    msgs.push(`🌉 ${w.name} cleared! Welcome to ${TRI.triWorld(s).emoji} ${TRI.triWorld(s).name}`);
  } else if (track === 'rebuild') {
    if (s.rebuild.stage < 3) {
      s.rebuild.stage += 1;
      s.rebuild.done = {};
      msgs.push(`Rebuild stage up: R${s.rebuild.stage + 1} ${REBUILD_STAGES[s.rebuild.stage].name}`);
    } else {
      const saved = s.rebuild.savedRunLevel || s.run.level;
      const back = Math.max(1, saved - 1);
      s.run = { ...s.run, level: back, done: {}, startedAt: now, gatePassed: false, reclaim: saved > back ? saved : s.run.reclaim };
      s.rebuild = { active: false, stage: 0, done: {}, savedRunLevel: null, redFlag: false };
      badge(s, 'rebuilt', now, msgs);
      msgs.push(`Rebuild complete. Back on the Run Track at ${runLevel(back).name}; reclaim ${runLevel(saved).name} quickly.`);
    }
  }
}

// Stars: 1 = gate passed, 2 = gate + every step, 3 = every step + no gap over 7 days in the level.
function starsFor(s, now) {
  const steps = runLevel(s.run.level).steps;
  const allDone = steps.every((st, i) => st.type === 'gate' || s.run.done[i]);
  if (!allDone) return 1;
  const times = [s.run.startedAt, ...Object.values(s.run.done).map(d => d.ts), now].sort((a, b) => a - b);
  const consistent = times.every((t, i) => i === 0 || daysBetween(times[i - 1], t) <= 7);
  return consistent ? 3 : 2;
}

const fmtMin = m => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;

// Finish time at a race gate -> speed tier and stars, against the athlete's own category.
function raceResult(s, track) {
  const done = track === 'hyGate' ? s.hybrid.done : s.tri.done;
  const race = done?.[0]?.race || {};
  const minutes = +race.time || 0;
  let std = null, solo = true;
  if (track === 'hyGate') {
    solo = (race.format || 'solo') === 'solo';
    if (solo && (race.event === 'hyrox' || race.event === 'alphax')) std = ST.raceStandard(race.event, race.division, s.profile.sex);
  } else {
    std = ST.raceStandard(ST.TRI_WORLD_RACE[s.tri.world], null, s.profile.sex);
  }
  const tier = ST.raceTier(minutes, std);
  const stars = ST.TIER_STARS[tier];
  const label = minutes ? `⏱️ ${fmtMin(minutes)}: ${ST.TIER_LABEL[tier]} ${'⭐'.repeat(stars)}${std ? ` (solid ${fmtMin(std.solid)}, fast ${fmtMin(std.fast)})` : ''}` : '';
  return { minutes, std, tier, stars, solo, label };
}

function tryAdvanceRun(s, now, msgs) {
  if (!s.run.gatePassed || s.run.level >= RUN_LEVELS.length) return;
  const next = runLevel(s.run.level + 1);
  if (s.prep.level < next.needsPrep) {
    msgs.push(`${next.name} unlocks when you reach Prep stage P${next.needsPrep}. Keep going on the Prep Track.`);
    return;
  }
  s.run = { ...s.run, level: next.n, done: {}, startedAt: now, gatePassed: false };
  if (s.run.reclaim && next.n >= s.run.reclaim) s.run.reclaim = null;
  msgs.push(`Level up! Welcome to ${next.name} (${worldOf(next).emoji} ${worldOf(next).name})`);
}

// Someone placed before Prep was credited from their running: give it once now, and move them up
// if that was all that held them back. Returns { state, msgs } (msgs empty when nothing changed).
export function creditPrep(state, now) {
  if (state.prep?.credited || !state.answers || state.rebuild?.active) return { state, msgs: [] };
  const s = clone(state);
  s.prep = { ...s.prep, credited: 1 };
  const reached = Math.max(qualifyingLevel(s.answers), s.run.level, s.run.reclaim || 0);
  const p = prepCredit(s.answers, reached);
  const msgs = [];
  if (p > s.prep.level) {
    s.prep = { ...s.prep, level: p, done: {} };
    msgs.push(`Prep Track set to P${p} to match your running level. No need to redo the basics.`);
    tryAdvanceRun(s, now, msgs);
  }
  return { state: s, msgs };
}

export function prepBlocksRun(s) {
  if (!s.run.gatePassed || s.run.level >= RUN_LEVELS.length) return null;
  const next = runLevel(s.run.level + 1);
  return s.prep.level < next.needsPrep ? next.needsPrep : null;
}

// ---------- pain flows ----------
export function enterRebuild(state, { redFlag = false, now }) {
  const s = clone(state);
  s.rebuild = { active: true, stage: 0, done: {}, savedRunLevel: Math.max(s.run.level, s.refresher?.fromLevel || 0), redFlag, seeProfessional: true };
  s.refresher = null;
  s.pending = [];
  s.history.push({ ts: now, kind: 'event', title: 'Entered Rebuild Track', xp: 0 });
  return s;
}

// Pain gone before the Rebuild Track is finished: back to training, one level below the saved
// one with a quick reclaim (the same landing as finishing R4).
export function leaveRebuild(state, now) {
  const s = clone(state);
  if (!s.rebuild.active) return s;
  const saved = s.rebuild.savedRunLevel || s.run.level;
  const back = Math.max(1, saved - 1);
  s.run = { ...s.run, level: back, done: {}, startedAt: now, gatePassed: false, reclaim: saved > back ? saved : s.run.reclaim };
  s.rebuild = { active: false, stage: 0, done: {}, savedRunLevel: null, redFlag: false };
  s.history.push({ ts: now, kind: 'event', title: 'Pain-free: back from the Rebuild Track', xp: 0 });
  return s;
}

export function clearRedFlag(state, now) {
  const s = clone(state);
  s.rebuild.redFlag = false;
  s.history.push({ ts: now, kind: 'event', title: 'Cleared by a professional', xp: 0 });
  return s;
}

// Next-morning check for everything logged before today. One pain rating covers them all.
export function pendingChecks(s, now) {
  return s.pending.filter(p => dayKey(p.ts) !== dayKey(now));
}

export function morningCheck(state, pain, now) {
  const s = clone(state);
  const due = pendingChecks(s, now);
  const msgs = [];
  s.pending = s.pending.filter(p => !due.includes(p) && dayKey(p.ts) === dayKey(now));
  const worse = due.some(p => pain - (p.pain ?? 0) >= 2);
  award(s, XP.painCheck, now, { kind: 'check', title: 'Morning pain check', pain });

  for (const p of due.filter(p => p.gate)) {
    const map = doneMapOf(s, p.track);
    if (!map || !map[p.idx] || levelNumber(s, p.track) !== p.level) continue;
    if (pain <= 2) { delete map[p.idx].provisional; passGate(s, p.track, now, msgs); }
    else { delete map[p.idx]; msgs.push('Gate not passed yet: next-morning pain was above 2/10. Retake it when ready.'); }
  }

  let status = 'ok';
  if (pain >= 5 || (worse && pain >= 3)) {
    if (s.rebuild.active) {
      s.rebuild.stage = Math.max(0, s.rebuild.stage - 1);
      s.rebuild.done = {};
      msgs.push('Pain is up this morning: stepping back one Rebuild stage. Consider a physio check.');
      status = 'stepBack';
    } else {
      msgs.push('Pain is up this morning. The Rebuild Track is the safer path for now.');
      status = 'rebuildPrompt';
    }
  } else if (pain >= 3) {
    msgs.push(`Morning pain ${pain}/10: take it easy today and repeat yesterday's load before progressing.`);
    status = 'caution';
  } else {
    msgs.push('Morning check looks good.');
  }
  return { state: s, outcome: { status, messages: msgs } };
}

// ---------- return after a break ----------
export function lastActive(s) {
  const sessions = s.history.filter(h => h.kind === 'session' || h.kind === 'rest').map(h => h.ts);
  return Math.max(s.placedAt || s.createdAt, ...sessions);
}

export function returnCheck(s, now) {
  if (!s.placedAt) return { needed: false };
  const last = lastActive(s);
  const gapDays = daysBetween(last, now);
  return { needed: gapDays >= 3 && s.returnHandledFor !== last, gapDays, last, short: gapDays < 7 };
}

// load = easy run min + 1.5 x hard run min + 0.5 x cross-training min (all weekly averages)
export function retention({ easyMin = 0, hardMin = 0, crossMin = 0 }, requiredWeeklyMin) {
  const load = easyMin + 1.5 * hardMin + 0.5 * crossMin;
  return {
    aerobic: requiredWeeklyMin > 0 ? load / requiredWeeklyMin : 0,
    impact: requiredWeeklyMin > 0 ? (easyMin + hardMin) / requiredWeeklyMin : 0,
    intensity: hardMin > 0,
  };
}

export function effectiveGapDays(gapDays, ret) {
  let factor;
  if (ret.aerobic >= 0.8) factor = ret.intensity ? 0 : 0.5;
  else if (ret.aerobic >= 0.5) factor = 0.5;
  else if (ret.aerobic >= 0.2) factor = 0.75;
  else factor = 1;
  return Math.round(gapDays * factor);
}

export function refresherTier(effDays) {
  if (effDays < 7) return { id: 'none', drop: 0 };
  if (effDays < 14) return { id: 'warmup', drop: 0 };
  if (effDays < 28) return { id: 'week', drop: 0 };
  if (effDays < 56) return { id: 'drop1', drop: 1 };
  if (effDays < 84) return { id: 'drop2', drop: 2 };
  return { id: 'reassess', drop: 3 };
}

const ex = (stage, session) => PREP_STAGES[stage].steps[session].ex;

function buildRefresher(tier, fromLevel, toLevel, daysPerWeek) {
  const usual = runLevel(toLevel).weeklyMin / Math.max(3, daysPerWeek);
  const min = f => `${Math.max(10, Math.round(usual * f / 5) * 5)} min`;
  const prove = { type: 'proveit', title: `Prove It: ${runLevel(fromLevel).proveIt}`, detail: 'Hit it with pain 2/10 or less and you skip the rest of this refresher.' };
  const landing = { type: 'gate', title: 'Check: landing and hop test', detail: '10 quiet stick landings and 10 single-leg hops each leg, pain-free.', ex: ['stick_landing', 'single_leg_hop'] };
  const steps = { warmup: [prove,
      { type: 'run', title: `Easy run ${min(0.75)}`, detail: 'About 75% of your usual run.' },
      { type: 'run', title: `Easy run ${min(0.75)}`, detail: '' }],
    week: [prove,
      { type: 'run', title: `Easy run ${min(0.7)}`, detail: '' },
      { type: 'prep', title: 'Strength review (P2)', ex: ex(2, 0) },
      { type: 'run', title: `Easy run ${min(0.8)}`, detail: '' },
      { type: 'prep', title: 'Landing review (P3)', ex: ex(3, 0) },
      { type: 'run', title: `Easy run ${min(0.9)}`, detail: '' },
      { type: 'gate', title: `Check: ${runLevel(toLevel).proveIt}`, detail: 'Pain-free the next day.' }],
    drop1: [prove,
      { type: 'run', title: `Easy run ${min(0.6)}`, detail: '' },
      { type: 'prep', title: 'Strength review (P2)', ex: ex(2, 0) },
      { type: 'run', title: `Easy run ${min(0.65)}`, detail: '' },
      { type: 'run', title: `Easy run ${min(0.7)}`, detail: '' },
      { type: 'prep', title: 'Landing review (P3)', ex: ex(3, 0) },
      { type: 'run', title: `Easy run ${min(0.8)}`, detail: '' },
      { type: 'run', title: `Easy run ${min(0.85)}`, detail: '' },
      { type: 'prep', title: 'Landing review (P3)', ex: ex(3, 1) },
      { type: 'run', title: `Easy run ${min(0.9)}`, detail: '' },
      landing],
    drop2: [prove,
      { type: 'run', title: `Run/walk ${min(0.5)}`, detail: 'Walk breaks whenever needed.' },
      { type: 'prep', title: 'Stability review (P1)', ex: ex(1, 0) },
      { type: 'run', title: `Easy run ${min(0.55)}`, detail: '' },
      { type: 'prep', title: 'Strength review (P2)', ex: ex(2, 0) },
      { type: 'run', title: `Easy run ${min(0.6)}`, detail: '' },
      { type: 'run', title: `Easy run ${min(0.7)}`, detail: '' },
      { type: 'prep', title: 'Strength review (P2)', ex: ex(2, 1) },
      { type: 'run', title: `Easy run ${min(0.8)}`, detail: '' },
      { type: 'prep', title: 'Landing review (P3)', ex: ex(3, 0) },
      { type: 'run', title: `Easy run ${min(0.9)}`, detail: '' },
      landing],
  };
  return steps[tier] || [];
}

const HEALTH_STEPS = [
  { type: 'run', title: 'Health check: easy 20 min walk', detail: 'No intensity. Stop if you feel unwell.' },
  { type: 'run', title: 'Health check: very easy 15-20 min jog or walk', detail: 'No intensity. Fever or chest symptoms = rest.' },
];

// answers: { reason: 'injury'|'illness'|'busy', easyMin, hardMin, crossMin, now }
export function applyReturn(state, answers) {
  const s = clone(state);
  const now = answers.now;
  const { gapDays, last } = returnCheck(s, now);
  s.returnHandledFor = last;
  const baseLevel = s.rebuild.active ? (s.rebuild.savedRunLevel || s.run.level) : s.refresher?.fromLevel || s.run.level;
  const ret = retention(answers, runLevel(baseLevel).weeklyMin);
  const eff = effectiveGapDays(gapDays, ret);
  const tier = refresherTier(eff);
  const summary = { gapDays, effectiveDays: eff, retention: ret, tier: tier.id, fromLevel: baseLevel, toLevel: baseLevel, notes: [], reason: answers.reason };

  if (answers.reason === 'illness' && !answers.fromSickMode && gapDays > 1) {
    // Reported after the fact (the usual case): freeze the streak over the days away,
    // exactly as if sick mode had been on.
    s.pauses = [...(s.pauses || []), { from: last + DAY, to: now - DAY, retro: true }];
    summary.sickDays = gapDays;
  }

  if (tier.id === 'reassess') {
    s.needsReassessment = { oldLevel: baseLevel };
    s.refresher = null;
    summary.notes.push('Long break: a short re-assessment places you again (at most 3 levels below where you were).');
    return { state: s, summary };
  }

  const toLevel = Math.max(1, baseLevel - tier.drop);
  summary.toLevel = toLevel;
  if (toLevel !== s.run.level || tier.drop > 0) {
    s.run = { ...s.run, level: toLevel, done: {}, startedAt: now, gatePassed: false, reclaim: tier.drop > 0 ? Math.max(baseLevel, s.run.reclaim || 0) : s.run.reclaim };
  }

  const prepBefore = s.prep.level;
  if (tier.id === 'drop2') s.prep.level = Math.max(0, s.prep.level - 1);
  if (ret.impact < 0.5 && eff >= 14) s.prep.level = Math.min(s.prep.level, 3);
  if (s.prep.level !== prepBefore) {
    s.prep.done = {};
    summary.notes.push(`Prep set to P${s.prep.level} ${PREP_STAGES[s.prep.level].name}: landing and hop control come back before plyometrics.`);
  }

  if (answers.reason === 'injury') {
    s.rebuild = { active: true, stage: 0, done: {}, savedRunLevel: toLevel, redFlag: false, seeProfessional: true };
    s.refresher = null;
    summary.notes.push('Injury: the Rebuild Track comes first, then you return to your level.');
    return { state: s, summary };
  }

  let steps = buildRefresher(tier.id, baseLevel, toLevel, s.profile.daysPerWeek);
  if (answers.reason === 'illness') steps = [...HEALTH_STEPS.slice(0, eff >= 14 ? 2 : 1), ...steps];
  s.refresher = steps.length ? { steps, done: {}, fromLevel: baseLevel, toLevel, tier: tier.id, startedAt: now, reason: answers.reason } : null;
  if (tier.drop > 0) summary.notes.push(`Dropped ${tier.drop} level${tier.drop > 1 ? 's' : ''}. Your old level is marked Reclaim.`);
  if (!s.refresher) summary.notes.push('Short break: carry on where you left off.');
  summary.steps = s.refresher?.steps.length || 0;
  summary.streak = dayStreak(s, now);
  return { state: s, summary };
}

function refresherProgress(s, step, opts, now, msgs) {
  const r = s.refresher;
  if (step.type === 'proveit' && opts.passed) {
    s.run = { ...s.run, level: r.fromLevel, done: r.fromLevel === s.run.level ? s.run.done : {}, startedAt: now, gatePassed: false, reclaim: null };
    s.refresher = null;
    s.pending = s.pending.filter(p => p.track !== 'refresher');
    badge(s, 'comeback', now, msgs);
    msgs.push(`Proved it! Back at ${runLevel(r.fromLevel).name}, refresher skipped.`);
    return;
  }
  const all = r.steps.every((_, i) => r.done[i] && !r.done[i].provisional);
  if (all) {
    s.refresher = null;
    s.pending = s.pending.filter(p => p.track !== 'refresher');
    badge(s, 'comeback', now, msgs);
    msgs.push('Refresher complete. Back on the Run Track.');
  }
}

// ---------- sick and busy modes ----------
// mode: { type: 'sick', where: 'above' | 'below' } or { type: 'busy' }
export function startMode(state, mode, now) {
  const s = clone(state);
  s.mode = { ...mode, since: now };
  if (mode.type === 'sick') s.pauses = [...(s.pauses || []), { from: now, to: null }];
  s.history.push({ ts: now, kind: 'event', title: mode.type === 'sick' ? 'Sick mode on' : 'Busy mode on', xp: 0 });
  return s;
}

// Ending sick mode starts the comeback: health-check steps, then a refresher by how long it lasted.
export function endMode(state, now) {
  let s = clone(state);
  const mode = s.mode;
  if (!mode) return { state: s, summary: null };
  s.mode = null;
  s.history.push({ ts: now, kind: 'event', title: mode.type === 'sick' ? 'Feeling better' : 'Busy mode off', xp: 0 });
  if (mode.type !== 'sick') return { state: s, summary: null };
  s.pauses = (s.pauses || []).map(p => (p.to == null ? { ...p, to: now } : p));
  const res = applyReturn(s, { reason: 'illness', now, fromSickMode: true });
  const sickDays = Math.max(1, daysBetween(mode.since, now));
  return { state: res.state, summary: { ...res.summary, sickDays, streak: dayStreak(res.state, now), steps: res.state.refresher?.steps.length || 0 } };
}

export function sickCheckIn(state, now) {
  const s = clone(state);
  const k = dayKey(now);
  if (s.daily[k]?.sick) return s;
  s.daily[k] = { ...(s.daily[k] || {}), sick: true };
  award(s, XP.restDay, now, { kind: 'sickday', title: 'Sick day check-in: rest is training too' });
  return s;
}

// ---------- daily orders and rest ----------
export function dailyOrders(now) {
  const k = dayKey(now);
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const idx = [];
  while (idx.length < 3) { const i = h % DAILY_ORDERS.length; if (!idx.includes(i)) idx.push(i); h = (h * 1103515245 + 12345) >>> 0; }
  return idx.map(i => ({ i, title: DAILY_ORDERS[i] }));
}

export function completeOrder(state, i, now) {
  const s = clone(state);
  const k = dayKey(now);
  const d = s.daily[k] || {};
  const orders = d.orders || [];
  if (orders.includes(i)) return s;
  s.daily[k] = { ...d, orders: [...orders, i] };
  award(s, XP.daily, now, { kind: 'daily', title: DAILY_ORDERS[i] });
  return s;
}

export function restCheckIn(state, now) {
  const s = clone(state);
  const k = dayKey(now);
  const sessionToday = s.history.some(h => h.kind === 'session' && dayKey(h.ts) === k);
  if (s.daily[k]?.rest || sessionToday) return s;
  s.daily[k] = { ...(s.daily[k] || {}), rest: true };
  award(s, XP.restDay, now, { kind: 'rest', title: 'Rest day check-in' });
  return s;
}

// Next open step of a track; a Prep slot resolves to the Prep step that fills it.
export function nextStep(s, track) {
  const st = trackSteps(s, track).find(x => x.status === 'open' || x.status === 'slot');
  if (st?.type !== 'slot') return st;
  const p = trackSteps(s, 'prep').find(x => x.status === 'open');
  return p ? { ...p, title: `Prep: ${p.title}`, detail: 'Counts toward the run level too.' } : st;
}

// ---------- coach context ----------
export function coachContext(s, now) {
  const lvl = runLevel(s.run.level);
  const track = activeTrack(s);
  const next = nextStep(s, track);
  const prep = PREP_STAGES[s.prep.level];
  const pains = s.history.filter(h => h.pain != null).slice(-3).map(h => `${h.pain}/10`).join(', ') || 'none logged';
  const lines = [
    `Runner: ${s.profile.name || 'unnamed'}; trains ${s.profile.daysPerWeek} days/week.`,
    `Dream / goal: ${[s.profile.dream?.text, s.profile.dream?.event, s.profile.dream?.date && `by ${s.profile.dream.date}`].filter(Boolean).join(' · ') || s.profile.goal || 'not set'}.`,
    `Run Track: Level ${lvl.n} "${lvl.name}" in ${worldOf(lvl).name}. Level XP ${levelProgress(s).earned}/${levelProgress(s).target}. Total XP ${s.xp}.`,
    `Prep Track: P${s.prep.level} "${prep.name}" (${prep.focus}).`,
    ...(prepBlocksRun(s) != null ? [`Level ${s.run.level} is CLEARED, but Level ${s.run.level + 1} also needs Prep P${prepBlocksRun(s)} (now P${s.prep.level}): the athlete is waiting on the Prep Track, not on running.`] : []),
    ...((s.pending || []).length ? ['A gate/boss was logged today and is confirmed by tomorrow morning\'s pain check (2/10 or less); then the next level opens.'] : []),
    `Active track: ${track}.`,
    next ? `Next step: ${next.title}${next.detail ? ' - ' + next.detail : ''}.` : 'No open step right now.',
    `Recent pain ratings: ${pains}.`,
    // Training load: every session, not just the ones with notes.
    (() => {
      const wk = s.history.filter(h => (h.kind === 'session' || h.kind === 'attempt') && h.ts > now - 7 * DAY);
      const by = wk.reduce((m, h) => ({ ...m, [h.track || 'other']: (m[h.track || 'other'] || 0) + 1 }), {});
      return `Last 7 days: ${wk.length} session${wk.length === 1 ? '' : 's'}${wk.length ? ` (${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}; last 28 days: ${s.history.filter(h => h.kind === 'session' && h.ts > now - 28 * DAY).length}.`;
    })(),
    `Day streak: ${dayStreak(s, now)}.`,
  ];
  // The athlete's own words about recent sessions: what they actually did and how it felt.
  const logs = s.history.filter(h => (h.kind === 'session' || h.kind === 'attempt') && (h.actual || h.note || h.partial)).slice(-5);
  if (logs.length) lines.push(`Recent session logs (athlete's own words):\n${logs.map(h => `- ${new Date(h.ts).toISOString().slice(0, 10)} "${h.title}"${h.partial ? (h.kind === 'attempt' ? ' [ATTEMPTED, NOT DONE]' : ' [PARTLY DONE]') : ''}, pain ${h.pain ?? 0}/10${h.actual ? `; did: ${h.actual}` : ''}${h.note ? `; notes: ${h.note}` : ''}`).join('\n')}`);
  if (s.rebuild.active) lines.push(`In Rebuild Track stage R${s.rebuild.stage + 1} "${REBUILD_STAGES[s.rebuild.stage].name}"${s.rebuild.redFlag ? '; RED FLAGS reported: running paused until cleared by a professional' : ''}.`);
  if (s.refresher) lines.push(`On a refresher course after a break (from level ${s.refresher.fromLevel} to ${s.refresher.toLevel}).`);
  if (s.run.reclaim) lines.push(`Previously reached level ${s.run.reclaim}; reclaiming it.`);
  const tone = s.rebuild.active ? 'coming back from pain or injury: be patient, reassuring and celebrate small wins'
    : s.refresher || s.run.reclaim ? 'returning after a break: welcome them back warmly, remind them fitness returns fast'
    : s.run.level === 1 && (s.answers?.runsLast4w ?? 0) === 0 ? 'starting from no training at all: be very encouraging, make walking and tiny wins feel big'
    : s.run.level <= 3 ? 'a beginner: be encouraging, normalise walk breaks and slow pace' : 'an experienced runner: be encouraging and direct';
  lines.push(`Tone: this runner is ${tone}.`);
  if (s.mode) lines.push(s.mode.type === 'sick' ? `SICK MODE (${s.mode.where === 'above' ? 'symptoms above the neck: easy movement only' : 'below the neck or fever: full rest, no training'}).` : 'BUSY MODE: only key sessions this week.');
  if (s.profile.tracks?.length) lines.push(`Trains for: ${s.profile.tracks.join(', ')}${s.profile.primary ? `; main focus ${s.profile.primary}` : ''}.`);
  if (TRI.hasTri(s)) {
    const lim = TRI.limiter(s);
    lines.push(`Triathlon: world "${TRI.triWorld(s).name}"; swim ${TRI.swimStage(s).name} (${TRI.swimStage(s).target}), bike ${TRI.bikeStage(s).name} (${TRI.bikeStage(s).target}), run = Run Track level ${s.run.level}. ${lim ? `Limiter: ${lim.lane}.` : 'All lanes ready: transition gate open.'}${s.tri.learnToSwim ? ' Cannot swim yet: suggest lessons with a coach, never swim alone.' : ''}`);
  }
  if (s.background?.length) lines.push(`Sporting background: ${BG.describe(s.background).join('; ')}. ${BG.isFormerAthlete(s) ? 'RETURNING ATHLETE: talk to them as an experienced athlete coming back; their technique is credited and gates open early while they climb back.' : ''}`);
  if (s.profile.sex) lines.push(`Race category: ${ST.SEX_LABEL[s.profile.sex]}. Use this category's weights and time standards.`);
  if (HYB.hasHybrid(s)) {
    const lim = HYB.limiter(s), b = s.hybrid.block;
    lines.push(`Hybrid: world "${HYB.hybWorld(s).name}"; strength ${HYB.strengthStage(s).name}, engine ${HYB.engineStage(s).name}, run = Run Track level ${s.run.level}. Current block: ${b.type === 'deload' ? 'deload week' : `${b.type} block (building ${b.type}, maintaining ${b.type === 'engine' ? 'strength' : 'engine'})`}. ${lim ? `Limiter: ${lim.lane}.` : 'All lanes ready: race gate open.'} Gym: ${s.hybrid.gym}.`);
  }
  if (s.answers?.hybridRaces?.length) lines.push(`Hybrid races finished: ${s.answers.hybridRaces.map(r => [r.event, r.division || r.category, r.format].filter(Boolean).join(' ')).join('; ')}.`);
  if (s.target) {
    const d = Math.floor((new Date(`${s.target.date}T12:00:00`) - new Date(new Date(now).toDateString())) / DAY);
    lines.push(`TARGET RACE: ${s.target.name} (${s.target.distance}, goal: ${s.target.goal}) on ${s.target.date}, ${d >= 0 ? `in ${d} days` : `${-d} days ago`}${s.target.result ? `; finished in ${Math.floor(s.target.result.time)} min` : ''}. Phases: build > race prep (last 4 weeks) > taper (last 2) > race week > recovery. Be honest about readiness but always encouraging.`);
  }
  if (s.hybrid?.race?.event) lines.push(`Preparing for: ${s.hybrid.race.event === 'alphax' ? 'Alpha X' : 'Hyrox'} ${s.hybrid.race.division} (simulations follow that race's format).`);
  if (s.bests) {
    const t = m => (m ? `${Math.floor(m / 60) ? `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}` : Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}` : null);
    const b = s.bests, list = [['5K', b.run5k], ['10K', b.run10k], ['half', b.half], ['marathon', b.marathon], [`Hyrox ${b.hyroxDiv || 'open'}`, b.hyrox]].filter(x => x[1]).map(([k, v]) => `${k} ${t(v)}`);
    if (b.ftp) list.push(`FTP ${b.ftp} W`);
    if (list.length) lines.push(`Personal bests (athlete-entered): ${list.join(', ')}.`);
  }
  if (s.answers && (s.answers.bodyweight || s.answers.squat5 || s.answers.deadlift5)) lines.push(`Lifts on file (${s.answers.liftUnit || 'kg'}, ${s.answers.liftMode === '1' ? '1-rep max' : '5 reps'}): bodyweight ${s.answers.bodyweight || '?'}, squat ${s.answers.squat5 || '?'}, deadlift ${s.answers.deadlift5 || '?'}, pull-ups ${s.answers.pullups || '?'}.`);
  if (s.answers?.bodyFat > 0) lines.push(`Body fat (self-reported, ${s.answers.bodyFatMethod || 'unknown method'}): ${s.answers.bodyFat}%. Use only as context, never to judge.`);
  const bl = s.bodyLog || [];
  if (bl.length > 1) lines.push(`Body log: ${bl.slice(-4).map(b => `${new Date(b.ts).toISOString().slice(0, 10)} ${b.bw ?? '?'} ${b.unit || 'kg'}${b.bf ? `, ${b.bf}% fat` : ''}`).join(' · ')}.`);
  if (s.answers) lines.push(`Assessment: ~${s.answers.weeklyKm || 0} km/week, longest run ~${s.answers.longestKm || 0} km, best 5K ${s.answers.best5k || 'n/a'} min, best 10K ${s.answers.best10k || 'n/a'} min.`);
  return lines.join('\n');
}
