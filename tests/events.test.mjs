import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as EV from '../js/events.js';

test('races drop off on their own day', () => {
  const ev = [
    { uid: 'a', name: 'IRONMAN 70.3 Sharm', date: '2026-10-16', track: 'tri', distance: '70.3' },
    { uid: 'b', name: 'Sprint Tri', date: '2026-10-30', track: 'tri', distance: 'tri' },
    { uid: 'c', name: 'Pyramids Half', date: '2026-10-16', track: 'run', distance: 'half' },
  ];
  const tri = EV.featured(ev, 'tri', '2026-10-16');
  assert.ok(!tri.picks.some(e => e.uid === 'a' && !e.expected), 'today\'s race is not offered');
  assert.ok(tri.picks.some(e => e.uid === 'b'));
  assert.ok(!EV.upcoming(ev, ['run'], '2026-10-16').run.soon.length);
  assert.equal(EV.featured(ev, 'tri', '2026-10-15').picks[0].uid, 'a'); // the day before it still shows
});
