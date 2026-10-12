import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fogBands, cropTop, CLOUD_VIEW } from '../js/fog.js';

test('fog: the world you stand in and the next are clear, one dimmed, the rest clouded', () => {
  assert.deepEqual(fogBands(8, 0), { clear: 1, dim: 2, cloud: 3 });
  assert.deepEqual(fogBands(8, 5), { clear: 6, dim: 7, cloud: null });
  assert.deepEqual(fogBands(8, 6), { clear: 7, dim: null, cloud: null });
  assert.deepEqual(fogBands(8, 7), { clear: 7, dim: null, cloud: null });
});

test('fog: only the clouded top is cropped, leaving a short cloud band', () => {
  assert.equal(cropTop(null), 0);
  assert.equal(cropTop(300), 0);
  assert.equal(cropTop(2000), 2000 - CLOUD_VIEW);
});
