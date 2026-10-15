// Triathlon rules. Three lanes: swim and bike ladders here, the run lane is the Run Track level.
// A world's transition gate (brick or race) opens when all three lanes reach that world's targets.
import { SWIM_STAGES, BIKE_STAGES, TRI_WORLDS } from './data/tri.js';

export const SWIM_MAX = SWIM_STAGES.length; // 8 = every swim stage cleared
export const BIKE_MAX = BIKE_STAGES.length; // 7
export const LANES = ['swim', 'bike', 'run'];
export const LANE_LABEL = { swim: 'Swim', bike: 'Bike', run: 'Run' };
export const LANE_ICON = { swim: '🏊', bike: '🚴', run: '🏃' };

export const hasTri = s => !!s.tri && (s.profile.tracks || []).includes('tri');
export const triWorld = s => TRI_WORLDS[Math.min(s.tri.world, TRI_WORLDS.length - 1)];
export const swimStage = s => SWIM_STAGES[Math.min(s.tri.swim.stage, SWIM_MAX - 1)];
export const bikeStage = s => BIKE_STAGES[Math.min(s.tri.bike.stage, BIKE_MAX - 1)];

export function newTri() {
  return { swim: { stage: 0, done: {} }, bike: { stage: 0, done: {} }, world: 0, done: {}, learnToSwim: false, finished: false };
}

const laneHave = (s, lane) => (lane === 'swim' ? s.tri.swim.stage : lane === 'bike' ? s.tri.bike.stage : s.run.level);

// What each lane needs for a world, and whether it is there.
export function laneStatus(s, worldIndex = s.tri.world) {
  const w = TRI_WORLDS[Math.min(worldIndex, TRI_WORLDS.length - 1)];
  return LANES.map(lane => ({ lane, have: laneHave(s, lane), need: w[lane], ok: laneHave(s, lane) >= w[lane] }));
}

export const lanesReady = s => !s.tri.finished && laneStatus(s).every(l => l.ok);

// The lane furthest behind (relative to what this world asks), or null when all are ready.
export function limiter(s) {
  const behind = laneStatus(s).filter(l => !l.ok);
  if (!behind.length) return null;
  return behind.sort((a, b) => (b.need - b.have) / b.need - (a.need - a.have) / a.need)[0];
}

export function laneTarget(lane, need) {
  if (lane === 'swim') return need > SWIM_MAX ? 'all done ✅' : need > 0 ? SWIM_STAGES[need - 1].target : 'start';
  if (lane === 'bike') return need > BIKE_MAX ? 'all done ✅' : need > 0 ? BIKE_STAGES[need - 1].target : 'start';
  return `Run Level ${need}`;
}

// A finished ladder keeps going with the top stage's sessions (no gate), so the sport stays in the week.
export const swimSteps = s => (s.tri.swim.stage < SWIM_MAX ? SWIM_STAGES[s.tri.swim.stage].steps : SWIM_STAGES[SWIM_MAX - 1].steps.filter(st => st.type !== 'gate'));
export const bikeSteps = s => (s.tri.bike.stage < BIKE_MAX ? BIKE_STAGES[s.tri.bike.stage].steps : BIKE_STAGES[BIKE_MAX - 1].steps.filter(st => st.type !== 'gate'));
export function gateSteps(s) {
  if (s.tri.finished) return [];
  const w = triWorld(s);
  return [{ type: 'gate', title: w.gate.title, detail: w.gate.detail, boss: !!w.gate.boss, nextDay: true }];
}

// Placement from the questionnaire. What the athlete has done counts in full: 44 km ridden clears
// the 40 km stage, so the next gate is 90 km. (The Run Track keeps its one-level-below start.)
const SWIM_ABILITY = { none: 0, 25: 1, 100: 2, 200: 3, 400: 4, 750: 5, 1500: 6, 1900: 7, 3800: 8 };
const BIKE_ABILITY = { none: 0, 30: 1, 60: 2, 10: 3, 20: 4, 40: 5, 90: 6, 180: 7 };
const RACE_WORLD = { supersprint: 1, sprint: 2, olympic: 3, half: 4, full: 5 };

export function placeTri(s, a) {
  const tri = newTri();
  // A typed distance beats the multiple choice: count every stage target it covers.
  const typed = (value, targets) => targets.filter(t => value >= t).length;
  let swim = +a.swimM > 0 ? typed(+a.swimM, [25, 100, 200, 400, 750, 1500, 1900, 3800]) : SWIM_ABILITY[a.swimDist] ?? 0;
  if (a.freestyle === false || a.freestyle === 'no') swim = Math.min(swim, 2); // freestyle comes in at S2
  if (a.openWater === false || a.openWater === 'no') swim = Math.min(swim, 5); // open water is part of S5
  const bike = a.bikeAccess === 'none' ? 0 : +a.rideKm > 0 ? Math.max(2, typed(+a.rideKm, [10, 20, 40, 90, 180]) + 2) : BIKE_ABILITY[a.longestRide] ?? 0;
  tri.swim.stage = Math.min(SWIM_MAX, swim);
  tri.bike.stage = Math.min(BIKE_MAX, bike);
  tri.learnToSwim = swim === 0;
  // Current world: the first one whose lane targets are not all met yet.
  const probe = { ...s, tri };
  let world = TRI_WORLDS.findIndex((_, i) => laneStatus(probe, i).some(l => !l.ok));
  if (world < 0) world = TRI_WORLDS.length - 1;
  const raced = Math.max(-1, ...(a.triRaces || []).map(r => RACE_WORLD[r] ?? -1));
  if (raced >= 0) world = Math.max(world, Math.min(TRI_WORLDS.length - 1, raced + 1));
  tri.world = world;
  return tri;
}
