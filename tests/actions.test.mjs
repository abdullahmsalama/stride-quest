import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as K from '../js/calendar.js';
import * as A from '../js/actions.js';

const MON = new Date(2026, 9, 12, 8).getTime();
const placed = () => {
  const { state } = E.placeFromAnswers(E.newState(MON), { continuous: '30-45', longestKm: 10, best5k: 29, runsLast4w: 12, pain: 'none', daysPerWeek: 3 }, MON);
  return K.setSchedule(state, [0, 2, 5], 5);
};

test('invalid or incomplete suggestions are dropped', () => {
  const s = placed();
  assert.equal(A.describe(s, { type: 'move_session', key: 'run:6:2' }, MON), null); // no day
  assert.equal(A.describe(s, { type: 'move_session', key: 'nope', day: 3 }, MON), null); // unknown session
  assert.equal(A.describe(s, { type: 'set_days', days: [1] }, MON), null); // fewer than 2 days
  assert.equal(A.describe(s, { type: 'end_mode' }, MON), null); // nothing to end
  assert.equal(A.describe(s, { type: 'delete_everything' }, MON), null); // not on the whitelist
  assert.equal(A.describe(s, { type: 'set_dream', text: '' }, MON), null);
});

test('move a planned session, with clash warnings', () => {
  const s = placed();
  const key = K.buildWeek(s, MON).days[0].items[0].key;
  const d = A.describe(s, { type: 'move_session', key, day: 4 }, MON);
  assert.match(d.label, /to Fri/);
  const { state } = A.apply(s, { type: 'move_session', key, day: 4 }, MON);
  assert.ok(K.buildWeek(state, MON).days[4].items.some(i => i.key === key));
});

test('sick, busy and recovery go through the engine', () => {
  let s = placed();
  assert.ok(A.describe(s, { type: 'start_sick', where: 'below' }, MON));
  s = A.apply(s, { type: 'start_sick', where: 'below' }, MON).state;
  assert.equal(s.mode.type, 'sick');
  assert.equal(A.describe(s, { type: 'start_sick' }, MON), null); // already on
  const r = A.apply(s, { type: 'end_mode' }, MON + 5 * E.DAY);
  assert.equal(r.state.mode, null);
  assert.equal(r.open.type, 'return');
});

test('pain goes to Rebuild; dream and days update the profile', () => {
  let s = placed();
  s = A.apply(s, { type: 'report_pain', redFlag: false }, MON).state;
  assert.equal(E.activeTrack(s), 'rebuild');
  s = A.apply(s, { type: 'set_dream', text: 'Marathon under 4 hours', date: '2027-04-25' }, MON).state;
  assert.equal(s.profile.dream.target.level, 12);
  s = A.apply(s, { type: 'set_days', days: [1, 3, 6], longDay: 6 }, MON).state;
  assert.deepEqual(K.schedule(s), { days: [1, 3, 6], longDay: 6 });
});

test('the coach sees the week with keys', () => {
  const ctx = A.weekContext(placed(), MON);
  assert.match(ctx, /WEEK PLAN/);
  assert.match(ctx, /run:\d+:\d+ \| Mon\(0\)/);
});

test('offline coach proposes the same actions', () => {
  const s = placed();
  assert.equal(A.offlineActions('I have a fever', s)[0].type, 'start_sick');
  assert.equal(A.offlineActions('I have a fever', s)[0].where, 'below');
  assert.equal(A.offlineActions('travelling for work next week', s)[0].type, 'start_busy');
  assert.equal(A.offlineActions('my knee is swollen', s)[0].redFlag, true);
  assert.deepEqual(A.offlineActions('what should I do today?', s), []);
});
