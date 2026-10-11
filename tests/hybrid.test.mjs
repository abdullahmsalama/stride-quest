import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as H from '../js/hybrid.js';
import * as T from '../js/tri.js';
import * as K from '../js/calendar.js';

const MON = new Date(2026, 9, 12, 8).getTime();
const WEEK = 7 * E.DAY;
const runner = () => E.placeFromAnswers(E.newState(MON), { continuous: '45-75', longestKm: 12, best5k: 24, best10k: 50, runsLast4w: 14, pain: 'none', daysPerWeek: 6 }, MON).state;
const withHybrid = (s, a) => { s.profile.tracks = [...new Set([...(s.profile.tracks || ['run']), 'hybrid'])]; s.hybrid = H.placeHybrid(s, a, MON); return s; };

test('placement from lifts relative to bodyweight, a row time and races', () => {
  const s = withHybrid(runner(), { liftExp: 'y3', bodyweight: 80, squat5: 100, deadlift5: 130, pullups: 6, row1000: 3.9, gym: 'full',
    hybridRaces: [{ event: 'Hyrox', division: 'open', format: 'pair' }] });
  assert.equal(s.hybrid.strength.stage, 6); // squat 1.25 x and deadlift 1.6 x bodyweight -> credited in full, Pro Strength gate next
  assert.equal(s.hybrid.engine.stage, 4);
  assert.ok(s.hybrid.world >= 3); // a finished Doubles race puts you at Solo Stadium or beyond
});

test('beginner lifter starts in a strength block at Movement Basics', () => {
  const s = withHybrid(runner(), { liftExp: 'none', gym: 'home' });
  assert.equal(s.hybrid.strength.stage, 0);
  assert.equal(s.hybrid.block.type, 'strength');
  assert.equal(H.limiter(s).lane, 'strength');
});

test('block cycle: 6 weeks build, deload week, then switch', () => {
  let s = withHybrid(runner(), { liftExp: 'y1_3', startBlock: 'engine' });
  assert.equal(H.blockInfo(s, MON + 2 * WEEK).week, 3);
  s = H.rollBlock(s, MON + 6 * WEEK + E.DAY);
  assert.equal(s.hybrid.block.type, 'deload');
  s = H.rollBlock(s, MON + 7 * WEEK + E.DAY);
  assert.equal(s.hybrid.block.type, 'strength');
  s = H.switchBlock(s, 'engine', MON + 8 * WEEK);
  assert.equal(s.hybrid.block.type, 'engine');
});

test('only the lane in focus builds; the other gets maintenance sessions', () => {
  const s = withHybrid(runner(), { liftExp: 'y1_3', startBlock: 'engine' });
  assert.ok(E.trackSteps(s, 'engine').some(x => x.status === 'open'));
  assert.ok(E.trackSteps(s, 'strength').every(x => x.status === 'locked'));
  assert.match(E.trackSteps(s, 'hyMaint')[0].title, /Strength maintenance/);
  const strengthBlock = H.switchBlock(s, 'strength', MON);
  assert.match(E.trackSteps(strengthBlock, 'hyMaint')[0].title, /Engine maintenance/);
  const deload = H.switchBlock(s, 'deload', MON);
  assert.match(E.trackSteps(deload, 'hyMaint')[0].title, /Deload/);
});

test('maintenance done-list resets each week', () => {
  let s = withHybrid(runner(), { liftExp: 'y1_3', startBlock: 'engine' });
  s = H.refreshHybrid(s, MON, E.weekKey(MON));
  s = E.completeStep(s, 'hyMaint', 0, { pain: 0, now: MON }).state;
  assert.ok(s.hybrid.maint.done[0]);
  s = H.refreshHybrid(s, MON + WEEK, E.weekKey(MON + WEEK));
  assert.deepEqual(s.hybrid.maint.done, {});
});

