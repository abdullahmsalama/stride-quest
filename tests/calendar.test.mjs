import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as K from '../js/calendar.js';

const MON = new Date(2026, 9, 12, 8).getTime(); // Mon 12 Oct 2026
const at = d => MON + d * E.DAY;
const placed = (level, prep = 3) => {
  const { state } = E.placeFromAnswers(E.newState(MON), { continuous: '30-45', longestKm: 10, best5k: 29, runsLast4w: 12, pain: 'none', daysPerWeek: 3, selfTest: { t0: 1, t1: 1, t2: 1, t3: 1 } }, MON);
  state.run.level = level; state.prep.level = prep;
  return state;
};
const flat = w => w.days.flatMap(d => d.items.map(it => ({ ...it, day: d.i })));

test('classify sessions by load', () => {
  assert.equal(K.classify({ type: 'run', title: 'Long easy run 45 min' }), 'long');
  assert.equal(K.classify({ type: 'run', title: 'Tempo: 2 x 8 min comfortably hard' }), 'hard');
  assert.equal(K.classify({ type: 'run', title: 'Easy run 25 min' }), 'easy');
  assert.equal(K.classify({ type: 'gate', title: 'x' }), 'test');
  assert.equal(K.classify({ type: 'prep', title: 'x' }, 1), 'strength');
  assert.equal(K.classify({ type: 'prep', title: 'x' }, 4), 'impact');
});

test('week fills available days, Mon/Wed/Sat', () => {
  const w = K.buildWeek(placed(6), MON);
  assert.deepEqual([...new Set(flat(w).map(i => i.day))], [0, 2, 5]);
});

test('long session lands on the long day, hard sessions spread out', () => {
  const s = K.setSchedule(placed(6), [0, 1, 3, 4, 5], 5);
  const w = K.buildWeek(s, MON);
  const items = flat(w);
  assert.equal(items.length, 5);
  const long = items.find(i => i.cls === 'long');
  assert.equal(long.day, 5);
  assert.ok(items.some(i => i.keySession));
});

test('done sessions show on their day; plan restarts from today (no pile-up)', () => {
  let s = placed(6);
  s = E.completeStep(s, 'run', 0, { pain: 0, now: at(0) }).state;
  const w = K.buildWeek(s, at(3)); // Thursday, Wednesday was missed
  assert.ok(w.days[0].items.every(i => i.done));
  assert.equal(w.days[2].items.length, 0); // missed Wednesday is not kept
  assert.ok(w.days[5].items.length >= 1);
  assert.ok(flat(w).every(i => i.done || i.day >= 3));
});

test('moving a session keeps it there and warns about hard days in a row', () => {
  const s = K.setSchedule(placed(6), [0, 1, 3, 4, 5], 5);
  const w = K.buildWeek(s, MON);
  const hard = flat(w).find(i => i.cls === 'hard');
  const warns = K.previewMove(s, hard.key, 4, MON); // Fri, the day before Saturday's long run
  assert.ok(warns.some(x => /in a row/.test(x.text)));
  const moved = K.buildWeek(K.moveItem(s, hard.key, 4, MON), MON);
  assert.equal(flat(moved).find(i => i.key === hard.key).day, 4);
});

test('custom schedule and long day', () => {
  const s = K.setSchedule(placed(4), [1, 3, 6], 6);
  assert.deepEqual(K.schedule(s), { days: [1, 3, 6], longDay: 6 });
  assert.equal(s.profile.daysPerWeek, 3);
});

test('sick mode: rest plan, streak frozen, comeback on recovery', () => {
  let s = placed(6);
  for (let d = 0; d < 3; d++) s = E.completeOrder(s, E.dailyOrders(at(d))[0].i, at(d));
  assert.equal(E.dayStreak(s, at(2)), 3);
  s = E.startMode(s, { type: 'sick', where: 'below' }, at(3));
  const w = K.buildWeek(s, at(3));
  assert.ok(flat(w).filter(i => !i.done).every(i => i.sick && i.cls === 'rest'));
  s = E.sickCheckIn(s, at(4));
  assert.equal(E.dayStreak(s, at(6)), 3); // frozen, not broken
  const { state, summary } = E.endMode(s, at(7));
  assert.equal(state.mode, null);
  assert.equal(E.activeTrack(state), 'refresher');
  assert.match(state.refresher.steps[0].title, /Health check/);
  assert.ok(summary);
  assert.equal(E.dayStreak(state, at(7)), 3);
});

