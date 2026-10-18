import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as AGE from '../js/age.js';
import * as TG from '../js/target.js';
import * as E from '../js/engine.js';
import { missionsFor, MISSIONS } from '../js/data/kids.js';

const yr = new Date().getFullYear();
const withAge = (s, a) => ({ ...s, profile: { ...s.profile, birthYear: yr - a } });

test('age modes: family under 13, teen 13-17, caps and race limits', () => {
  const s = E.newState(Date.now());
  assert.equal(AGE.isKid(withAge(s, 9)), true);
  assert.equal(AGE.isTeen(withAge(s, 15)), true);
  assert.equal(AGE.isTeen(withAge(s, 30)), false);
  assert.equal(AGE.runCap(withAge(s, 14)), 8);
  assert.equal(AGE.runCap(withAge(s, 17)), 10);
  assert.equal(AGE.runCap(withAge(s, 30)), null);
  assert.equal(AGE.raceAgeBlock(withAge(s, 15), 'half'), 16);
  assert.equal(AGE.raceAgeBlock(withAge(s, 17), 'half'), null);
  assert.equal(AGE.raceAgeBlock(withAge(s, 17), 'marathon'), 18);
  const v = TG.verdict(withAge(s, 15), { date: `${yr + 1}-03-01`, distance: 'marathon', goal: 'finish' }, Date.now());
  assert.equal(v.kind, 'age');
  assert.equal(AGE.ageGroupOf(34), '30-39');
});

test('family mode: two different missions a day, stable within the day', () => {
  const [a, b] = missionsFor(['swim'], '2026-10-15');
  assert.ok(a && b && a.id !== b.id);
  assert.deepEqual(missionsFor(['swim'], '2026-10-15').map(m => m.id), [a.id, b.id]);
  assert.ok(MISSIONS.every(m => m.min <= 30));
});

test('age comes from the birthday: it goes up on the day, and a child moves on to Teen mode at 13', () => {
  const now = new Date(2026, 9, 18, 12).getTime();
  assert.equal(AGE.ageFromDate('1990-10-18', now), 36);
  assert.equal(AGE.ageFromDate('1990-10-19', now), 35);
  assert.equal(AGE.ageFromDate('bad', now), null);
  const s = E.newState(Date.now());
  const d = new Date(); const ymd = (y) => `${d.getFullYear() - y}-01-01`;
  assert.equal(AGE.isKid({ ...s, profile: { ...s.profile, kid: true, birthDate: ymd(14) } }), false);
  assert.equal(AGE.isKid({ ...s, profile: { ...s.profile, kid: true, birthDate: ymd(10) } }), true);
  assert.equal(AGE.ageGroupNow({ ...s, profile: { ...s.profile, ageGroup: '18-29', birthDate: ymd(41) } }), '40-49');
});