test('race gate opens when Strength, Engine and the shared Run lane are ready', () => {
  let s = withHybrid(runner(), { liftExp: 'y1_3', startBlock: 'engine' });
  s.hybrid.world = 1; s.hybrid.strength.stage = 2; s.hybrid.engine.stage = 1; s.run.level = 3;
  assert.equal(H.limiter(s).lane, 'engine');
  s = E.completeStep(s, 'engine', 0, { pain: 0, now: MON }).state;
  s = E.completeStep(s, 'engine', 1, { pain: 0, now: MON }).state;
  const r = E.completeStep(s, 'engine', 3, { pain: 0, now: MON });
  assert.ok(r.outcome.messages.some(m => /race gate is open/.test(m)));
  assert.equal(E.trackSteps(r.state, 'hyGate')[0].status, 'open');
});

test('your case: Hybrid leads, Triathlon secondary, engine block -> one mixed week', () => {
  let s = withHybrid(runner(), { liftExp: 'y3', bodyweight: 80, squat5: 100, deadlift5: 140, pullups: 8, row1000: 3.8, startBlock: 'engine' });
  s.profile.tracks = ['run', 'hybrid', 'tri'];
  s.profile.primary = 'hybrid';
  s.tri = T.placeTri(s, { swimDist: '750', freestyle: 'yes', openWater: 'yes', longestRide: '40', bikeAccess: 'road' });
  s = K.setSchedule(s, [0, 1, 2, 3, 4, 5], 5);
  s = H.refreshHybrid(s, MON, E.weekKey(MON));
  const pattern = K.weekPattern(s);
  assert.deepEqual(pattern.slice(0, 6), ['engine', 'maint', 'swim', 'run', 'engine', 'bike']);
  const items = K.buildWeek(s, MON).days.flatMap(d => d.items);
  const tracks = items.map(i => i.track);
  assert.ok(tracks.includes('engine') && tracks.includes('hyMaint') && tracks.includes('swim'));
  // heavy legs never the day before a hard / long session
  const week = K.buildWeek(s, MON);
  assert.ok(!week.warnings.some(w => /Leg work/.test(w.text)) || week.warnings.length <= 1);
});

test('deload week drops hard and long runs from the plan', () => {
  let s = withHybrid(runner(), { liftExp: 'y3', startBlock: 'engine' });
  s = K.setSchedule(s, [0, 1, 2, 3, 4, 5, 6], 5);
  s = H.refreshHybrid(H.switchBlock(s, 'deload', MON), MON, E.weekKey(MON));
  const items = K.buildWeek(s, MON).days.flatMap(d => d.items);
  assert.ok(items.every(i => !['hard', 'test', 'long'].includes(i.cls)));
  assert.ok(items.some(i => /Deload/.test(i.title)));
});

test('speed at race gates: a 4-hour Hyrox Pro counts, but Strong Finish needs a solid solo time', () => {
  const ready = sex => {
    let s = withHybrid(runner(), { liftExp: 'y3', startBlock: 'engine' });
    s.profile.sex = sex;
    s.hybrid.world = 4; s.hybrid.strength.stage = 6; s.hybrid.engine.stage = 6; s.run.level = 8;
    return s;
  };
  const race = (s, event, division, time) => {
    s = E.completeStep(s, 'hyGate', 0, { pain: 0, now: MON, race: { event, division, format: 'solo', time } }).state;
    return E.morningCheck(s, 0, MON + E.DAY);
  };
  let r = race(ready('m'), 'hyrox', 'pro', 240);
  assert.equal(r.state.hybrid.world, 4); // not promoted
  assert.ok(r.state.badges.finisher);
  assert.ok(r.state.hybrid.speedFocus);
  assert.ok(r.outcome.messages.some(m => /Pro League opens with a solo race under 1:38/.test(m)));
  r = race(ready('m'), 'hyrox', 'pro', 96);
  assert.equal(r.state.hybrid.world, 5);
  assert.equal(r.state.hybrid.stars[4], 2);
  // the same 1:30 Open: solid for a woman, finisher-tier for a man
  assert.equal(race(ready('f'), 'hyrox', 'open', 90).state.hybrid.stars[4], 2);
  assert.equal(race(ready('m'), 'hyrox', 'open', 90).state.hybrid.stars[4], 1);
});

