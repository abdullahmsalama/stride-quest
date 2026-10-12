import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normCdf, normInv, jointTop, percentile, valueAt } from '../js/stats.js';

test('stats: normal helpers round-trip', () => {
  for (const p of [0.01, 0.2, 0.5, 0.8, 0.99]) assert.ok(Math.abs(normCdf(normInv(p)) - p) < 1e-6);
});

test('stats: joint rarity matches the bivariate normal (top 20% at both)', () => {
  assert.ok(Math.abs(jointTop(0.8, 0.8, 0) - 0.04) < 0.001);
  assert.ok(Math.abs(jointTop(0.8, 0.8, 0.4) - 0.0762) < 0.001);
});

test('stats: percentile interpolates breakpoints for times (lower is better) and lifts', () => {
  const times = [[10, 35], [25, 31], [50, 27], [75, 24], [90, 21]];
  assert.equal(Math.round(percentile(times, 27)), 50);
  assert.equal(Math.round(percentile(times, 25.5)), 63);
  assert.ok(percentile(times, 18) > 90 && percentile(times, 18) <= 99);
  assert.ok(percentile(times, 45) < 10 && percentile(times, 45) >= 1);
  const lifts = [[25, 1.0], [50, 1.4], [75, 1.8]];
  assert.equal(Math.round(percentile(lifts, 1.6)), 63);
  assert.equal(valueAt(times, 75), 24);
  assert.equal(valueAt(lifts, 62.5), 1.6);
});

import { NORMS, weightClass } from '../js/data/norms.js';
import { statFor, hybridRarity } from '../js/stats.js';

test('norms: every table runs in one direction (no broken curves)', () => {
  for (const [k, m] of Object.entries(NORMS)) {
    const tables = m.tables ? Object.values(m.tables).flatMap(x => Object.values(x)) : [];
    for (const tb of tables) {
      const pts = [...tb].sort((a, b) => a[0] - b[0]);
      for (let i = 2; i < pts.length; i++) assert.equal(Math.sign(pts[i][1] - pts[i - 1][1]), Math.sign(pts[1][1] - pts[0][1]), `${k} not monotonic`);
    }
  }
});

test('stats: a 31:28 5K man is at the middle; a 22:00 one beats ~90%', () => {
  assert.equal(statFor('run5k', 31 + 28 / 60, 'm').p, 50);
  const fast = statFor('run5k', 22, 'm');
  assert.ok(fast.p >= 90 && fast.p <= 93, String(fast.p));
});

test('stats: lifts use the weight class; heavier than the top class gets no comparison', () => {
  assert.equal(weightClass('m', 80), 83);
  assert.equal(weightClass('m', 130), null);
  // 80 kg man, squat 1RM 2.23 x 83 kg class limit = 185 kg -> 2.31 x bodyweight -> the middle.
  assert.equal(statFor('squat', 185.09 / 80, 'm', null, { bwKg: 80 }).p, 50);
  assert.equal(statFor('squat', 2, 'f', null, { bwKg: 130 }), null);
});

test('stats: Hyrox only says "faster than half"; rarity needs two different sports', () => {
  const h = statFor('hyrox_open', 80, 'm');
  assert.ok(h.median && h.show);
  assert.equal(statFor('hyrox_open', 95, 'm').show, false);
  const r5 = statFor('run5k', 22, 'm'), r10 = statFor('run10k', 45, 'm');
  assert.equal(hybridRarity([r5, r10]), null);
  const sq = statFor('squat', 2.6, 'm', null, { bwKg: 80 });
  const r = hybridRarity([r5, r10, sq]);
  assert.ok(r && r.oneIn > 5, JSON.stringify(r));
});
