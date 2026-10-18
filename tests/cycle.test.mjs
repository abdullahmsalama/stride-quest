import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as CY from '../js/cycle.js';

const c0 = { mode: 'track', starts: ['2026-10-01'], len: 28, periodLen: 5 };

test('cycle: phases from the last start, and the expected next period', () => {
  assert.equal(CY.expected(c0), '2026-10-29');
  assert.deepEqual(['2026-10-01', '2026-10-05', '2026-10-06', '2026-10-14', '2026-10-17', '2026-10-25', '2026-10-30'].map(d => CY.phaseOf(c0, d)),
    ['period', 'period', 'follicular', 'ovulation', 'luteal', 'pms', 'late']);
  assert.equal(CY.cycleDay(c0, '2026-10-18'), 18);
  assert.equal(CY.phaseOf({ mode: 'hormonal' }, '2026-10-02'), null); // no phases on the pill
  assert.equal(CY.phaseOf({ mode: 'track', starts: [] }, '2026-10-02'), null);
});

test('cycle: her own average cycle length once two or more are logged', () => {
  const c = { ...c0, starts: ['2026-07-01', '2026-07-31', '2026-08-31', '2026-10-01'] };
  assert.equal(CY.cycleLen(c), 31);
  assert.equal(CY.expected(c), '2026-11-01');
  assert.equal(CY.cycleLen({ ...c0, starts: ['2026-01-01', '2026-06-01'] }), 28, 'a 5-month gap is a missed log, not a cycle');
});

test('cycle: period days are lighter by default; each day can be switched', () => {
  assert.ok(CY.lighter(c0, '2026-10-02'));
  assert.ok(!CY.lighter(c0, '2026-10-10'));
  assert.ok(!CY.lighter({ ...c0, day: { '2026-10-02': 'full' } }, '2026-10-02'), 'feeling good: full session');
  assert.ok(CY.lighter({ ...c0, day: { '2026-10-10': 'light' } }, '2026-10-10'), 'feeling rough: lighter');
  assert.ok(CY.lighter({ mode: 'hormonal', day: { '2026-10-10': 'light' } }, '2026-10-10'));
  assert.ok(!CY.lighter(null, '2026-10-02'));
});

test('cycle: the "did it start?" question asks once a day from the expected day until answered', () => {
  assert.ok(!CY.shouldAsk(c0, '2026-10-28'));
  assert.ok(CY.shouldAsk(c0, '2026-10-29'));
  let c = CY.markAsked(c0, '2026-10-29');
  assert.ok(!CY.shouldAsk(c, '2026-10-29'), 'once a day');
  assert.ok(CY.shouldAsk(c, '2026-10-30'), 'not yet: asks again tomorrow');
  const yes = CY.logStart(c, '2026-10-30');
  assert.ok(!CY.shouldAsk(yes, '2026-10-31'));
  assert.equal(CY.phaseOf(yes, '2026-10-31'), 'period');
  const skip = CY.skipCycle(c);
  assert.ok(!CY.shouldAsk(skip, '2026-11-05'), 'prefer not to say: quiet for this cycle');
  assert.ok(CY.shouldAsk(skip, '2026-11-26'), 'asks again next cycle');
  assert.equal(CY.cycleLen({ ...skip, starts: [...skip.starts] }), 28, 'a skipped cycle is not used for the average');
});

test('cycle: gentle late note, never for teens or on the pill', () => {
  assert.equal(CY.lateNote(c0, '2026-11-20'), null);
  assert.match(CY.lateNote(c0, '2027-01-05').text, /3 months/);
  assert.equal(CY.lateNote(c0, '2027-01-05', true), null);
  assert.equal(CY.lateNote(CY.skipCycle(c0), '2027-01-05'), null);
  const long = { ...c0, starts: ['2026-04-01', '2026-05-10', '2026-06-20', '2026-07-30'] };
  assert.match(CY.lateNote(long, '2026-08-10').text, /35 days/);
});

test('cycle: lighter gym sessions, and notes for running, hybrid and tri sessions', () => {
  const g = CY.lightGym([{ id: 'bench', sets: 4, rir: 2 }, { id: 'curl', sets: 2, rir: 1 }, { id: 'plank', sets: 3, rir: '-' }]);
  assert.deepEqual(g.map(x => [x.sets, x.rir]), [[3, 3], [2, 2], [2, '-']]);
  const f = CY.lightFinish({ min: 12, text: 'Cardio finisher, 12 min intervals: 6 × 30 s hard / 90 s easy (bike, rower)' });
  assert.match(f.text, /10 min easy.*\(bike, rower\)/);
  assert.match(CY.lightNote({ type: 'run', title: 'Easy run 45 min' }, 'run'), /two-thirds/);
  assert.match(CY.lightNote({ type: 'run', title: '6 x 400 m' }, 'run'), /fewer reps/);
  assert.match(CY.lightNote({ type: 'gate', title: 'Gate: 5K' }, 'run'), /move it/);
  assert.match(CY.lightNote({ type: 'lift', title: 'Strength A' }, 'strength'), /One set fewer/);
  assert.match(CY.lightNote({ type: 'engine', title: 'Sled + row' }, 'engine'), /rounds/);
  assert.match(CY.lightNote({ type: 'prep', title: 'Calf raises' }, 'prep'), /stay as they are/);
});

test('cycle: nutrition extras and the coach line only when she shares it', () => {
  assert.equal(CY.extraKcal('luteal'), 150);
  assert.equal(CY.extraKcal('period'), 0);
  assert.match(CY.nutriTip('period'), /iron/);
  assert.equal(CY.coachLine(c0, '2026-10-02'), null);
  assert.match(CY.coachLine({ ...c0, coach: true }, '2026-10-02'), /day 2, period/);
});

test('cycle: the coach only sees the cycle when she shares it', async () => {
  const E = await import('../js/engine.js');
  const DAYK = E.dayKey(Date.now());
  let { state: s } = E.placeFromAnswers(E.newState(Date.now()), { continuous: 'none', pain: 'none' }, Date.now());
  s.profile.sex = 'f'; s.cycle = { mode: 'track', starts: [DAYK], len: 28, periodLen: 5 };
  assert.doesNotMatch(E.coachContext(s, Date.now()), /CYCLE/);
  s.cycle.coach = true;
  assert.match(E.coachContext(s, Date.now()), /CYCLE.*day 1, period/);
});

test('cycle: after "prefer not to say" there are no guessed phases or lighter days for that cycle', () => {
  const c = CY.skipCycle(c0); // assumed to start 29 Oct
  assert.equal(CY.phaseOf(c, '2026-10-31'), null);
  assert.ok(!CY.lighter(c, '2026-10-31'));
  assert.ok(CY.lighter({ ...c, day: { '2026-10-31': 'light' } }, '2026-10-31'), 'feeling rough still works');
  assert.equal(CY.phaseOf(CY.logStart(c, '2026-11-27'), '2026-11-28'), 'period');
});
