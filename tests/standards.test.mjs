import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ST from '../js/standards.js';

test('women standards are more forgiving for times and lighter for lifts', () => {
  assert.equal(ST.sexText('Under {min:30} for 3 stars', 'm'), 'Under 30 min for 3 stars');
  assert.equal(ST.sexText('Under {min:30} for 3 stars', 'f'), 'Under 33 min for 3 stars');
  assert.equal(ST.sexText('Gate: squat 1.25 x bodyweight for 3', 'm'), 'Gate: squat 1.25 x bodyweight for 3');
  assert.equal(ST.sexText('Gate: squat 1.25 x bodyweight for 3', 'f'), 'Gate: squat 0.95 x bodyweight for 3');
  assert.equal(ST.sexText('Squat 1x BW', 'x'), 'Squat 0.75x BW');
});

test('Hyrox Pro bar is slower than Open; women slower than men', () => {
  const om = ST.raceStandard('hyrox', 'open', 'm'), pm = ST.raceStandard('hyrox', 'pro', 'm'), of = ST.raceStandard('hyrox', 'open', 'f');
  assert.ok(pm.solid > om.solid && pm.fast > om.fast);
  assert.ok(of.solid > om.solid);
});

test('race tiers: fast, solid, finisher, slow and cut-offs', () => {
  const std = ST.raceStandard('hyrox', 'pro', 'm');
  assert.equal(ST.raceTier(80, std), 'fast');
  assert.equal(ST.raceTier(95, std), 'solid');
  assert.equal(ST.raceTier(110, std), 'finish');
  assert.equal(ST.raceTier(240, std), 'slow'); // a 4-hour Pro: still a finish, but slow
  const half = ST.raceStandard('half', null, 'm');
  assert.equal(ST.raceTier(520, half), 'slow'); // past the 8:30 cut-off
  assert.equal(ST.raceStandard('alphax', 'open', 'f').solid, 99);
});
