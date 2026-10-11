// Hybrid rules. Three lanes: Strength and Engine ladders here, the Run lane is the Run Track.
// Blocks: build one lane for BLOCK_WEEKS while maintaining the other, deload a week, switch, repeat.
import { STRENGTH_STAGES, ENGINE_STAGES, HYBRID_WORLDS, MAINTENANCE, BLOCK_WEEKS } from './data/hybrid.js';
import { liftFactor, rowFactor } from './standards.js';

export const STR_MAX = STRENGTH_STAGES.length; // 9
export const ENG_MAX = ENGINE_STAGES.length;
export const LANES = ['strength', 'engine', 'run'];
export const LANE_LABEL = { strength: 'Strength', engine: 'Engine', run: 'Run' };
export const LANE_ICON = { strength: '🏋️', engine: '⚙️', run: '🏃' };
const WEEK = 7 * 864e5;

export const hasHybrid = s => !!s.hybrid && (s.profile.tracks || []).includes('hybrid');
export const hybWorld = s => HYBRID_WORLDS[Math.min(s.hybrid.world, HYBRID_WORLDS.length - 1)];
export const strengthStage = s => STRENGTH_STAGES[Math.min(s.hybrid.strength.stage, STR_MAX - 1)];
export const engineStage = s => ENGINE_STAGES[Math.min(s.hybrid.engine.stage, ENG_MAX - 1)];

export function newHybrid(now, startBlock = 'engine') {
  return { strength: { stage: 0, done: {} }, engine: { stage: 0, done: {} }, world: 0, done: {}, finished: false,
    block: { type: startBlock, startedAt: now, next: startBlock === 'engine' ? 'strength' : 'engine' }, maint: { week: null, done: {} }, gym: 'full' };
}

const laneHave = (s, lane) => (lane === 'strength' ? s.hybrid.strength.stage : lane === 'engine' ? s.hybrid.engine.stage : s.run.level);

export function laneStatus(s, worldIndex = s.hybrid.world) {
  const w = HYBRID_WORLDS[Math.min(worldIndex, HYBRID_WORLDS.length - 1)];
  return LANES.map(lane => ({ lane, have: laneHave(s, lane), need: w[lane], ok: laneHave(s, lane) >= w[lane] }));
}
export const lanesReady = s => !s.hybrid.finished && laneStatus(s).every(l => l.ok);
export function limiter(s) {
  const behind = laneStatus(s).filter(l => !l.ok);
  if (!behind.length) return null;
  return behind.sort((a, b) => (b.need - b.have) / b.need - (a.need - a.have) / a.need)[0];
}
export function laneTarget(lane, need) {
  if (lane === 'strength') return need > 0 ? STRENGTH_STAGES[need - 1].target : 'start';
  if (lane === 'engine') return need > 0 ? ENGINE_STAGES[need - 1].target : 'start';
  return `Run Level ${need}`;
}

// ---------- blocks ----------
// Where in the cycle we are: { type: 'engine'|'strength'|'deload', week, weeks, focus, next }
export function blockInfo(s, now) {
  const b = s.hybrid.block;
  const weeks = Math.floor((now - b.startedAt) / WEEK);
  if (b.type === 'deload') return { type: 'deload', week: 1, weeks: 1, focus: null, next: b.next };
  return { type: b.type, week: Math.min(BLOCK_WEEKS, weeks + 1), weeks: BLOCK_WEEKS, focus: b.type, next: b.type === 'engine' ? 'strength' : 'engine' };
}

// Move the cycle forward when a block or deload week has run its course. Returns the same object if nothing changed.
export function rollBlock(s, now) {
  const b = s.hybrid.block;
  const elapsed = now - b.startedAt;
  if (b.type === 'deload' && elapsed >= WEEK) return withBlock(s, { type: b.next, startedAt: b.startedAt + WEEK, next: b.next === 'engine' ? 'strength' : 'engine' });
  if (b.type !== 'deload' && elapsed >= BLOCK_WEEKS * WEEK) return withBlock(s, { type: 'deload', startedAt: b.startedAt + BLOCK_WEEKS * WEEK, next: b.type === 'engine' ? 'strength' : 'engine' });
  return s;
}
export function switchBlock(s, type, now) {
  return withBlock(s, { type, startedAt: now, next: type === 'engine' ? 'strength' : type === 'strength' ? 'engine' : s.hybrid.block.next });
}
function withBlock(s, block) {
  const st = JSON.parse(JSON.stringify(s));
  st.hybrid.block = block;
  st.hybrid.maint = { week: null, done: {} };
  return st;
}

// Maintenance (or deload) sessions for the current week; their done map resets every week.
export function maintSteps(s) {
  const t = s.hybrid.block.type;
  return t === 'deload' ? MAINTENANCE.deload : MAINTENANCE[t === 'engine' ? 'strength' : 'engine'];
}

// Only the lane in focus builds; the other lane is maintained (and both rest in a deload week).
export const inFocus = (s, lane) => s.hybrid.block.type === lane;

// Called on load/render: roll the block cycle and reset the weekly maintenance list.
export function refreshHybrid(s, now, weekKey) {
  let st = rollBlock(s, now);
  if (st.hybrid.maint.week !== weekKey) {
    st = st === s ? JSON.parse(JSON.stringify(s)) : st;
    st.hybrid.maint = { week: weekKey, done: {} };
  }
  return st;
}

