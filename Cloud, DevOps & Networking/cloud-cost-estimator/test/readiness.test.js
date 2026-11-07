import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDecisionReadiness } from '../src/readiness.js';
import { createDefaultWorkload } from '../src/state.js';

function byId(result, id) {
  return result.checks.find((item) => item.id === id);
}

describe('buildDecisionReadiness', () => {
  it('returns explicit ready checks for a documented, budgeted planning case', () => {
    const workload = createDefaultWorkload();
    workload.budget = 1_000;
    workload.metadata.owner = 'Platform team';
    workload.planning.contingencyPercent = 10;
    workload.planning.rateVariancePercent = 15;
    workload.optimization.ec2CoveragePercent = 80;
    workload.optimization.ec2DiscountPercent = 20;

    const result = buildDecisionReadiness(workload);

    assert.equal(result.attentionCount, 0);
    assert.equal(result.readyCount, 6);
    assert.equal(byId(result, 'forecast-budget').status, 'ready');
    assert.equal(byId(result, 'commitment-evidence').status, 'ready');
  });

  it('surfaces missing decision evidence without synthesizing a score', () => {
    const workload = createDefaultWorkload();
    workload.budget = 0;
    workload.metadata.owner = '';
    workload.metadata.costCenter = '';
    workload.planning.contingencyPercent = 0;
    workload.planning.rateVariancePercent = 0;

    const result = buildDecisionReadiness(workload);

    assert.equal(result.attentionCount, 5);
    assert.equal(result.checks.some((item) => Object.hasOwn(item, 'score')), false);
    assert.equal(byId(result, 'commitment-evidence').status, 'info');
    assert.match(byId(result, 'budget').detail, /Set a monthly budget/);
  });
});
