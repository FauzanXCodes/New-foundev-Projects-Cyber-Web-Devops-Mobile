import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  THEMES,
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
} from '../src/theme.js';

function memoryStorage(seed) {
  const map = new Map();
  if (seed !== undefined) {
    map.set('cloud-cost-calculator-theme', seed);
  }
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

describe('resolveTheme', () => {
  it('returns explicit light/dark unchanged', () => {
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('dark', false), 'dark');
  });

  it('follows the OS preference for system', () => {
    assert.equal(resolveTheme('system', true), 'dark');
    assert.equal(resolveTheme('system', false), 'light');
  });
});

describe('theme preference storage', () => {
  it('defaults to system when nothing is saved', () => {
    assert.equal(loadThemePreference(memoryStorage()), 'system');
  });

  it('round-trips a valid preference', () => {
    const storage = memoryStorage();
    saveThemePreference(storage, 'dark');
    assert.equal(loadThemePreference(storage), 'dark');
  });

  it('rejects unknown values on read and write', () => {
    assert.equal(loadThemePreference(memoryStorage('rainbow')), 'system');
    const storage = memoryStorage();
    assert.equal(saveThemePreference(storage, 'rainbow'), 'system');
    assert.equal(loadThemePreference(storage), 'system');
  });

  it('exposes exactly the three supported themes', () => {
    assert.deepEqual([...THEMES], ['system', 'light', 'dark']);
  });
});