export const strengthSteps = s => (s.hybrid.strength.stage < STR_MAX ? STRENGTH_STAGES[s.hybrid.strength.stage].steps : []);
export const engineSteps = s => (s.hybrid.engine.stage < ENG_MAX ? ENGINE_STAGES[s.hybrid.engine.stage].steps : []);
export function gateSteps(s) {
  if (s.hybrid.finished) return [];
  const w = hybWorld(s);
  return [{ type: 'gate', title: w.gate.title, detail: w.gate.detail, boss: !!w.gate.boss, nextDay: true }];
}

// ---------- placement ----------
const EXPERIENCE = { none: 0, lt1: 1, y1_3: 2, y3: 3 };

export function placeHybrid(s, a, now) {
  const start = a.startBlock === 'strength' ? 'strength' : a.startBlock === 'engine' ? 'engine' : autoBlock(s, a);
  const h = newHybrid(now, start);
  h.gym = a.gym || 'full';
  // Strength: from lifts relative to bodyweight when given, else from experience.
  const read = readLifts(a, s.profile.sex);
  let str = EXPERIENCE[a.liftExp] ?? 0;
  if (read.level) str = Math.max(str, read.level);
  // Engine: from a 1000 m row, finished races and the running level.
  const row = +a.row1000; // minutes
  const rf = rowFactor(a.sex || s.profile.sex);
  let eng = row ? (row < 3.83 * rf ? 5 : row < 4.25 * rf ? 4 : row < 4.75 * rf ? 3 : 2) : 1;
  // Alpha X Base (10 x 400 m, lighter) counts less than a Hyrox or Alpha X Open.
  const races = a.hybridRaces || [];
  const big = races.filter(r => !(r.event === 'Alpha X' && r.category === 'base'));
  if (big.some(r => r.format === 'solo')) eng = Math.max(eng, 5);
  else if (big.length) eng = Math.max(eng, 4);
  else if (races.length) eng = Math.max(eng, 3);
  eng = Math.max(eng, Math.min(4, Math.floor(s.run.level / 2)));
  if (big.some(r => r.format === 'solo' || r.format === 'pair')) str = Math.max(str, 4);
  // What the athlete can already do counts in full (no step back for lanes).
  h.strength.stage = Math.min(STR_MAX, str);
  h.engine.stage = Math.min(ENG_MAX, eng);
  // World: the first one whose targets are not all met, nudged up by races already finished.
  const probe = { ...s, hybrid: h };
  let world = HYBRID_WORLDS.findIndex((_, i) => laneStatus(probe, i).some(l => !l.ok));
  if (world < 0) world = HYBRID_WORLDS.length - 1;
  // Race bosses can't be skipped: strong lanes alone reach Solo Stadium (first solo race), a solo
  // finish reaches Strong Finish, a Pro finish starts at Pro League and can reach Elite Series.
  const pro = big.some(r => r.division === 'pro'), solo = big.some(r => r.format === 'solo');
  world = Math.min(world, pro ? 6 : solo ? 4 : 3);
  if (pro) world = Math.max(world, 5);
  else if (big.some(r => r.format === 'solo')) world = Math.max(world, 4);
  else if (big.length) world = Math.max(world, 3);
  else if (races.length) world = Math.max(world, 2);
  h.world = Math.min(world, HYBRID_WORLDS.length - 1);
  return h;
}

// Lifts -> strength level ("stages cleared"). Each lift counts on its own; with both, the average (rounded down).
// Weights in lb are converted; a 1-rep max becomes a 5-rep weight (about 86%). Pull-ups only cap the very top.
export function readLifts(a, sex) {
  const toKg = String(a.liftUnit) === 'lb' ? 0.4536 : 1;
  const k = String(a.liftMode) === '1' ? 0.86 : 1;
  const bw = +a.bodyweight * toKg, sq = +a.squat5 * toKg * k, dl = +a.deadlift5 * toKg * k, pu = a.pullups === '' || a.pullups == null ? null : +a.pullups;
  if (!(bw > 30) || !(sq || dl)) return { level: 0 };
  const lf = liftFactor(a.sex || sex);
  const sqR = sq / bw / lf, dlR = dl / bw / lf; // relative to the men's scale
  const fromSq = sqR >= 2 ? 9 : sqR >= 1.75 ? 8 : sqR >= 1.5 ? 7 : sqR >= 1.25 ? 6 : sqR >= 1 ? 4 : sqR >= 0.75 ? 3 : 2;
  const fromDl = dlR >= 2.25 ? 9 : dlR >= 2 ? 8 : dlR >= 1.75 ? 7 : dlR >= 1.5 ? 6 : dlR >= 1.25 ? 4 : dlR >= 1 ? 3 : 2;
  let level = sq && dl ? Math.floor((fromSq + fromDl) / 2) : sq ? fromSq : fromDl;
  // Pull-ups only cap the top: 8 for Pro Strength, 12 for Elite, 15 for World-Class.
  // Above Pro Strength the gates ask for both lifts and pull-ups, so placement does too.
  if (pu != null) level = Math.min(level, pu < 8 ? 6 : pu < 12 ? 7 : pu < 15 ? 8 : 9);
  if (!(sq && dl) || pu == null) level = Math.min(level, 7);
  return { level, sqRatio: sq ? sq / bw : null, dlRatio: dl ? dl / bw : null, bwKg: bw, suspicious: bw > 130 && toKg === 1 };
}

// Start with the lane that is further behind.
function autoBlock(s, a) {
  const exp = EXPERIENCE[a.liftExp] ?? 0;
  return exp <= 1 ? 'strength' : 'engine';
}
