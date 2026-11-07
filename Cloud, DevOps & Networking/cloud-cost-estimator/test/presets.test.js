import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listPresets, presetWorkload } from '../src/state.js';
import { estimateWorkload } from '../src/calculator.js';
import { getRate } from '../src/pricing.js';

describe('workload presets', () => {
  it('exposes the four documented presets', () => {
    const ids = listPresets().map((preset) => preset.id);
    assert.deepEqual(ids, ['dev', 'portfolio', 'production', 'data-heavy']);
    listPresets().forEach((preset) => {
      assert.ok(preset.name && preset.description);
    });
  });

  it('builds a complete multi-service workload for a rich preset', () => {
    const workload = presetWorkload('production', 'us-east-1');

    assert.equal(workload.services.ec2.enabled, true);
    assert.equal(workload.services.ec2.quantity, 2);
    assert.equal(workload.services.s3.enabled, true);
    assert.equal(workload.services.rds.enabled, true);
    assert.equal(workload.services.dataTransfer.enabled, true);
    assert.equal(workload.budget, 120);
  });

  it('disables services a preset does not use but keeps them valid', () => {
    const workload = presetWorkload('dev', 'us-east-1');

    assert.equal(workload.services.s3.enabled, false);
    assert.equal(workload.services.rds.enabled, false);
    assert.equal(workload.services.dataTransfer.enabled, false);
    // still normalized: disabled services retain numeric fields
    assert.equal(typeof workload.services.rds.instanceRate, 'number');
  });

  it('resolves rates from the target region', () => {
    const virginia = presetWorkload('portfolio', 'us-east-1');
    const sydney = presetWorkload('portfolio', 'ap-southeast-2');

    assert.equal(virginia.services.ec2.rate, getRate('us-east-1', 'ec2', 't3.small'));
    assert.equal(sydney.services.ec2.rate, getRate('ap-southeast-2', 'ec2', 't3.small'));
    assert.ok(sydney.services.ec2.rate > virginia.services.ec2.rate);
  });

  it('produces a higher estimate for heavier presets', () => {
    const dev = estimateWorkload(presetWorkload('dev', 'us-east-1')).total;
    const heavy = estimateWorkload(presetWorkload('data-heavy', 'us-east-1')).total;
    assert.ok(heavy > dev * 10);
  });

  it('falls back to a valid default workload for an unknown preset', () => {
    const workload = presetWorkload('nope', 'us-east-1');
    assert.equal(workload.services.ec2.enabled, true);
  });
});
