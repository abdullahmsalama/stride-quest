import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

const T0 = new Date(2026, 9, 5, 9, 0).getTime(); // Mon 5 Oct 2026, 09:00 local
const days = n => T0 + n * E.DAY;

const base = { name: 'Test', continuous: 'none', longestKm: 0, weeklyKm: 0, runsLast4w: 0, pain: 'none', redFlags: [], daysPerWeek: 3 };
const place = (a, now = T0) => E.placeFromAnswers(E.newState(now), { ...base, ...a }, now);

test('placement: beginner starts at level 1, P0', () => {
  const { state, placed } = place({});
  assert.equal(placed, 1);
  assert.equal(state.prep.level, 0);
  assert.equal(state.rebuild.active, false);
});

test('placement: one level below qualifying', () => {
  const { qualifying, placed } = place({ continuous: '30-45', longestKm: 10, best10k: 55, best5k: 26, runsLast4w: 12, weeklyKm: 30 });
  assert.equal(qualifying, 8);
  assert.equal(placed, 7);
});

test('placement: barely running recently drops 3 levels before the -1', () => {
  const { qualifying } = place({ continuous: '45-75', longestKm: 21, halfDone: true, runsLast4w: 1 });
  assert.equal(qualifying, 7);
});

test('placement: prep self-test is capped at P3', () => {
  const { state } = place({ continuous: '45-75', longestKm: 12, runsLast4w: 12, selfTest: { t0: true, t1: true, t2: true, t3: true } });
  assert.equal(state.prep.level, 3);
});

test('placement: pain sends advanced runner to Rebuild, level saved', () => {
  const { state, placed } = place({ continuous: '45-75', longestKm: 21, halfDone: true, runsLast4w: 12, pain: 'mild' });
  assert.equal(state.rebuild.active, true);
  assert.equal(state.rebuild.savedRunLevel, placed);
  assert.equal(E.activeTrack(state), 'rebuild');
});

test('pain rule: 3-4 repeats, 5+ prompts rebuild, 0-2 counts', () => {
  const { state } = place({});
  let r = E.completeStep(state, 'run', 0, { pain: 3, now: T0 });
  assert.equal(r.outcome.status, 'repeat');
  assert.equal(r.state.run.done[0], undefined);
  r = E.completeStep(state, 'run', 0, { pain: 6, now: T0 });
  assert.equal(r.outcome.status, 'rebuildPrompt');
  r = E.completeStep(state, 'run', 0, { pain: 1, now: T0 });
  assert.equal(r.outcome.status, 'done');
  assert.ok(r.state.run.done[0]);
  assert.equal(r.outcome.xp, E.XP.run + E.XP.painCheck);
});

test('rebuild: pain 5+ steps back one stage', () => {
  let { state } = place({ pain: 'mild' });
  state.rebuild.stage = 2;
  const r = E.completeStep(state, 'rebuild', 0, { pain: 5, now: T0 });
  assert.equal(r.outcome.status, 'stepBack');
  assert.equal(r.state.rebuild.stage, 1);
});

test('red flags lock rebuild except gentle mobility', () => {
  const { state } = place({ pain: 'more', redFlags: ['swelling'] });
  const steps = E.trackSteps(state, 'rebuild');
  assert.equal(steps[1].status, 'open');
  assert.ok(steps.filter((_, i) => i !== 1).every(s => s.status === 'locked'));
});

test('prep step fills a run-level prep slot', () => {
  const { state } = place({});
  const r = E.completeStep(state, 'prep', 0, { pain: 0, now: T0 });
  const slotIdx = E.trackSteps(r.state, 'run').findIndex(s => s.type === 'slot');
  assert.ok(r.state.run.done[slotIdx]?.viaPrep);
});

test('gate is locked until 70% of level XP, then provisional until morning check', () => {
  let { state } = place({});
  const gateIdx = E.trackSteps(state, 'run').findIndex(s => s.type === 'gate');
  assert.equal(E.trackSteps(state, 'run')[gateIdx].status, 'locked');
  let t = T0;
  for (const st of E.trackSteps(state, 'run')) {
    if (st.type === 'run' || st.type === 'rest') state = E.completeStep(state, 'run', st.idx, { pain: 0, now: (t += E.DAY) }).state;
  }
  for (let i = 0; i < 2; i++) state = E.completeStep(state, 'prep', i, { pain: 0, now: (t += E.DAY) }).state;
  assert.equal(E.trackSteps(state, 'run')[gateIdx].status, 'open');
  const r = E.completeStep(state, 'run', gateIdx, { pain: 0, now: (t += E.DAY) });
  assert.equal(r.outcome.status, 'provisional');
  assert.equal(r.state.run.level, 1);
  const m = E.morningCheck(r.state, 1, t + E.DAY);
  assert.equal(m.state.run.level, 2);
  assert.equal(m.state.run.stars[1], 3);
});

