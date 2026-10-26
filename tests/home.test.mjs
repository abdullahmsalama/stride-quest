import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as GYM from '../js/gym.js';
import * as HOME from '../js/home.js';
import * as K from '../js/calendar.js';
import { LADDERS } from '../js/data/home.js';
import { EXERCISES } from '../js/data/exercises.js';

const T = Date.UTC(2026, 9, 26, 9);
function home(a = {}, days = [0, 2, 5]) {
  let { state: s } = E.placeFromAnswers(E.newState(T), { continuous: 'none', pain: 'none' }, T);
  s.profile.tracks = ['gym']; s = K.setSchedule(s, days, 5);
  s.gym = GYM.placeGym(s, { gMode: 'home', hMin: '20', hGoal: 'fit', hJump: 'no', hFit: 'start', ...a }, T);
  return s;
}
const ids = s => GYM.gymSteps(s).flatMap(x => x.home?.moves.map(m => m.id) || []);

test('home: every move and test has cues', () => {
  const all = [...Object.values(LADDERS).flat().map(x => x.id)];
  assert.deepEqual(all.filter(id => !EXERCISES[id]), []);
});

test('home: placement by how fit they feel, and push-ups / plank they can already do', () => {
  assert.equal(home().gym.stage, 0);
  assert.equal(home({ hFit: 'some' }).gym.stage, 2);
  assert.equal(home({ hFit: 'regular' }).gym.stage, 4);
  assert.equal(home({ hPush: '15', hPlank: '45' }).gym.stage, 4);
  const s = home({ hFit: 'regular', hPush: '20' });
  assert.equal(HOME.rungOf(s, 'push').id, 'pushup', '20 push-ups: no knee push-ups for them');
});

test('home: "no jumping" never gives a jump; jumping gives the jump versions', () => {
  for (const stage of [0, 4, 8]) {
    const s = home({ hJump: 'no', hv_band: 'on' }); s.gym.stage = stage; s.gym.world = Math.floor(stage / 2);
    assert.ok(!ids(s).some(id => LADDERS.cardio.concat(LADDERS.squat).find(x => x.id === id)?.jump), `stage ${stage}`);
  }
  const s = home({ hJump: 'yes' }); s.gym.stage = 8; s.gym.world = 4;
  assert.equal(HOME.rungOf(s, 'cardio').id, 'burpee');
});

test('home: equipment shows up, sessions fit the minutes, cardio days by goal', () => {
  const s = home({ hv_band: 'on', hGoal: 'fit' });
  assert.ok(ids(s).includes('band_pull_apart'));
  for (const m of ['10', '20', '30', '45']) {
    const x = home({ hMin: m }), st = GYM.gymSteps(x).filter(y => y.type === 'lift');
    for (const y of st) assert.ok(Math.abs(y.minutes - +m) <= 2, `${m} min → ${y.minutes}`);
  }
  assert.equal(HOME.cardioDays(home({ hGoal: 'fit' })), 1);
  assert.equal(HOME.cardioDays(home({ hGoal: 'cut' }, [0, 1, 2, 3, 4])), 2);
  assert.equal(HOME.cardioDays(home({ hGoal: 'strong' })), 0);
});

test('home: 6 sessions clear a stage; the Test Day moves to the next world', () => {
  let s = home(), t = T;
  const done = () => { const st = E.trackSteps(s, 'gym').find(x => x.status === 'open' && x.type !== 'gate'); t += 2 * E.DAY; s = E.completeStep(s, 'gym', st.idx, { pain: 0, now: t, lifts: {} }).state; };
  for (let i = 0; i < 6; i++) done();
  assert.equal(s.gym.stage, 1);
  for (let i = 0; i < 6; i++) done();
  const gate = E.trackSteps(s, 'gym').find(x => x.type === 'gate');
  assert.ok(gate, 'Test Day open');
  // Not there yet: 3 more sessions, then again.
  s = E.completeStep(s, 'gym', gate.idx, { pain: 0, now: t + E.DAY, lifts: { incline_pushup: { reps: [6] }, plank: { reps: [25] }, air_squat: { reps: [20] } } }).state;
  assert.equal(s.gym.stage, 1);
  assert.ok(!E.trackSteps(s, 'gym').some(x => x.type === 'gate'));
  for (let i = 0; i < 3; i++) done();
  const again = E.trackSteps(s, 'gym').find(x => x.type === 'gate');
  s = E.completeStep(s, 'gym', again.idx, { pain: 0, now: t + E.DAY, lifts: { incline_pushup: { reps: [10] }, plank: { reps: [25] }, air_squat: { reps: [20] } } }).state;
  assert.equal(s.gym.stage, 2);
  assert.equal(GYM.gymWorld(s).name, 'Band Camp');
});

test('home: "too hard" / "too easy" move one rung, and a partly done session does not count', () => {
  let s = home({ hFit: 'regular' });
  const was = HOME.rungOf(s, 'push').id;
  s = HOME.adjust(s, 'push', -1);
  assert.notEqual(HOME.rungOf(s, 'push').id, was);
  s = HOME.adjust(s, 'push', 1);
  assert.equal(HOME.rungOf(s, 'push').id, was);
  const r = E.completeStep(s, 'gym', 0, { pain: 0, now: T + E.DAY, result: 'partial', lifts: {} }).state;
  assert.equal(r.gym.count || 0, 0);
});

test('home: the coach gets the next circuit exactly', () => {
  const s = home({ hv_band: 'on' });
  assert.match(E.coachContext(s, T), /HOME WORKOUTS.*NO JUMPING/);
  assert.match(E.coachContext(s, T), /NEXT HOME SESSION/);
});

test('home: no runner-only daily orders for people who do not run', () => {
  for (let d = 0; d < 60; d++) {
    const o = E.dailyOrders(T + d * E.DAY, false);
    assert.equal(o.length, 3);
    assert.ok(!o.some(x => /foot and ankle/.test(x.title)), `day ${d}`);
  }
});

test('home: push-up goals differ by sex, plank and legs do not', () => {
  const m = home(), f = home(); m.profile.sex = 'm'; f.profile.sex = 'f';
  for (let w = 0; w < 5; w++) {
    const [mp, ...mr] = HOME.homeTests(m, w), [fp, ...fr] = HOME.homeTests(f, w);
    assert.ok(typeof mp.need === 'number' && fp.need < mp.need, `world ${w} push-ups`);
    assert.deepEqual(fr, mr, `world ${w} plank and legs`);
  }
  assert.equal(HOME.homeTests(f, 3)[0].need, 5);
});
