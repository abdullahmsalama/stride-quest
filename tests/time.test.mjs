import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, formatTime, raceMinutes, estimateKm } from '../js/time.js';

test('parse the ways runners type times', () => {
  assert.equal(parseTime('27:30'), 27.5);
  assert.equal(parseTime('1:05:30'), 65.5);
  assert.equal(parseTime('27'), 27);
  assert.equal(parseTime('27.5'), 27.5);
  assert.equal(parseTime('27,5'), 27.5);
  assert.equal(parseTime(' 5:06 '), 5.1);
  assert.equal(parseTime('27:75'), null);
  assert.equal(parseTime('abc'), null);
  assert.equal(parseTime(''), null);
});

test('format back to mm:ss or h:mm:ss', () => {
  assert.equal(formatTime(27.5), '27:30');
  assert.equal(formatTime(65.5), '1:05:30');
  assert.equal(formatTime(null), '');
});

test('race time from total time or pace', () => {
  assert.equal(raceMinutes('25:00', 'time', 5), 25);
  assert.equal(raceMinutes('5:00', 'pace', 5), 25);
  assert.equal(raceMinutes('5:30', 'pace', 10), 55);
  assert.equal(raceMinutes('x', 'pace', 10), null);
});

test('estimate distance from a duration', () => {
  assert.equal(estimateKm(60, 25), 9.6); // easy pace 6:15/km
  assert.equal(estimateKm(75, null), 10); // default 7:30/km
});
