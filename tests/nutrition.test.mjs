import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../js/nutrition.js';

const man = { sex: 'm', age: 30, heightCm: 175, kg: 70, life: 'sit', easyPace: 6 };
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('nutrition: resting energy uses ten Haaf (fat-free mass when body fat is known)', () => {
  near(N.rmr(man).kcal, 11.936 * 70 + 587.728 * 1.75 - 8.129 * 30 + 191.027 + 29.279, 0.01); // ~1,850, as in the review
  const lean = N.rmr({ ...man, bodyFat: 15 });
  assert.equal(lean.method, 'ten Haaf (fat-free mass)');
  near(lean.kcal, 22.771 * 59.5 + 484.264, 0.01);
  assert.equal(N.rmr({ ...man, trains: false }).method, 'Mifflin-St Jeor');
  near(N.rmr({ ...man, trains: false }).kcal, 10 * 70 + 6.25 * 175 - 5 * 30 + 5, 0.01);
});

test('nutrition: sessions read their length from the title', () => {
  assert.equal(N.sessionOf({ title: 'Easy 45 min', cls: 'easy', track: 'run' }, 6).minutes, 45);
  assert.equal(N.sessionOf({ title: 'Long run 12 km', cls: 'long', track: 'run' }, 6).minutes, 72);
  assert.equal(N.sessionOf({ title: 'Strength session A', cls: 'strength', track: 'prep' }, 6).minutes, 45);
});

test('nutrition: carbs follow the day (g/kg by training load), protein and fat stay sane', () => {
  const R = N.rmr(man).kcal;
  const rest = N.targets(man, N.dayLoad([], man, R), { type: 'maintain' });
  const long = N.targets(man, N.dayLoad([{ title: 'Long run 20 km', cls: 'long', track: 'run' }], man, R), { type: 'maintain' });
  assert.ok(long.carbs > rest.carbs * 1.5, `${rest.carbs} -> ${long.carbs}`);
  assert.ok(long.kcal > rest.kcal);
  for (const t of [rest, long]) {
    assert.ok(t.fat * 9 >= 0.2 * t.kcal - 15 && t.fat >= 0.6 * man.kg - 1, 'fat floor');
    assert.ok(t.protein >= 1.6 * man.kg - 1);
  }
});

test('nutrition: a deficit never drops below the low energy availability floor (REDs)', () => {
  for (const kg of [45, 55, 70]) for (const ex of [0, 600, 1500]) {
    const p = { sex: 'f', age: 25, heightCm: 160, kg, life: 'sit', bodyFat: 20, easyPace: 6 };
    const t = N.targets(p, { exKcal: ex, load: ex ? 'hard' : 'rest', strength: false }, { type: 'cut', pace: 'steady' });
    assert.ok(t.ea >= 29.5, `EA ${t.ea} at ${kg} kg / ${ex} kcal`);
  }
});

test('nutrition: protein rises in a deficit; weight change stays within safe rates', () => {
  const R = N.rmr(man).kcal, day = N.dayLoad([], man, R);
  assert.ok(N.targets(man, day, { type: 'cut' }).protein > N.targets(man, day, { type: 'maintain' }).protein);
  assert.equal(N.weeklyRate({ type: 'cut', pace: 'steady' }, { ...man, bodyFat: 12 }), 0.7); // lean: slower
  assert.equal(N.weeklyRate({ type: 'gain', pace: 'slow' }, man), 0.25);
});

test('nutrition: clashes are explained, with a safer option to apply', () => {
  const t = { floorApplied: false, ea: 40 };
  const race = N.checks({ goal: { type: 'cut' }, phase: 'taper', t });
  assert.equal(race[0].id, 'race'); assert.equal(race[0].apply.mode, 'perform');
  assert.ok(N.checks({ goal: { type: 'cut' }, rebuild: true, t }).some(x => x.id === 'injury'));
  assert.equal(N.checks({ goal: { type: 'maintain' }, phase: 'taper', t }).length, 0);
  assert.equal(N.checks({ goal: { type: 'cut' }, t: { floorApplied: true, ea: 30 } })[0].level, 'danger');
});

