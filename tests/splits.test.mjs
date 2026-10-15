import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as SPL from '../js/splits.js';
import * as H from '../js/hybrid.js';
import * as E from '../js/engine.js';
import * as K from '../js/calendar.js';

test('splits: the best split by strength days, normal and competition', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(d => SPL.recommend(d, 3).id), ['full', 'full', 'ulf', 'ul', 'ulppl', 'ppl']);
  assert.equal(SPL.recommend(3, 2).id, 'full'); // newer lifters: full body x3
  assert.equal(SPL.recommend(5, 1).id, 'full'); // still learning the movements
  assert.equal(SPL.recommend(4, 5, 'peak').id, 'full');
  assert.match(SPL.recommend(4, 5, 'taper').label, /half/);
  assert.equal(SPL.recommend(4, 5, 'raceweek').id, null);
  assert.ok(![1, 2, 3, 4, 5, 6].some(d => SPL.recommend(d, 5).id === 'bro'), 'never recommends a bro split');
});

test('splits: strength sessions follow the split, then the gate', () => {
  const MON = new Date(2026, 9, 12, 8).getTime();
  let { state: s } = E.placeFromAnswers(E.newState(MON), { continuous: '30-45', longestKm: 10, best5k: 25, runsLast4w: 12, pain: 'none' }, MON);
  s.profile.tracks = ['hybrid']; s.profile.primary = 'hybrid';
  s.hybrid = H.placeHybrid(s, { liftExp: 'y1_3', bodyweight: 80, squat5: 85, deadlift5: 110, gym: 'full', startBlock: 'strength' }, MON);
  s = K.setSchedule(s, [0, 1, 3, 4, 5], 5);
  s.hybrid.strength.stage = 3; s.hybrid.strength.done = {};
  s.hybrid.split = { id: 'ul', days: 4 };
  const steps = H.strengthSteps(s);
  assert.deepEqual(steps.map(x => x.title.split(':')[0]), ['Lower A', 'Upper A', 'Lower B', 'Upper B', 'Gate']);
  assert.equal(K.weekPattern(s).filter(k => k === 'strength').length, 4);
});
