import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/gym.js';
import * as E from '../js/engine.js';
import * as K from '../js/calendar.js';

const MON = new Date(2026, 9, 12, 8).getTime(); // a Monday
const year = new Date().getFullYear();
function gymState({ tracks = ['gym'], days = [0, 1, 3, 4, 5], sex = 'm', age = 28, a = {} } = {}) {
  let { state: s } = E.placeFromAnswers(E.newState(MON), { continuous: 'none', pain: 'none' }, MON);
  s = K.setSchedule(s, days, 5);
  s.profile.tracks = tracks; s.profile.primary = tracks[0]; s.profile.sex = sex; s.profile.birthYear = year - age;
  s.gym = G.placeGym(s, { gGoal: 'muscle', gExp: 'y1_3', gMin: '60', gEquip: 'gym', bodyweight: 80, sex, days, ...a }, MON);
  return s;
}

test('gym: split recommendation by days, goal, experience, age and other sports', () => {
  const r = o => G.recommendGym({ goal: 'muscle', exp: 'y1_3', age: 28, ...o }).id;
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(days => r({ days })), ['full', 'full', 'ppl3', 'bro4', 'bro5', 'ppl']);
  assert.deepEqual([3, 4, 5].map(days => r({ days, exp: 'none' })), ['full', 'ul', 'ulf5']); // new lifters
  assert.deepEqual([3, 4, 5].map(days => r({ days, goal: 'strength' })), ['ulf', 'ul', 'ulppl']);
  assert.equal(r({ days: 5, otherSports: true }), 'ul'); // also runs: never a bro split
  assert.equal(r({ days: 4, teen: true }), 'ul');
  const old = G.recommendGym({ days: 6, goal: 'muscle', exp: 'y3', age: 55 });
  assert.equal(old.days, 4); assert.equal(old.id, 'ul'); assert.match(old.notes.join(' '), /50/);
});

test('gym: e1RM, placement from typed lifts and standards by sex', () => {
  assert.equal(Math.round(G.e1rm(100, 5)), 117);
  assert.equal(G.e1rm(100, 15), 0); // too many reps to estimate from
  const s = gymState({ a: { gSquat: 100, gSquatR: 5, gBench: 80, gBenchR: 5, gDead: 120, gDeadR: 5 } });
  // 80 kg man, est. 1RM: squat 1.46x, bench 1.17x, deadlift 1.75x → Steady Gains cleared, working on Strong Base
  assert.equal(s.gym.stage, 4);
  const f = gymState({ sex: 'f', a: { gSquat: 60, gSquatR: 5, gBench: 35, gBenchR: 5, gDead: 75, gDeadR: 5, bodyweight: 60 } });
  assert.ok(f.gym.stage >= 3, `women have their own standards (stage ${f.gym.stage})`);
  const newbie = gymState({ a: { gExp: 'none' } });
  assert.equal(newbie.gym.stage, 0);
  const teen = gymState({ age: 16, a: { gExp: 'y3', gSquat: 140, gSquatR: 3, gBench: 100, gBenchR: 3, gDead: 180, gDeadR: 3 } });
  assert.ok(teen.gym.stage <= 4, 'teens are capped');
});

test('gym: gym-only week has gym sessions and no runs; the split days come in order', () => {
  const s = gymState();
  const w = K.buildWeek(s, MON);
  const items = w.days.flatMap(d => d.items);
  assert.ok(items.length >= 5, `${items.length} sessions`);
  assert.ok(items.every(i => i.track === 'gym'), items.map(i => i.track).join(','));
  assert.deepEqual(items.map(i => i.title), ['Chest + Triceps', 'Back + Biceps', 'Legs + Abs', 'Shoulders', 'Arms']);
  s.gym.pair = 'swapped';
  assert.equal(K.buildWeek(s, MON).days.flatMap(d => d.items)[0].title, 'Chest + Biceps');
});

test('gym: combined with running, gym days share the week and bro splits are off', () => {
  const s = gymState({ tracks: ['run', 'gym'] });
  s.gym.days = 2;
  const pat = K.weekPattern(s);
  assert.equal(pat.filter(k => k === 'gym').length, 2);
  assert.ok(pat.includes('run'));
  assert.ok(!G.splitOptions(s).some(id => id.startsWith('bro')));
});

test('gym: sessions follow goal, length, focus and equipment', () => {
  const s = gymState({ days: [0, 2, 4] });
  s.gym.minutes = 45;
  let plan = G.gymSteps(s)[0];
  assert.equal(plan.gym.length, 4);
  s.gym.minutes = 90; s.gym.goal = 'strength'; s.gym.split = 'ulf';
  plan = G.gymSteps(s)[0];
  assert.equal(plan.title, 'Lower'); assert.equal(plan.gym[0].id, 'back_squat'); assert.equal(plan.gym[0].reps, '3-5');
  s.gym.focus = 'lower';
  assert.equal(G.gymSteps(s)[0].gym[1].id, 'hip_thrust');
  s.gym.equip = 'bw';
  assert.ok(G.gymSteps(s)[0].gym.every(x => !['back_squat', 'leg_press'].includes(x.id)));
});