test('nutrition: an unrealistic goal date gets a realistic one', () => {
  const now = Date.UTC(2026, 9, 15);
  const g = N.goalCheck({ ...man, kg: 90 }, { weight: 80, date: '2026-11-15' }, now);
  assert.equal(g.ok, false);
  assert.ok(g.realistic > '2027-01-01', g.realistic);
  assert.equal(N.goalCheck({ ...man, kg: 90 }, { weight: 86, date: '2027-03-01' }, now).ok, true);
});

test('nutrition: fuelling during sessions scales with duration', () => {
  assert.equal(N.sessionFuel(45, 70).during.g, 0);
  assert.equal(N.sessionFuel(90, 70).during.g, 30);
  assert.equal(N.sessionFuel(140, 70).during.g, 60);
  assert.equal(N.sessionFuel(200, 70).during.g, 90);
  assert.match(N.raceFuel(120, 70).load, /carb-load/);
  assert.match(N.raceFuel(30, 70).load, /No carb-loading/);
});

test('nutrition: interval sessions count their reps of km and a warm-up/cool-down', () => {
  const s = N.sessionOf({ title: '3 x 3 km at half-marathon pace', cls: 'hard', track: 'run' }, 6);
  assert.ok(s.km > 11 && s.km < 14, `km ${s.km}`);
  assert.ok(N.sessionOf({ title: 'Tempo 20 min comfortably hard', cls: 'hard', track: 'run' }, 6).minutes === 40);
});

test('nutrition: a short quality run is a moderate day; maintain never goes above TDEE for it', () => {
  const p = { sex: 'f', age: 30, heightCm: 165, kg: 55, life: 'sit', easyPace: 6.5 };
  const day = N.dayLoad([{ title: 'Tempo 20 min comfortably hard', cls: 'hard', track: 'run' }], p, N.rmr(p).kcal);
  assert.equal(day.load, 'moderate');
  const t = N.targets(p, day, { type: 'maintain' });
  assert.ok(t.kcal <= t.tdee + 10, `${t.kcal} vs ${t.tdee}`);
  assert.equal(N.dayLoad([{ title: 'Long run 14 km', cls: 'long', track: 'run' }], p, 1300).load, 'hard');
});

test('nutrition: mobility is not a strength day; heavy lifting is labelled a strength day', () => {
  const d = N.dayLoad([{ title: 'Mobility session A', cls: 'strength', track: 'prep' }], man, 1800);
  assert.equal(d.strength, false);
  assert.ok(d.exKcal < 150, `${d.exKcal}`);
  assert.equal(N.dayLoad([{ title: 'Squat wave 3-2-1 heavy', cls: 'strength', track: 'strength' }], man, 1800).label, 'Strength day');
});

test('nutrition: no deficit for under-18s or after REDs warning signs', () => {
  const teen = { sex: 'f', age: 16, heightCm: 160, kg: 52, life: 'sit', easyPace: 6.5 };
  const day = N.dayLoad([], teen, N.rmr(teen).kcal);
  const t = N.targets(teen, day, { type: 'cut', pace: 'steady' });
  assert.equal(t.held, 'young'); assert.equal(t.deficit, 0);
  assert.ok(N.checks({ goal: { type: 'cut' }, t, load: day.load }).some(c => c.id === 'young'));
  const r = N.targets(man, N.dayLoad([], man, 1800), { type: 'cut' }, { reds: true });
  assert.equal(r.held, 'reds'); assert.equal(r.deficit, 0);
});

test('nutrition: physical work uses a higher activity level; protein spread is 4-5 doses', () => {
  const day = N.dayLoad([], man, 1800);
  assert.ok(N.targets({ ...man, life: 'physical' }, day).tdee > N.targets(man, day).tdee * 1.25);
  const t = N.targets({ ...man, kg: 55, sex: 'f' }, day, { type: 'cut', pace: 'steady' });
  assert.ok(t.proteinDoses <= 5 && t.doseG >= 20, `${t.proteinDoses} x ${t.doseG}`);
});

test('nutrition: goal date check uses the chosen pace and spots past dates', () => {
  const now = Date.parse('2026-10-15T12:00:00');
  const past = N.goalCheck({ ...man }, { type: 'cut', pace: 'slow', weight: 65, date: '2026-10-10' }, now);
  assert.equal(past.past, true); assert.equal(past.pace, 0.5);
  const c = N.checks({ goal: { type: 'cut' }, t: { ea: 40 }, goalCheck: past, load: 'rest' }).find(x => x.id === 'goal-date');
  assert.match(c.title, /passed/);
});
