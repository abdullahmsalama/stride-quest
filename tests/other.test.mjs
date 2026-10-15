import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legDays, otherItems, sessionItem } from '../js/data/other.js';
import * as N from '../js/nutrition.js';
import * as E from '../js/engine.js';
import * as K from '../js/calendar.js';

test('other training: heavy-leg days and the day after are kept for easy runs', () => {
  const days = legDays([{ kind: 'weights', days: [1], effort: 'hard', minutes: 60 }, { kind: 'yoga', days: [3], effort: 'easy', minutes: 45 }]);
  assert.deepEqual([...days.keys()].sort(), [1, 2]); // Tue gym (and Wed after it); yoga doesn't count
  assert.ok(days.get(1) > days.get(2)); // the gym day itself matters most
});

test("other training: it counts in today's nutrition", () => {
  const p = { sex: 'm', age: 30, heightCm: 178, kg: 80, life: 'sit', easyPace: 6 };
  const R = N.rmr(p).kcal;
  const rest = N.dayLoad([], p, R), gym = N.dayLoad(otherItems([{ kind: 'weights', days: [0], minutes: 60, effort: 'moderate' }], 0), p, R);
  assert.ok(gym.exKcal > 250 && gym.exKcal < 450, String(gym.exKcal)); // ~ (5-1) x 80 kg x 1 h = 320
  assert.equal(gym.strength, true);
  assert.ok(N.targets(p, gym, { type: 'maintain' }).kcal > N.targets(p, rest, { type: 'maintain' }).kcal);
  assert.equal(N.dayLoad([sessionItem({ kind: 'team', minutes: 90, effort: 'hard' })], p, R).load, 'hard');
});

test('other training: the planner keeps hard runs off a hard gym day', () => {
  const T = Date.UTC(2026, 9, 12, 8); // a Monday
  let { state } = E.placeFromAnswers(E.newState(T), { continuous: '60+', longestKm: 15, best5k: 22, runsLast4w: 12, pain: 'none' }, T);
  state = K.setSchedule(state, [0, 1, 2, 3, 4, 5], 6); state.prep.level = 6;
  const hardOn = s => K.buildWeek(s, T).days.flatMap((d, i) => d.items.filter(it => it.cls === 'hard' || it.cls === 'test').map(() => i));
  const withGym = { ...state, otherTraining: [{ kind: 'weights', days: [1, 3], effort: 'hard', minutes: 60 }] };
  assert.ok(hardOn(withGym).every(d => d !== 1 && d !== 3), `hard runs on ${hardOn(withGym)}: never on the gym days (Tue, Thu)`);
  const oneGym = { ...state, otherTraining: [{ kind: 'weights', days: [1], effort: 'hard', minutes: 60 }] };
  assert.ok(hardOn(oneGym).every(d => d !== 1 && d !== 2), `with room, not the day after either: ${hardOn(oneGym)}`);
});
