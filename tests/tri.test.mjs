import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as T from '../js/tri.js';

const now = new Date(2026, 9, 12, 9).getTime();
const runner = (runAnswers = {}) => E.placeFromAnswers(E.newState(now), { continuous: '20-30', longestKm: 5, runsLast4w: 12, pain: 'none', daysPerWeek: 4, ...runAnswers }, now).state;
const withTri = (s, a) => { s.profile.tracks = ['run', 'tri']; s.tri = T.placeTri(s, a); return s; };

test('placement: lanes start one stage below ability, world = first not yet met', () => {
  let s = withTri(runner(), { swimDist: '400', freestyle: 'yes', openWater: 'no', longestRide: '20', bikeAccess: 'road' });
  assert.equal(s.run.level, 3);
  assert.equal(s.tri.swim.stage, 3); // can swim 400 m -> working on the 400 m gate
  assert.equal(s.tri.bike.stage, 3); // 20 km rides -> working on the 20 km gate
  assert.equal(s.tri.world, 1); // Lake Start's targets are already met -> Super Sprint Cove
});

test('non-swimmer starts at Water Comfort with the learn-to-swim flag', () => {
  const s = withTri(runner(), { swimDist: 'none', longestRide: '60', bikeAccess: 'road' });
  assert.equal(s.tri.swim.stage, 0);
  assert.equal(s.tri.learnToSwim, true);
  assert.equal(T.limiter(s).lane, 'swim');
});

test('no freestyle caps swim at S2; no open water caps at S5', () => {
  assert.equal(T.placeTri(runner(), { swimDist: '1500', freestyle: 'no' }).swim.stage, 1);
  assert.equal(T.placeTri(runner(), { swimDist: '3800', freestyle: 'yes', openWater: 'no' }).swim.stage, 4);
});

test('finished races move the world forward', () => {
  const tri = T.placeTri(runner(), { swimDist: '750', freestyle: 'yes', longestRide: '40', bikeAccess: 'road', triRaces: ['sprint'] });
  assert.equal(tri.world, 3); // Olympic Coast
});

test('gate opens only when all three lanes are ready; the run lane is the Run Track', () => {
  let s = withTri(runner(), { swimDist: '400', freestyle: 'yes', longestRide: '20', bikeAccess: 'road' });
  s.tri.world = 1; // Super Sprint Cove: swim 4, bike 3, run 3
  s.tri.swim.stage = 3;
  assert.equal(T.lanesReady(s), false);
  assert.equal(E.trackSteps(s, 'triGate')[0].status, 'locked');
  assert.equal(T.limiter(s).lane, 'swim');
  // clear the swim stage: 2 sessions open its gate, the gate moves the lane up
  s = E.completeStep(s, 'swim', 0, { pain: 0, now }).state;
  s = E.completeStep(s, 'swim', 1, { pain: 0, now }).state;
  const r = E.completeStep(s, 'swim', 3, { pain: 0, now });
  s = r.state;
  assert.equal(s.tri.swim.stage, 4);
  assert.ok(r.outcome.messages.some(m => /transition gate is open/.test(m)));
  assert.equal(E.trackSteps(s, 'triGate')[0].status, 'open');
  // the race gate is confirmed by the next-morning check, then the world advances
  s = E.completeStep(s, 'triGate', 0, { pain: 1, now }).state;
  s = E.morningCheck(s, 1, now + E.DAY).state;
  assert.equal(s.tri.world, 2);
  assert.ok(s.badges.tri_gate && s.badges.first_boss);
  // Sprint Bay needs Run Level 4: running is the limiter until the Run Track moves
  s.tri.swim.stage = 5; s.tri.bike.stage = 4;
  assert.equal(T.limiter(s).lane, 'run');
  s.run.level = 4;
  assert.equal(T.lanesReady(s), true);
});

test('swim and bike keep going during Rebuild; races wait', () => {
  let s = withTri(runner({ pain: 'mild' }), { swimDist: '400', freestyle: 'yes', longestRide: '20', bikeAccess: 'road' });
  assert.equal(E.activeTrack(s), 'rebuild');
  assert.equal(E.trackSteps(s, 'swim')[0].status, 'open');
  s.tri.swim.stage = 8; s.tri.bike.stage = 7; s.run.level = 11;
  assert.equal(E.trackSteps(s, 'triGate')[0].status, 'locked');
});

test('swim pain 5+ while already rebuilding says rest, no second rebuild prompt', () => {
  const s = withTri(runner({ pain: 'mild' }), { swimDist: '400', freestyle: 'yes', longestRide: '20', bikeAccess: 'road' });
  const r = E.completeStep(s, 'swim', 0, { pain: 6, now });
  assert.equal(r.outcome.status, 'repeat');
});

test('weekly calendar mixes swim, bike and run for triathletes', async () => {
  const K = await import('../js/calendar.js');
  let s = withTri(runner(), { swimDist: '400', freestyle: 'yes', longestRide: '20', bikeAccess: 'road' });
  s = K.setSchedule(s, [0, 1, 2, 3, 4, 5], 5);
  s.profile.primary = 'tri';
  const items = K.buildWeek(s, new Date(2026, 9, 12, 8).getTime()).days.flatMap(d => d.items);
  const tracks = new Set(items.map(i => i.track));
  assert.ok(tracks.has('swim') && tracks.has('bike') && (tracks.has('run') || tracks.has('prep')));
  assert.equal(items.find(i => i.track === 'swim').cls, 'swim');
  assert.equal(K.classify({ type: 'bike', title: 'Brick: 15 km ride + 2 km run' }), 'long');
  assert.equal(K.classify({ type: 'bike', title: '3 x 6 min at threshold' }), 'hard');
});
