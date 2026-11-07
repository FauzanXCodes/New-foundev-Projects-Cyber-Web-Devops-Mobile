import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateWorkload } from '../src/calculator.js';
import { createDefaultWorkload, LIMITS, normalizeWorkload } from '../src/state.js';

describe('additional service allowance', () => {
  it('adds a labeled monthly allowance to the total when enabled', () => {
    const workload = createDefaultWorkload();
    workload.services.additional = {
      enabled: true,
      label: 'CloudWatch and backups',
      monthlyCost: 12.5,
    };

    const estimate = estimateWorkload(workload);
    const item = estimate.lineItems.find((line) => line.service === 'additional');

    assert.equal(item.label, 'CloudWatch and backups');
    assert.equal(item.amount, 12.5);
    assert.equal(estimate.serviceSubtotals.additional, 12.5);
  });

  it('normalizes a missing label and caps a manually entered allowance', () => {
    const workload = normalizeWorkload({
      services: { additional: { enabled: true, label: '   ', monthlyCost: LIMITS.additionalMonthlyCost + 1 } },
    });

    assert.equal(workload.services.additional.label, 'Other AWS services');
    assert.equal(workload.services.additional.monthlyCost, LIMITS.additionalMonthlyCost);
  });
});
