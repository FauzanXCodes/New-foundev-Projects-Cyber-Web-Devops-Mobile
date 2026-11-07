import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allocateSavingsTarget, buildForecastSavingsPlan, buildSavingsPlan } from '../src/savings.js';

const overBudgetEstimate = {
  total: 125,
  budget: 100,
  services: [
    { id: 'storage', label: 'Storage', enabled: true, amount: 40 },
    { id: 'compute', label: 'Compute', enabled: true, amount: 80 },
    { id: 'disabled', label: 'Disabled', enabled: false, amount: 30 },
    { id: 'free', label: 'Free', enabled: true, amount: 0 },
  ],
};

describe('buildSavingsPlan', () => {
  it('reports the exact monthly, annual, and daily reduction target', () => {
    const plan = buildSavingsPlan(overBudgetEstimate);

    assert.equal(plan.status, 'over');
    assert.equal(plan.monthlyGap, 25);
    assert.equal(plan.annualGap, 300);
    assert.equal(plan.dailyReductionTarget, 25 / 30);
    assert.equal(plan.reductionPercent, 20);
  });

  it('reports headroom when the estimate is within budget', () => {
    const plan = buildSavingsPlan({ total: 80, budget: 100 });

    assert.equal(plan.status, 'within');
    assert.equal(plan.monthlyGap, 0);
    assert.equal(plan.headroom, 20);
  });

  it('is safe when no monthly budget is set', () => {
    const plan = buildSavingsPlan({ total: 80, budget: 0 });

    assert.equal(plan.status, 'no-budget');
    assert.equal(plan.monthlyGap, 0);
    assert.equal(plan.dailyReductionTarget, 0);
  });
});

describe('allocateSavingsTarget', () => {
  it('starts with the largest driver and stops once the gap is covered', () => {
    const rows = allocateSavingsTarget(overBudgetEstimate);

    assert.deepEqual(
      rows.map((row) => [row.id, row.targetReduction]),
      [
        ['compute', 25],
        ['storage', 0],
      ],
    );
  });

  it('keeps an explicit contingency out of service-reduction targets', () => {
    const rows = allocateSavingsTarget({
      ...overBudgetEstimate,
      services: [
        ...overBudgetEstimate.services,
        { id: 'contingency', label: 'Contingency buffer', enabled: true, amount: 20 },
      ],
    });

    assert.equal(rows.some((row) => row.id === 'contingency'), false);
  });
});

describe('buildForecastSavingsPlan', () => {
  it('makes a future budget crossing and its cumulative pressure explicit', () => {
    const plan = buildForecastSavingsPlan({
      budget: 100,
      finalMonthTotal: 130,
      months: [{ amount: 90 }, { amount: 105 }, { amount: 120 }, { amount: 130 }],
    });

    assert.equal(plan.status, 'crosses-budget');
    assert.equal(plan.firstOverBudgetMonth, 2);
    assert.equal(plan.monthsOverBudget, 3);
    assert.equal(plan.horizonOverage, 55);
    assert.equal(plan.finalMonthGap, 30);
  });

  it('distinguishes a no-budget forecast from one that stays within the horizon', () => {
    assert.equal(buildForecastSavingsPlan({ budget: 0, months: [{ amount: 100 }] }).status, 'no-budget');
    assert.equal(
      buildForecastSavingsPlan({ budget: 100, finalMonthTotal: 95, months: [{ amount: 80 }, { amount: 95 }] }).status,
      'within-horizon',
    );
  });
});