test('women lift and row standards are scaled in placement', () => {
  const a = { liftExp: 'y3', bodyweight: 60, squat5: 60, deadlift5: 75, pullups: 3, row1000: 4.3 };
  const m = H.placeHybrid({ ...runner(), profile: { ...runner().profile, sex: 'm' } }, { ...a, sex: 'm' }, MON);
  const f = H.placeHybrid({ ...runner(), profile: { ...runner().profile, sex: 'f' } }, { ...a, sex: 'f' }, MON);
  assert.ok(f.strength.stage > m.strength.stage);
  assert.ok(f.engine.stage >= m.engine.stage);
});

test('lifts: units, single lifts and strong squatters', () => {
  // squat 2x bodyweight, no deadlift given -> top strength, not "squat 3/4 BW"
  assert.equal(H.readLifts({ bodyweight: 80, squat5: 170 }, 'm').level, 7);
  // same lifter typing bodyweight in lb by mistake would read low...
  assert.ok(H.readLifts({ bodyweight: 176, squat5: 170 }, 'm').level <= 4);
  // ...but with lb selected for everything it reads right
  assert.equal(H.readLifts({ liftUnit: 'lb', bodyweight: 176, squat5: 375, deadlift5: 420 }, 'm').level, 7);
  // pull-ups only cap the very top, and only when given
  assert.equal(H.readLifts({ bodyweight: 80, squat5: 170, deadlift5: 200, pullups: 3 }, 'm').level, 6);
  const s = withHybrid(runner(), { liftExp: 'y3', bodyweight: 80, squat5: 170 });
  assert.equal(s.hybrid.strength.stage, 7); // 2x bodyweight squat: the whole strength ladder
});

test('the top strength stages need both lifts and pull-ups', () => {
  const r = a => H.readLifts({ bodyweight: 80, liftUnit: 'kg', liftMode: '5', ...a }, 'm');
  assert.equal(r({ squat5: 180 }).level, 7); // one lift: capped at Pro Strength cleared
  assert.equal(r({ squat5: 165, deadlift5: 185 }).level, 7); // no pull-ups given
  assert.equal(r({ squat5: 165, deadlift5: 185, pullups: 12 }).level, 8);
  assert.equal(r({ squat5: 165, deadlift5: 185, pullups: 5 }).level, 6);
});

test('Hybrid has worlds above Pro League', async () => {
  const { HYBRID_WORLDS } = await import('../js/data/hybrid.js');
  assert.deepEqual(HYBRID_WORLDS.slice(-3).map(w => w.name), ['Pro League', 'Elite Series', 'World Championships']);
  assert.equal(H.STR_MAX, 9);
  assert.equal(H.ENG_MAX, 9);
});

test('placement never skips a race boss you have not done', () => {
  const T0 = new Date(2026, 9, 12, 8).getTime();
  const { state } = E.placeFromAnswers(E.newState(T0), { continuous: '60+', longestKm: 21, best5k: 20, runsLast4w: 14, pain: 'none', daysPerWeek: 4 }, T0);
  state.profile.tracks = ['run', 'hybrid']; state.profile.sex = 'm';
  const strong = { liftExp: 'y3', bodyweight: 80, squat5: 130, deadlift5: 160, pullups: 15, liftUnit: 'kg', liftMode: '5', row1000: 3.4 };
  assert.equal(H.placeHybrid(state, strong, T0).world, 3); // no races: Solo Stadium
  assert.equal(H.placeHybrid(state, { ...strong, hybridRaces: [{ event: 'Hyrox', division: 'open', format: 'solo' }] }, T0).world, 4);
  assert.equal(H.placeHybrid(state, { ...strong, hybridRaces: [{ event: 'Hyrox', division: 'pro', format: 'solo' }] }, T0).world, 5);
});