test('morning pain above 2 fails a provisional gate', () => {
  let { state } = place({});
  state.run.done = { 0: { ts: T0 }, 2: { ts: T0 }, 4: { ts: T0 }, 6: { ts: T0 }, 1: { ts: T0 }, 5: { ts: T0 } };
  const r = E.completeStep(state, 'run', 7, { pain: 0, now: T0 });
  const m = E.morningCheck(r.state, 3, T0 + E.DAY);
  assert.equal(m.state.run.level, 1);
  assert.equal(m.state.run.done[7], undefined);
});

test('run level waits for required Prep stage', () => {
  let { state } = place({ continuous: '20-30', longestKm: 5, runsLast4w: 12 });
  assert.equal(state.run.level, 3);
  state.run.done = Object.fromEntries(E.runLevel(3).steps.map((s, i) => [i, { ts: T0 }]).filter(([i]) => E.runLevel(3).steps[i].type !== 'gate'));
  const gateIdx = E.runLevel(3).steps.findIndex(s => s.type === 'gate');
  state = E.completeStep(state, 'run', gateIdx, { pain: 0, now: T0 }).state;
  state = E.morningCheck(state, 0, T0 + E.DAY).state;
  assert.equal(state.run.level, 3); // level 4 needs P2, runner is at P0
  assert.equal(E.prepBlocksRun(state), 2);
});

test('retention and effective gap', () => {
  assert.equal(E.effectiveGapDays(42, E.retention({ easyMin: 100, hardMin: 20 }, 140)), 0);
  assert.equal(E.effectiveGapDays(42, E.retention({ easyMin: 84 }, 140)), 21);
  assert.equal(E.effectiveGapDays(40, E.retention({ crossMin: 100 }, 140)), 30);
  assert.equal(E.effectiveGapDays(40, E.retention({}, 140)), 40);
});

test('refresher tiers', () => {
  assert.equal(E.refresherTier(5).id, 'none');
  assert.equal(E.refresherTier(10).id, 'warmup');
  assert.equal(E.refresherTier(20).id, 'week');
  assert.equal(E.refresherTier(40).drop, 1);
  assert.equal(E.refresherTier(60).drop, 2);
  assert.equal(E.refresherTier(100).id, 'reassess');
});

test('return after 6 weeks off: drop 1 level, refresher, Prove It restores', () => {
  let { state } = place({ continuous: '30-45', longestKm: 10, best10k: 55, best5k: 26, runsLast4w: 12 });
  state.prep.level = 5;
  const now = days(42);
  assert.equal(E.returnCheck(state, now).needed, true);
  const { state: s2, summary } = E.applyReturn(state, { reason: 'busy', now });
  assert.equal(summary.tier, 'drop1');
  assert.equal(s2.run.level, 6);
  assert.equal(s2.run.reclaim, 7);
  assert.equal(s2.prep.level, 3); // impact retention low -> landing check returns
  assert.equal(E.activeTrack(s2), 'refresher');
  assert.equal(E.returnCheck(s2, now).needed, false);
  const r = E.completeStep(s2, 'refresher', 0, { pain: 1, passed: true, now });
  assert.equal(r.state.run.level, 7);
  assert.equal(r.state.refresher, null);
  assert.ok(r.state.badges.comeback);
});

test('return with partial training counts the gap partly', () => {
  const { state } = place({ continuous: '30-45', longestKm: 10, best10k: 55, best5k: 26, runsLast4w: 12 });
  const { summary } = E.applyReturn(state, { reason: 'busy', easyMin: 100, now: days(42) }); // 100/160 = 62%
  assert.equal(summary.effectiveDays, 21);
  assert.equal(summary.tier, 'week');
});

test('return after injury goes to Rebuild with the adjusted level saved', () => {
  const { state } = place({ continuous: '30-45', longestKm: 10, best10k: 55, best5k: 26, runsLast4w: 12 });
  const { state: s2 } = E.applyReturn(state, { reason: 'injury', now: days(35) });
  assert.equal(E.activeTrack(s2), 'rebuild');
  assert.equal(s2.rebuild.savedRunLevel, 6);
});

test('return after 4 months asks for re-assessment, floor of old level - 3', () => {
  const { state } = place({ continuous: '30-45', longestKm: 10, best10k: 55, best5k: 26, runsLast4w: 12 });
  const { state: s2, summary } = E.applyReturn(state, { reason: 'busy', now: days(120) });
  assert.equal(summary.tier, 'reassess');
  const { placed } = E.placeFromAnswers(s2, { ...base }, days(120));
  assert.equal(placed, 4);
});

