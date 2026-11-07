import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_SHARE_TOKEN_LENGTH,
  buildShareUrl,
  canUseWebShare,
  decodeState,
  encodeState,
  hasShareParam,
  parseShareParam,
} from '../src/share.js';
import { createDefaultWorkload } from '../src/state.js';

describe('share state', () => {
  it('round-trips a workload through encode/decode', () => {
    const workload = createDefaultWorkload();
    workload.budget = 42;
    const decoded = decodeState(encodeState(workload));

    assert.equal(decoded.budget, 42);
    assert.deepEqual(decoded.services.ec2, workload.services.ec2);
  });

  it('produces URL-safe tokens (no +, /, or =)', () => {
    const token = encodeState(createDefaultWorkload());
    assert.doesNotMatch(token, /[+/=]/);
  });

  it('returns null for malformed or empty tokens', () => {
    assert.equal(decodeState('not-base64!!'), null);
    assert.equal(decodeState(''), null);
    assert.equal(decodeState(null), null);
    // valid base64 that is not JSON
    assert.equal(decodeState('Zm9vYmFy'), null);
  });

  it('rejects oversized tokens before attempting to decode them', () => {
    assert.equal(decodeState('a'.repeat(MAX_SHARE_TOKEN_LENGTH + 1)), null);
  });

  it('builds and parses a share URL', () => {
    const workload = createDefaultWorkload();
    workload.budget = 77;
    const url = buildShareUrl(workload, 'https://example.com/app/');
    const search = new URL(url).search;

    assert.ok(hasShareParam(search));
    assert.equal(parseShareParam(search).budget, 77);
  });

  it('returns null instead of throwing for an invalid base URL', () => {
    assert.equal(buildShareUrl(createDefaultWorkload(), 'not a URL'), null);
  });

  it('reports no workload for a query without the share param', () => {
    assert.equal(parseShareParam('?foo=bar'), null);
    assert.equal(hasShareParam('?foo=bar'), false);
  });
});

describe('canUseWebShare', () => {
  it('detects a native share function without requiring browser globals', () => {
    assert.equal(canUseWebShare({ share() {} }), true);
    assert.equal(canUseWebShare({}), false);
    assert.equal(canUseWebShare(null), false);
  });
});
