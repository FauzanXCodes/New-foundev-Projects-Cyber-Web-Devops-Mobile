import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateWorkload } from '../src/calculator.js';
import { buildRateSensitivity, buildRateSensitivityForecast } from '../src/risk.js';
import { createDefaultWorkload } from '../src/state.js';

describe('buildRateSensitivity', () => {
  it('creates bounded low/base/high cases without changing the base estimate', () => {
    const workload = createDefaultWorkload();
    workload.budget = 10;
    workload.planning.rateVariancePercent = 10;
    const sensitivity = buildRateSensitivity(workload);

    assert.equal(sensitivity.base.total, estimateWorkload(workload).total);
    assert.equal(Number(sensitivity.low.total.toFixed(3)), 8.993);
    assert.equal(Number(sensitivity.high.total.toFixed(3)), 10.991);
    assert.equal(sensitivity.high.overBudget, true);
    assert.equal(sensitivity.low.overBudget, false);
  });

  it('keeps zero-variance and missing-budget cases explicit', () => {
    const workload = createDefaultWorkload();
    workload.budget = 0;
    const sensitivity = buildRateSensitivity(workload);

    assert.equal(sensitivity.varianceAmount, 0);
    assert.equal(sensitivity.low.total, sensitivity.base.total);
    assert.equal(sensitivity.high.budgetDelta, null);
    assert.equal(sensitivity.high.overBudget, false);
  });

  it('shows when the high-rate forecast crosses a budget earlier than the base plan', () => {
    const workload = createDefaultWorkload();
    workload.budget = 11;
    workload.planning = {
      horizonMonths: 3,
      monthlyGrowthPercent: 10,
      contingencyPercent: 0,
      rateVariancePercent: 10,
    };
    const sensitivity = buildRateSensitivityForecast(workload);

    assert.equal(sensitivity.base.firstOverBudgetMonth, 3);
    assert.equal(sensitivity.high.firstOverBudgetMonth, 2);
    assert.equal(sensitivity.low.firstOverBudgetMonth, null);
    assert.ok(sensitivity.high.horizonTotal > sensitivity.base.horizonTotal);
  });
});