test('weekly bonus and streak multiplier', () => {
  let { state } = place({});
  state = E.completeStep(state, 'run', 0, { pain: 0, now: days(0) }).state;
  state = E.completeStep(state, 'run', 2, { pain: 0, now: days(1) }).state;
  state = E.completeStep(state, 'run', 4, { pain: 0, now: days(2) }).state;
  assert.ok(state.weekBonus[E.weekKey(days(0))]);
  state.weekBonus[E.weekKey(days(-7))] = true;
  assert.equal(E.streakMultiplier(state, days(7)), 1.1);
});

test('daily orders are stable per day and award once', () => {
  assert.deepEqual(E.dailyOrders(T0), E.dailyOrders(T0 + 3600e3));
  let { state } = place({});
  const i = E.dailyOrders(T0)[0].i;
  state = E.completeOrder(state, i, T0);
  state = E.completeOrder(state, i, T0);
  assert.equal(state.xp, E.XP.daily);
});

test('locked steps say why, and pain-free athletes can leave the Rebuild Track', () => {
  const T0 = new Date(2026, 9, 12, 8).getTime();
  let { state } = E.placeFromAnswers(E.newState(T0), { continuous: '30-45', longestKm: 10, best5k: 26, runsLast4w: 12, pain: 'none', daysPerWeek: 3 }, T0);
  const saved = state.run.level;
  const gate = E.trackSteps(state, 'run').find(st => st.type === 'gate');
  assert.match(gate.lockReason, /Earn \d+ XP/);
  state = E.enterRebuild(state, { redFlag: true, now: T0 });
  assert.ok(E.trackSteps(state, 'rebuild').filter(st => st.status === 'locked').every(st => /physio or doctor/.test(st.lockReason)));
  state = E.leaveRebuild(E.clearRedFlag(state, T0), T0);
  assert.equal(state.rebuild.active, false);
  assert.equal(state.run.level, Math.max(1, saved - 1));
  assert.equal(state.run.reclaim, saved);
});

test('partial, backdated and annotated sessions', () => {
  const T0 = new Date(2026, 9, 12, 8).getTime();
  let { state } = E.placeFromAnswers(E.newState(T0), { continuous: '30-45', longestKm: 10, best5k: 29, runsLast4w: 12, pain: 'none', daysPerWeek: 3 }, T0);
  const idx = E.trackSteps(state, 'run').findIndex(st => st.type === 'run' && st.status === 'open');
  // Partly done: some XP, the step stays open, the words are kept for the coach.
  let r = E.completeStep(state, 'run', idx, { pain: 1, now: T0, result: 'partial', actual: '5 of 8 reps', note: 'very hot' });
  assert.equal(r.outcome.status, 'partial');
  assert.equal(E.trackSteps(r.state, 'run')[idx].status, 'open');
  assert.match(E.coachContext(r.state, T0), /PARTLY DONE.*5 of 8 reps.*very hot/);
  // Done yesterday, fine the morning after: counted on that day, no morning check pending.
  const y = T0 - E.DAY;
  r = E.completeStep(state, 'run', idx, { pain: 0, now: y, backdated: true, morningOk: true });
  assert.equal(r.outcome.status, 'done');
  assert.equal(r.state.pending.length, 0);
  assert.equal(r.state.run.done[idx].ts, y);
  // Sore the morning after: not counted.
  assert.equal(E.completeStep(state, 'run', idx, { pain: 0, now: y, backdated: true, morningOk: false }).outcome.status, 'repeat');
});

test('coach context: the dream, race prep, bests, recent load and a Prep block are all sent', async () => {
  const { placeFromAnswers, newState, coachContext } = await import('../js/engine.js');
  const T = Date.UTC(2026, 9, 12, 9);
  let { state } = placeFromAnswers(newState(T), { continuous: '60+', longestKm: 15, best5k: 22, runsLast4w: 12, pain: 'none' }, T);
  state.profile.dream = { text: 'Ironman 70.3', event: 'IM 70.3 Egypt' };
  state.hybrid = { race: { event: 'alphax', division: 'open' } };
  state.bests = { run5k: 21.5 };
  state.history.push({ ts: T - 864e5, kind: 'session', track: 'run', title: 'Easy', xp: 30 });
  state.run.gatePassed = true; state.prep.level = 0;
  const c = coachContext({ ...state, hybrid: null, bests: state.bests, profile: state.profile }, T);
  assert.match(c, /Dream \/ goal: Ironman 70\.3 · IM 70\.3 Egypt/);
  assert.match(c, /Personal bests \(athlete-entered\): 5K 21:30/);
  assert.match(c, /Last 7 days: 1 session \(run 1\)/);
  assert.match(c, /needs Prep P\d+ \(now P0\)/);
  assert.doesNotMatch(c, /goal: not set/);
});
