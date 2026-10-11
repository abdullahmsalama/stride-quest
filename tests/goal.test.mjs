import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dreamTarget, weeksUntil } from '../js/goal.js';

test('dreams map to the level where they become realistic', () => {
  assert.equal(dreamTarget('run my first 5k').level, 4);
  assert.equal(dreamTarget('Sub 30 5K this summer').level, 6);
  assert.equal(dreamTarget('5k under 24').level, 8);
  assert.equal(dreamTarget('a 10K').level, 7);
  assert.equal(dreamTarget('10k sub 50').level, 8);
  assert.equal(dreamTarget('half marathon').level, 9);
  assert.equal(dreamTarget('half marathon under 1:45').level, 10);
  assert.equal(dreamTarget('Finish a marathon before I turn 40').level, 12);
  assert.equal(dreamTarget('marathon sub 4 hours').level, 12);
  assert.equal(dreamTarget('my first ultra').level, 13);
  assert.equal(dreamTarget('run 30 minutes without stopping').level, 3);
  assert.equal(dreamTarget('Hyrox Pro under 1:15').track, 'hybrid');
  assert.equal(dreamTarget('Ironman 70.3').track, 'tri');
  assert.equal(dreamTarget('feel healthier'), null);
  assert.equal(dreamTarget(''), null);
});

test('weeks until a date', () => {
  const now = Date.parse('2026-10-11');
  assert.equal(weeksUntil('2026-12-20', now), 10);
  assert.equal(weeksUntil('', now), null);
});

test('triathlon dreams point at a Tri world', () => {
  assert.equal(dreamTarget('Finish an Olympic triathlon').world, 3);
  assert.equal(dreamTarget('my first sprint triathlon').world, 2);
  assert.equal(dreamTarget('Ironman 70.3 Dubai').world, 4);
  assert.equal(dreamTarget('a full Ironman').world, 5);
  assert.equal(dreamTarget('super sprint tri').world, 1);
});

test('AI readings map onto the same targets', async () => {
  const { targetFromAI } = await import('../js/goal.js');
  assert.equal(targetFromAI({ distance: '10k', targetMinutes: 50 }).level, 8);
  assert.equal(targetFromAI({ distance: 'marathon', targetMinutes: 240 }).level, 12);
  assert.equal(targetFromAI({ distance: 'olympic' }).world, 3);
  assert.equal(targetFromAI({ distance: 'hyrox' }).track, 'hybrid');
  assert.equal(targetFromAI({ distance: 'none' }), null);
});

test('hybrid dreams point at a Hybrid world', () => {
  assert.equal(dreamTarget('Finish my first Hyrox').world, 3);
  assert.equal(dreamTarget('Hyrox Open under 1:30').world, 4);
  assert.equal(dreamTarget('Hyrox Pro').world, 5);
  assert.equal(dreamTarget('Alpha X pairs with my brother').world, 2);
});
