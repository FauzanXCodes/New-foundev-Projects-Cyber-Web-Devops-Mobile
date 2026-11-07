import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_ESTIMATE_NAME,
  ESTIMATE_NAME_MAX_LENGTH,
  normalizeEstimateName,
} from '../src/estimate-name.js';

describe('normalizeEstimateName', () => {
  it('trims and compacts a human-readable name', () => {
    assert.equal(normalizeEstimateName('  Production   baseline  '), 'Production baseline');
  });

  it('uses the stable fallback for blank or missing names', () => {
    assert.equal(normalizeEstimateName(''), DEFAULT_ESTIMATE_NAME);
    assert.equal(normalizeEstimateName(null), DEFAULT_ESTIMATE_NAME);
  });

  it('limits labels to the browser field length', () => {
    assert.equal(normalizeEstimateName('x'.repeat(ESTIMATE_NAME_MAX_LENGTH + 5)).length, ESTIMATE_NAME_MAX_LENGTH);
  });
});