test('busy mode keeps only key sessions', () => {
  let s = E.startMode(placed(6), { type: 'busy' }, MON);
  const items = flat(K.buildWeek(s, MON)).filter(i => !i.done);
  assert.ok(items.length > 0 && items.every(i => i.keySession));
});

test('long illness: recovery plan drops levels with Reclaim, streak kept', () => {
  let s = placed(7, 4);
  for (let d = 0; d < 5; d++) s = E.completeOrder(s, E.dailyOrders(at(d))[0].i, at(d));
  s.history.push({ ts: at(4), kind: 'session', track: 'run', title: 'Easy run', xp: 30 });
  s = E.startMode(s, { type: 'sick', where: 'below' }, at(5));
  const { state, summary } = E.endMode(s, at(5 + 35)); // 5 weeks sick
  assert.equal(summary.sickDays, 35);
  assert.equal(summary.tier, 'drop1');
  assert.equal(state.run.level, 6);
  assert.equal(state.run.reclaim, 7);
  assert.equal(state.refresher.reason, 'illness');
  assert.equal(state.refresher.steps.filter(x => /Health check/.test(x.title)).length, 2);
  assert.equal(summary.streak, 5);
});

test('sick reported after the fact (short gap): streak saved, one gentle session', () => {
  let s = placed(5, 2);
  for (let d = 0; d < 4; d++) s = E.completeOrder(s, E.dailyOrders(at(d))[0].i, at(d));
  s.history.push({ ts: at(3), kind: 'session', track: 'run', title: 'Easy run', xp: 30 });
  const back = at(8); // 5 days later, no sick mode used
  assert.equal(E.returnCheck(s, back).needed, true);
  assert.equal(E.returnCheck(s, back).short, true);
  assert.equal(E.dayStreak(s, back), 0); // broken before reporting
  const { state, summary } = E.applyReturn(s, { reason: 'illness', now: back });
  assert.equal(summary.sickDays, 5);
  assert.equal(summary.streak, 4); // saved
  assert.equal(state.refresher.steps.length, 1);
  assert.equal(E.returnCheck(state, back).needed, false);
});

test('busy short gap changes nothing', () => {
  let s = placed(5, 2);
  s.history.push({ ts: at(0), kind: 'session', track: 'run', title: 'Easy run', xp: 30 });
  const { state, summary } = E.applyReturn(s, { reason: 'busy', now: at(4) });
  assert.equal(summary.tier, 'none');
  assert.equal(state.refresher, null);
  assert.equal(state.run.level, 5);
});

test('the rolling window shows two days back and four ahead, across weeks, without repeats', () => {
  const SUN = new Date(2026, 9, 18, 9).getTime();
  const { state } = E.placeFromAnswers(E.newState(SUN), { continuous: '30-45', longestKm: 10, best5k: 29, runsLast4w: 12, pain: 'none', daysPerWeek: 4 }, SUN);
  const s = K.setSchedule(state, [0, 2, 4, 6], 6);
  const w = K.buildWindow(s, SUN);
  assert.equal(w.days.length, 7);
  assert.deepEqual(w.days.map(d => d.name), ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu']);
  assert.ok(w.days[2].today);
  assert.equal(w.days[3].week, 'next');
  const keys = w.days.flatMap(d => d.items.filter(i => !i.done).map(i => i.key));
  assert.equal(new Set(keys).size, keys.length); // nothing planned twice
  assert.ok(w.days.slice(3).some(d => d.items.length)); // next week is filled in
});

test('a logged session (or a failed attempt) uses the day: nothing else is planned on it', () => {
  const MON = new Date(2026, 9, 12, 9).getTime();
  const { state } = E.placeFromAnswers(E.newState(MON), { continuous: '30-45', longestKm: 10, best5k: 29, runsLast4w: 12, pain: 'none', daysPerWeek: 3 }, MON);
  const s = K.setSchedule(state, [0, 2, 4], 4);
  const planned = K.buildWeek(s, MON).days[0].items[0];
  for (const result of ['full', 'none']) {
    const after = E.completeStep(s, planned.track, planned.idx, { pain: 0, now: MON, result }).state;
    const today = K.buildWeek(after, MON).days[0].items;
    assert.equal(today.filter(i => !i.done).length, 0, result);
    assert.equal(today.filter(i => i.done).length, 1, result);
  }
});
