import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as K from '../js/calendar.js';
import * as ACT from '../js/actions.js';

const MON = new Date(2026, 9, 12, 8).getTime();
function runner() {
  let { state: s } = E.placeFromAnswers(E.newState(MON), { continuous: '30-45', pain: 'none', runsLast4w: 12, weeklyKm: 20, longestKm: 10, best5k: 28 }, MON);
  return K.setSchedule(s, [0, 2, 4, 5], 5);
}
const items = (s, t = MON) => K.buildWeek(s, t).days.flatMap(d => d.items.map(i => ({ ...i, day: d.i })));

test('minutes from session words', () => {
  assert.equal(ACT.minutesOf('Tempo: 10 min easy, 10 min comfortably hard, 10 min easy'), 30);
  assert.equal(ACT.minutesOf('Tempo: 2 x 8 min comfortably hard, 2 min jog between'), 18);
  assert.equal(ACT.minutesOf('Long easy run 1 h 10 min'), 70);
  assert.equal(ACT.minutesOf('Push'), null);
});

test('coach can shorten, swap to easy or lengthen a session (a bit), this week only', () => {
  const s = runner(), long = items(s).find(i => i.cls === 'long');
  const shorter = { type: 'change_session', key: long.key, title: 'Long easy run 30 min', detail: 'Tired legs: keep it short.' };
  assert.ok(ACT.describe(s, shorter, MON));
  const s2 = ACT.apply(s, shorter, MON).state;
  const now = items(s2).find(i => i.key === long.key);
  assert.equal(now.title, 'Long easy run 30 min');
  assert.equal(now.edited, long.title);
  assert.equal(items(s2, MON + 7 * E.DAY).find(i => i.key === long.key)?.title ?? long.title, long.title, 'next week is back to the plan');
  const m = ACT.minutesOf(long.title);
  assert.ok(ACT.describe(s, { ...shorter, title: `Long easy run ${m + 10} min` }, MON), 'a little longer is fine');
  assert.match(ACT.describe(s, { ...shorter, title: `Long easy run ${m + 10} min` }, MON).warnings[0], /step up/);
  assert.equal(ACT.describe(s, { ...shorter, title: `Long easy run ${m * 2} min` }, MON), null, 'not double');
  const hurt = E.enterRebuild(s, { redFlag: false, now: MON });
  assert.equal(ACT.describe(hurt, { ...shorter, title: `Long easy run ${m + 5} min` }, MON), null, 'never harder in Rebuild');
});

test('coach can rest a session; tests and gates cannot be rewritten', () => {
  const s = runner(), it = items(s)[0];
  const s2 = ACT.apply(s, { type: 'skip_session', key: it.key }, MON).state;
  assert.ok(!items(s2).some(i => i.key === it.key));
  const gate = { type: 'gate', title: 'Boss: timed 5K', key: 'run:6:8' };
  assert.equal(ACT.describe(s, { type: 'change_session', key: 'run:99:0', title: 'Easy 20 min' }, MON), null);
  assert.ok(gate);
});

test('offline coach: "I am tired" offers an easier or rest day for today', () => {
  const s = runner(), today = K.buildWeek(s, Date.now()).days[K.buildWeek(s, Date.now()).today].items.find(x => !x.done && x.key);
  const a = ACT.offlineActions('I am so tired', s);
  if (today) assert.ok(['change_session', 'skip_session'].includes(a[0]?.type));
  else assert.equal(a.length, 0);
});