test('gym: double progression and the deload', () => {
  const s = gymState();
  const item = { id: 'bench', slot: 'bench', kind: 'main', legs: false, sets: 4, reps: '6-10', rir: 2 };
  s.gym.lifts.bench = [{ ts: MON, kg: 80, reps: [10, 10, 10, 10] }];
  assert.equal(G.suggestLoad(s, item).kg, 82.5);
  s.gym.lifts.bench.push({ ts: MON + 1, kg: 82.5, reps: [8, 7, 7, 6] });
  assert.equal(G.suggestLoad(s, item).kg, 82.5);
  s.gym.lifts.bench.push({ ts: MON + 2, kg: 82.5, reps: [6, 5, 5, 4] }, { ts: MON + 3, kg: 82.5, reps: [5, 5, 4, 4] });
  assert.equal(G.suggestLoad(s, item).kg, 75); // two misses: 10% off
  assert.ok(G.stalled(s).includes('bench'));
  const d = G.deloadNow(s);
  assert.ok(G.weekInfo(d).deload);
  assert.equal(G.gymSteps(d)[0].gym[0].sets, 2);
});

test('gym: finishing a week rolls on; a full block ends in a deload, then accessories rotate', () => {
  let s = gymState({ days: [0, 2, 4], a: { gExp: 'y3' } });
  s.gym.stage = 2; s.gym.world = 1;
  const len = G.blockLength(s);
  const firstAccessory = G.gymSteps(s)[0].gym.find(x => x.kind !== 'main').id;
  let t = MON;
  for (let wk = 0; wk < len + 1; wk++) {
    for (let i = 0; i < 3; i++) {
      const steps = E.trackSteps(s, 'gym'), idx = steps.findIndex(x => x.status === 'open' && x.type === 'lift');
      if (idx < 0) break;
      t += E.DAY;
      s = E.completeStep(s, 'gym', idx, { pain: 0, now: t }).state;
    }
    if (wk === len - 1) assert.ok(G.weekInfo(s, t).deload, 'deload after the build weeks');
  }
  assert.equal(s.gym.block.n, 1);
  assert.equal(s.gym.block.week, 1);
  const nextAccessory = G.gymSteps(s, t)[0];
  assert.ok(nextAccessory.gym.length > 0);
  assert.notEqual(firstAccessory, undefined);
});

test('gym: logged lifts that meet the standard clear the stage', () => {
  let s = gymState({ a: { gExp: 'y1_3' } });
  s.gym.stage = 2; s.gym.world = 1; s.gym.done = {};
  const idx = E.trackSteps(s, 'gym').findIndex(x => x.type === 'lift');
  // 80 kg man, First Plates standard: squat 1.0x, bench 0.8x, deadlift 1.25x (est. 1RM)
  const r = E.completeStep(s, 'gym', idx, { pain: 0, now: MON + 3600e3, lifts: { back_squat: { kg: 70, reps: [8] }, bench: { kg: 55, reps: [6] }, deadlift: { kg: 85, reps: [6] } } });
  assert.equal(r.state.gym.stage, 3);
  assert.match(r.outcome.messages.join(' '), /First Plates cleared/);
});

test('gym: Test Day on a world\'s last stage, in the deload week', () => {
  let s = gymState();
  s.gym.stage = 3; s.gym.world = 1; s.gym.block.week = G.blockLength(s) + 1;
  const steps = G.gymSteps(s);
  const test = steps.find(x => x.type === 'gate');
  assert.ok(test && /Plate Valley Test Day/.test(test.title));
  const idx = steps.indexOf(test);
  const r = E.completeStep(s, 'gym', idx, { pain: 0, now: MON + 7200e3, lifts: { back_squat: { kg: 90, reps: [5] }, bench: { kg: 70, reps: [5] }, deadlift: { kg: 105, reps: [5] } } });
  assert.equal(r.state.gym.world, 2);
  assert.equal(r.state.gym.stage, 4);
  const fail = E.completeStep(s, 'gym', idx, { pain: 0, now: MON + 7200e3, lifts: { back_squat: { kg: 40, reps: [5] } } });
  assert.equal(fail.state.gym.world, 1);
  assert.equal(fail.state.gym.block.week, 1); // next block starts anyway
});

test('gym: a gym-only athlete in pain is not sent to the running Rebuild Track', () => {
  const s = gymState();
  const r = E.completeStep(s, 'gym', 0, { pain: 6, now: MON });
  assert.equal(r.outcome.status, 'repeat');
  assert.match(r.outcome.messages.join(' '), /physio/);
});

test('gym: coach context carries the split and next weights, and no run levels for gym-only', () => {
  const s = gymState({ a: { gBench: 80, gBenchR: 5, gSquat: 100, gSquatR: 5 } });
  const c = E.coachContext(s, MON);
  assert.match(c, /GYM: muscle goal/);
  assert.match(c, /NEXT GYM SESSION/);
  assert.doesNotMatch(c, /Run Track: Level/);
});

test('gym: cardio warm-up every session; finishers by goal; none for runners; 150 min a week', () => {
  const s = gymState({ days: [0, 2, 4] });
  s.gym.goal = 'muscle'; s.gym.split = 'ulf';
  let st = G.gymSteps(s);
  assert.ok(st.every(x => /Warm-up: 5 min easy cardio/.test(x.warm)));
  assert.equal(st.filter(x => x.finish).length, 2);
  assert.ok(!st.find(x => x.title === 'Lower').finish, 'not after leg day');
  s.gym.goal = 'fit'; st = G.gymSteps(s);
  assert.ok(st.every(x => x.finish));
  assert.match(st[0].finish.text, /intervals/);
  const c = G.weeklyCardio(s);
  assert.ok(c.walks >= 1 && c.inSessions > 0);
  const r = gymState({ tracks: ['run', 'gym'] });
  assert.ok(G.gymSteps(r).every(x => !x.finish));
  const w = gymState({ sex: 'f' });
  assert.equal(w.gym.focus, 'lower');
});
