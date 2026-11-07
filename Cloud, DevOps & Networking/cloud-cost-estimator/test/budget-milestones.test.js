import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBudgetMilestones } from '../src/budget-milestones.js';
import { buildForecast } from '../src/forecast.js';
import { createDefaultWorkload } from '../src/state.js';

describe('buildBudgetMilestones', () => {
  it('finds each warning stage from a compounding forecast', () => {
    const workload = createDefaultWorkload();
    workload.budget = 11;
    workload.planning = { horizonMonths: 4, monthlyGrowthPercent: 10, contingencyPercent: 0, rateVariancePercent: 0 };
    const milestones = buildBudgetMilestones(buildForecast(workload));

    assert.equal(milestones.status, 'has-milestones');
    assert.deepEqual(milestones.milestones.map((entry) => entry.firstMonth), [1, 1, 3, 3]);
    assert.equal(Number(milestones.milestones[2].amount.toFixed(3)), 12.09);
  });

  it('distinguishes a forecast that remains below thresholds from a no-budget plan', () => {
    const workload = createDefaultWorkload();
    workload.budget = 100;
    const within = buildBudgetMilestones(buildForecast(workload));
    assert.equal(within.status, 'within-horizon');
    assert.ok(within.milestones.every((entry) => entry.firstMonth === null));

    assert.deepEqual(buildBudgetMilestones(null), { status: 'no-budget', budget: 0, milestones: [] });
  });
});
