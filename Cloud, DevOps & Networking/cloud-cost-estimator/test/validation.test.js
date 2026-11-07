import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampCount,
  clampRange,
  clampZero,
  isEnabled,
  isValidAmount,
  toNumber,
} from '../src/validation.js';

describe('toNumber', () => {
  it('passes through finite numbers', () => {
    assert.equal(toNumber(5), 5);
    assert.equal(toNumber(-3.5), -3.5);
    assert.equal(toNumber(0), 0);
  });

  it('rejects NaN, Infinity, and -Infinity', () => {
    assert.equal(toNumber(NaN), 0);
    assert.equal(toNumber(Infinity), 0);
    assert.equal(toNumber(-Infinity), 0);
    assert.equal(toNumber(Infinity, 7), 7);
  });

  it('parses numeric strings and trims whitespace', () => {
    assert.equal(toNumber('42'), 42);
    assert.equal(toNumber('  1.5  '), 1.5);
    assert.equal(toNumber('-8'), -8);
    assert.equal(toNumber('1e3'), 1000);
  });

  it('falls back for empty, non-numeric, or non-primitive input', () => {
    assert.equal(toNumber('', 9), 9);
    assert.equal(toNumber('   ', 9), 9);
    assert.equal(toNumber('abc', 9), 9);
    assert.equal(toNumber(null, 9), 9);
    assert.equal(toNumber(undefined, 9), 9);
    assert.equal(toNumber(true, 9), 9);
    assert.equal(toNumber({}, 9), 9);
    assert.equal(toNumber([], 9), 9);
  });
});

describe('clampZero', () => {
  it('never returns a negative number', () => {
    assert.equal(clampZero(-5), 0);
    assert.equal(clampZero('-100'), 0);
    assert.equal(clampZero(-Infinity), 0);
  });

  it('keeps valid non-negative values', () => {
    assert.equal(clampZero(12.5), 12.5);
    assert.equal(clampZero('3'), 3);
  });

  it('falls back for invalid input', () => {
    assert.equal(clampZero(NaN), 0);
    assert.equal(clampZero('nope', 4), 4);
  });
});

describe('clampRange', () => {
  it('constrains to the inclusive range', () => {
    assert.equal(clampRange(5, 0, 10), 5);
    assert.equal(clampRange(-1, 0, 10), 0);
    assert.equal(clampRange(99, 0, 10), 10);
  });

  it('uses the fallback (clamped) for invalid input', () => {
    assert.equal(clampRange('x', 2, 8, 5), 5);
    assert.equal(clampRange(Infinity, 2, 8), 2); // fallback defaults to min
    assert.equal(clampRange(NaN, 2, 8, 100), 8); // fallback 100 then clamped to max
  });
});

describe('clampCount', () => {
  it('rounds to an integer within bounds', () => {
    assert.equal(clampCount('4.6', { min: 1, max: 10 }), 5);
    assert.equal(clampCount(4.4, { min: 1, max: 10 }), 4);
    assert.equal(clampCount(-3, { min: 1, max: 10 }), 1);
    assert.equal(clampCount(999, { min: 1, max: 10 }), 10);
  });

  it('applies defaults and fallbacks', () => {
    assert.equal(clampCount(undefined, { min: 1, max: 10, fallback: 3 }), 3);
    assert.equal(clampCount('bad', { min: 2, max: 10, fallback: 2 }), 2);
    assert.equal(clampCount(5), 5); // default min 0, huge max
  });
});

describe('isEnabled', () => {
  it('treats only an explicit false as disabled', () => {
    assert.equal(isEnabled(false), false);
    assert.equal(isEnabled(true), true);
    assert.equal(isEnabled(undefined), true);
    assert.equal(isEnabled(null), true);
    assert.equal(isEnabled(0), true);
    assert.equal(isEnabled(''), true);
  });
});

describe('isValidAmount', () => {
  it('accepts only finite, non-negative numbers', () => {
    assert.equal(isValidAmount(0), true);
    assert.equal(isValidAmount(12.34), true);
    assert.equal(isValidAmount(-1), false);
    assert.equal(isValidAmount(NaN), false);
    assert.equal(isValidAmount(Infinity), false);
    assert.equal(isValidAmount('5'), false);
    assert.equal(isValidAmount(null), false);
    assert.equal(isValidAmount(undefined), false);
  });
});
