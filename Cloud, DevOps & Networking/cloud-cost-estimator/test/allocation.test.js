import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allocationSummary,
  buildAllocationRows,
  buildCommitmentAllocationRows,
  commitmentAllocationSummary,
} from '../src/allocation.js';

const estimate = {
  total: 100,
  services: [
    { id: 'storage', label: 'Storage', enabled: true, amount: 25 },
    { id: 'compute', label: 'Compute', enabled: true, amount: 60 },
    { id: 'transfer', label: 'Transfer', enabled: true, amount: 15 },
    { id: 'disabled', label: 'Disabled', enabled: false, amount: 99 },
  ],
};

describe('buildAllocationRows', () => {
  it('orders active costs largest-first with shares and cumulative totals', () => {
    assert.deepEqual(buildAllocationRows(estimate), [
      {
        id: 'compute',
        label: 'Compute',
        amount: 60,
        share: 0.6,
        cumulativeAmount: 60,
        cumulativeShare: 0.6,
      },
      {
        id: 'storage',
        label: 'Storage',
        amount: 25,
        share: 0.25,
        cumulativeAmount: 85,
        cumulativeShare: 0.85,
      },
      {
        id: 'transfer',
        label: 'Transfer',
        amount: 15,
        share: 0.15,
        cumulativeAmount: 100,
        cumulativeShare: 1,
      },
    ]);
  });

  it('returns an empty report for malformed or zero-cost input', () => {
    assert.deepEqual(buildAllocationRows(null), []);
    assert.deepEqual(buildAllocationRows({ total: 0, services: [] }), []);
  });
});

describe('allocationSummary', () => {
  it('reports the number of allocated services and the largest driver', () => {
    const summary = allocationSummary(estimate);
    assert.equal(summary.count, 3);
    assert.equal(summary.largest.id, 'compute');
    assert.equal(summary.total, 100);
  });
});

describe('commitment allocation', () => {
  const commitmentEstimate = {
    total: 85,
    grossTotal: 100,
    commitmentSavings: 15,
    services: [
      { id: 'compute', label: 'Compute', enabled: true, amount: 50, grossAmount: 60, commitmentSavings: 10 },
      { id: 'database', label: 'Database', enabled: true, amount: 35, grossAmount: 40, commitmentSavings: 5 },
      { id: 'storage', label: 'Storage', enabled: true, amount: 0, grossAmount: 0, commitmentSavings: 0 },
    ],
  };

  it('ranks gross-to-net savings without treating zero-savings services as commitments', () => {
    assert.deepEqual(buildCommitmentAllocationRows(commitmentEstimate), [
      { id: 'compute', label: 'Compute', grossAmount: 60, netAmount: 50, savings: 10, shareOfSavings: 10 / 15 },
      { id: 'database', label: 'Database', grossAmount: 40, netAmount: 35, savings: 5, shareOfSavings: 5 / 15 },
    ]);
  });

  it('summarizes the largest contribution to modeled commitment savings', () => {
    const summary = commitmentAllocationSummary(commitmentEstimate);
    assert.equal(summary.grossTotal, 100);
    assert.equal(summary.netTotal, 85);
    assert.equal(summary.savings, 15);
    assert.equal(summary.largest.id, 'compute');
  });
});
