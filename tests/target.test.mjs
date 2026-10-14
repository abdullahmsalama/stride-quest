import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdict, weeksToLevel, finishRange, phase } from '../js/target.js';
import { placeFromAnswers, newState } from '../js/engine.js';

const T = Date.UTC(2026, 9, 15, 9);
const beginner = () => { const { state } = placeFromAnswers(newState(T), { continuous: 'none', runsLast4w: 0, pain: 'none' }, T); state.profile.days = [0, 2, 4]; return state; };
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const inWeeks = w => ymd(T + w * 7 * 864e5);

test('competition: from zero to a continuous 5K takes about 9 weeks at 3 runs a week (Couch to 5K)', () => {
  const s = beginner();
  assert.equal(s.run.level, 1);
  const w = weeksToLevel(s, 4);
  assert.ok(w >= 9 && w <= 11, String(w));
  assert.ok(weeksToLevel({ ...s, profile: { ...s.profile, days: [0, 3] } }, 4) > w, 'fewer training days take longer');
  assert.equal(verdict(s, { distance: '5k', date: inWeeks(12) }, T).kind, 'ok');
});

test('competition: 5K in 5 weeks from zero is tight: run-walk at a much slower pace', () => {
  const v = verdict(beginner(), { distance: '5k', date: inWeeks(5) }, T);
  assert.equal(v.kind, 'tight'); assert.equal(v.mode, 'runwalk');
  assert.ok(v.range[0] > 40);
});

test('competition: 10K in 3 weeks from zero is not realistic, with a way to still take part', () => {
  const later = { distance: '10k', date: inWeeks(30), name: 'Later 10K' };
  const v = verdict(beginner(), { distance: '10k', date: inWeeks(3) }, T, [later]);
  assert.equal(v.kind, 'no');
  assert.equal(v.shorter, '5k');          // walk-jog the 5K
  assert.equal(v.shorterMode, 'walk');
  assert.equal(v.later?.name, 'Later 10K'); // or a later 10K once ready
});

test('competition: a real 5K best predicts the race range (Riegel)', () => {
  const [a, b] = finishRange('10k', 25);
  assert.ok(a > 50 && b < 60, `${a}-${b}`);
});

test('competition: phases count down to race day and recovery', () => {
  const race = { date: inWeeks(0) };
  assert.equal(phase(race, T).id, 'race');
  assert.equal(phase({ date: inWeeks(1) }, T).id, 'raceweek');
  assert.equal(phase({ date: inWeeks(2) }, T).id, 'taper');
  assert.equal(phase({ date: inWeeks(3) }, T).id, 'peak');
  assert.equal(phase({ date: inWeeks(6) }, T).id, 'build');
  assert.equal(phase({ date: ymd(T - 3 * 864e5) }, T).id, 'recover');
});
