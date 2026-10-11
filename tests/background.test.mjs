import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as T from '../js/tri.js';
import * as BG from '../js/background.js';

const now = new Date(2026, 9, 12, 9).getTime();
const base = () => E.placeFromAnswers(E.newState(now), { continuous: '20-30', longestKm: 5, runsLast4w: 6, pain: 'none', daysPerWeek: 4 }, now).state;
const tri = (s, a) => { s.profile.tracks = ['run', 'tri']; s.tri = T.placeTri(s, a); return s; };
const exSwimmer = [{ sport: 'swimming', level: 'subelite', years: '10', since: '10plus' }];

test("an ex sub-elite swimmer who hasn't swum in years keeps his technique", () => {
  let s = tri(base(), { swimDist: '100', freestyle: 'yes', openWater: 'yes', longestRide: '20', bikeAccess: 'road' });
  assert.equal(s.tri.swim.stage, 2);
  s = E.applyBackground(s, exSwimmer);
  assert.equal(s.tri.swim.stage, 3); // water comfort, freestyle, breathing credited
});

test('comeback fast-track: gates open right away until near the old level', () => {
  let s = E.applyBackground(tri(base(), { swimDist: '200', freestyle: 'yes', openWater: 'yes', longestRide: '20', bikeAccess: 'road' }), exSwimmer);
  assert.equal(BG.fast(s, 'swim'), true);
  assert.equal(E.trackSteps(s, 'swim').at(-1).status, 'open'); // "prove it" straight away
  assert.equal(BG.fast(s, 'bike'), false); // background is swimming only
  s.tri.swim.stage = 7; // back near sub-elite level
  assert.equal(BG.fast(s, 'swim'), false);
});

test('former runners open run gates at about half the XP', () => {
  let s = base();
  const normal = E.levelProgress(s).target;
  s = E.applyBackground(s, [{ sport: 'running', level: 'comp', years: '6', since: '3to10' }]);
  assert.ok(E.levelProgress(s).target < normal);
  assert.ok(E.levelProgress(s).fast);
});

test('still training or recreational: no comeback treatment', () => {
  const s = E.applyBackground(base(), [{ sport: 'running', level: 'club', years: '3', since: 'now' }]);
  assert.equal(BG.fast(s, 'run'), false);
  assert.equal(BG.isFormerAthlete(s), false);
  assert.equal(BG.describe(exSwimmer)[0], 'Sub-elite swimming · 10+ years · stopped more than 10 years ago');
});
