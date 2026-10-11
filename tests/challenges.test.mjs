import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as C from '../js/challenges.js';

// Node has btoa/atob globally (18+).
const now = new Date(2026, 9, 12, 9).getTime();
const runner = (level, extra = {}) => ({ id: 'x', name: 'Sam', level, prep: 2, rebuild: false, redFlag: false, ...extra });
const tenK = { tpl: 'distance', p: 2, days: 7, from: { id: 'a', name: 'Alex' } }; // 10 km = Level 7

test('fit levels', () => {
  assert.equal(C.fit(tenK, runner(7)), 'ready');
  assert.equal(C.fit(tenK, runner(9)), 'ready');
  assert.equal(C.fit(tenK, runner(6)), 'stretch');
  assert.equal(C.fit(tenK, runner(5)), 'big');
  assert.equal(C.fit(tenK, runner(3)), 'way');
  assert.equal(C.fit(tenK, runner(9, { rebuild: true })), 'rebuild');
  assert.equal(C.fit({ ...tenK, tpl: 'plank', p: 0 }, runner(1, { rebuild: true })), 'ready');
  assert.equal(C.fit(tenK, runner(9, { rebuild: true, redFlag: true })), 'paused');
});

test('scaled version is the biggest that fits, switching type when needed', () => {
  assert.deepEqual(C.scaledFor(tenK, 3), { tpl: 'distance', p: 0 }); // 3 km
  assert.deepEqual(C.scaledFor(tenK, 4), { tpl: 'distance', p: 1 }); // 5 km
  assert.equal(C.scaledFor(tenK, 7), null);
  assert.deepEqual(C.scaledFor(tenK, 1), { tpl: 'weekRuns', p: 0 }); // nothing fits Level 1 -> 2 runs
  assert.equal(C.versionTitle(tenK, { tpl: 'weekRuns', p: 0 }), '2 runs in 7 days');
  assert.deepEqual(C.scaledFor({ tpl: 'time5k', p: 5, days: 7 }, 3), { tpl: 'distance', p: 0 });
  assert.equal(C.challengeTitle(tenK, 1), 'Run 5 km in one go');
});

test('motivating messages name the levels and the scaled version', () => {
  const m = C.fitMessageForMe(tenK, runner(3));
  assert.equal(m.fit, 'way');
  assert.deepEqual(m.scaled, { tpl: 'distance', p: 0 });
  assert.match(m.text, /not yet/);
  assert.match(m.text, /Run 3 km in one go/);
  const [n] = C.fitMessageForSender(tenK, { ...runner(3), name: 'Sam' }, runner(7));
  assert.equal(n.fit, 'way');
  assert.match(n.text, /Sam is on Level 3/);
  const self = C.fitMessageForSender(tenK, null, runner(4));
  assert.equal(self.at(-1).fit, 'self');
});

test('links round-trip and reject junk', () => {
  const link = C.encodeLink('https://x.github.io/sq/', { t: 'c', id: 'c1', ...tenK, msg: 'Allez! 🏃‍♀️ é' });
  const back = C.decodeHash(link.slice(link.indexOf('#')));
  assert.equal(back.tpl, 'distance');
  assert.equal(back.msg, 'Allez! 🏃‍♀️ é');
  assert.equal(C.decodeHash('#sq=notbase64!!'), null);
  assert.equal(C.decodeHash('#sq=' + btoa('{"t":"c","tpl":"hack","p":0,"days":7,"from":{"id":"a"}}')), null);
});

test('receive, complete, result back to sender', () => {
  let me = C.ensureSocial(E.placeFromAnswers(E.newState(now), { continuous: '20-30', longestKm: 5, runsLast4w: 10, pain: 'none', daysPerWeek: 3 }, now).state);
  me.profile.name = 'Sam';
  const ch = { t: 'c', id: 'c1', ...tenK, from: { id: 'a', name: 'Alex', level: 8 } };
  me = C.receive(me, ch, 'scaled', { tpl: 'distance', p: 0 }, now);
  assert.equal(me.friends.a.name, 'Alex');
  assert.equal(me.challenges.received[0].p, 0);
  assert.equal(me.challenges.received[0].originalTitle, 'Run 10 km in one go');
  me = C.completeReceived(me, 'c1', now + 1000);
  assert.equal(me.challenges.received[0].status, 'done');
  assert.ok(me.badges.challenger);
  const r = C.resultPayload(me, me.challenges.received[0]);
  assert.equal(r.scaled, true);

  let alex = C.ensureSocial(E.newState(now));
  alex = C.recordSent(alex, ch);
  const { state, matched } = C.applyResult(alex, r, now);
  assert.ok(matched);
  assert.equal(state.challenges.sent[0].results[0].name, 'Sam');
  assert.equal(state.friends[me.id].level, me.run.level);
});

test('auto progress counts runs since accepting', () => {
  let s = C.ensureSocial(E.newState(now));
  s = C.receive(s, { t: 'c', id: 'c2', tpl: 'weekRuns', p: 1, days: 7, from: { id: 'a', name: 'Alex' } }, 'original', null, now);
  s.history.push({ ts: now + 1, kind: 'session', track: 'run', title: 'Easy run' }, { ts: now + 2, kind: 'session', track: 'prep', title: 'Prep' });
  assert.deepEqual(C.progress(s, s.challenges.received[0], now), { have: 1, need: 3 });
});
