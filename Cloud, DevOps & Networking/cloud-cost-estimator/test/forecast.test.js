import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAnnualRollups, buildForecast, compareForecasts } from '../src/forecast.js';
import { createDefaultWorkload } from '../src/state.js';
import { estimateWorkload } from '../src/calculator.js';

describe('buildForecast', () => {
  it('starts from the current estimate and projects the default 12-month horizon', () => {
    const workload = createDefaultWorkload();
    const forecast = buildForecast(workload);
    const estimate = estimateWorkload(workload);

    assert.equal(forecast.horizonMonths, 12);
    assert.equal(forecast.months.length, 12);
    assert.equal(forecast.baseMonthlyTotal, estimate.total);
    assert.equal(forecast.finalMonthTotal, estimate.total);
    assert.equal(Number(forecast.horizonTotal.toFixed(3)), Number((estimate.total * 12).toFixed(3)));
    assert.equal(forecast.growthAmount, 0);
  });

  it('compounds monthly growth after the base month and reports the ending run rate', () => {
    const workload = createDefaultWorkload();
    workload.budget = 11;
    workload.planning = { horizonMonths: 3, monthlyGrowthPercent: 10, contingencyPercent: 0 };
    const forecast = buildForecast(workload);

    assert.deepEqual(
      forecast.months.map((month) => Number(month.amount.toFixed(3))),
      [9.992, 10.991, 12.09],
    );
    assert.equal(Number(forecast.horizonTotal.toFixed(3)), 33.074);
    assert.equal(Number(forecast.annualizedRunRate.toFixed(3)), 145.084);
    assert.equal(forecast.firstOverBudgetMonth, 3);
    assert.equal(forecast.monthsOverBudget, 1);
  });

  it('compounds a planned monthly decline and keeps the change signed', () => {
    const workload = createDefaultWorkload();
    workload.planning = { horizonMonths: 3, monthlyGrowthPercent: -10, contingencyPercent: 0 };
    const forecast = buildForecast(workload);

    assert.deepEqual(
      forecast.months.map((month) => Number(month.amount.toFixed(3))),
      [9.992, 8.993, 8.094],
    );
    assert.equal(forecast.monthlyTrend, 'decline');
    assert.equal(Number(forecast.growthAmount.toFixed(3)), -2.898);
  });

  it('keeps no-budget forecasts informative without pretending a budget check exists', () => {
    const workload = createDefaultWorkload();
    workload.budget = 0;
    workload.planning.horizonMonths = 2;
    const forecast = buildForecast(workload);

    assert.equal(forecast.firstOverBudgetMonth, null);
    assert.equal(forecast.monthsOverBudget, 0);
    assert.equal(forecast.months[0].budgetDelta, null);
    assert.equal(forecast.months[0].overBudget, false);
  });

  it('carries modeled commitment savings through every forecast month', () => {
    const workload = createDefaultWorkload();
    workload.planning = { horizonMonths: 2, monthlyGrowthPercent: 10, contingencyPercent: 0, rateVariancePercent: 0 };
    workload.optimization = {
      ec2CoveragePercent: 100,
      ec2DiscountPercent: 20,
      rdsCoveragePercent: 0,
      rdsDiscountPercent: 0,
    };
    const forecast = buildForecast(workload);

    assert.ok(forecast.baseMonthlyGrossTotal > forecast.baseMonthlyTotal);
    assert.equal(Number(forecast.months[0].commitmentSavings.toFixed(3)), 1.518);
    assert.equal(Number(forecast.months[1].commitmentSavings.toFixed(3)), 1.67);
    assert.equal(Number(forecast.horizonCommitmentSavings.toFixed(3)), 3.189);
  });

  it('normalizes malformed forecast settings before calculating a bounded projection', () => {
    const forecast = buildForecast({
      planning: { horizonMonths: 999, monthlyGrowthPercent: Infinity },
      services: { ec2: { enabled: false }, ebs: { enabled: false } },
    });

    assert.equal(forecast.horizonMonths, 60);
    assert.equal(forecast.monthlyGrowthPercent, 0);
    assert.equal(forecast.horizonTotal, 0);
  });
});

describe('compareForecasts', () => {
  it('compares the same planning horizon and exposes horizon and run-rate deltas', () => {
    const active = createDefaultWorkload();
    active.planning = { horizonMonths: 3, monthlyGrowthPercent: 0, contingencyPercent: 0 };
    const other = createDefaultWorkload();
    other.planning = { horizonMonths: 3, monthlyGrowthPercent: 10, contingencyPercent: 0 };
    const comparison = compareForecasts(active, other);

    assert.equal(comparison.horizonMonths, 3);
    assert.equal(comparison.horizonsMatch, true);
    assert.equal(Number(comparison.horizonDifference.toFixed(3)), 3.098);
    assert.equal(Number(comparison.finalMonthDifference.toFixed(3)), 2.098);
    assert.equal(comparison.active.monthlyGrowthPercent, 0);
    assert.equal(comparison.other.monthlyGrowthPercent, 10);
  });

  it('uses only the shared forecast horizon when scenarios have different horizons', () => {
    const active = createDefaultWorkload();
    active.planning = { horizonMonths: 12, monthlyGrowthPercent: 0, contingencyPercent: 0 };
    const other = createDefaultWorkload();
    other.planning = { horizonMonths: 24, monthlyGrowthPercent: 0, contingencyPercent: 0 };
    const comparison = compareForecasts(active, other);

    assert.equal(comparison.horizonMonths, 12);
    assert.equal(comparison.horizonsMatch, false);
    assert.equal(comparison.horizonDifference, 0);
  });

  it('returns a null percentage when the active horizon is zero cost', () => {
    const active = createDefaultWorkload();
    active.services.ec2.enabled = false;
    active.services.ebs.enabled = false;
    const comparison = compareForecasts(active, createDefaultWorkload());

    assert.equal(comparison.active.horizonTotal, 0);
    assert.equal(comparison.horizonPercent, null);
  });
});

describe('buildAnnualRollups', () => {
  it('groups a multi-year forecast and retains a partial final planning year', () => {
    const workload = createDefaultWorkload();
    workload.budget = 10;
    workload.planning = { horizonMonths: 14, monthlyGrowthPercent: 0, contingencyPercent: 0, rateVariancePercent: 0 };
    const rows = buildAnnualRollups(buildForecast(workload));

    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => [row.startMonth, row.endMonth, row.months]), [[1, 12, 12], [13, 14, 2]]);
    assert.equal(Number(rows[0].amount.toFixed(3)), 119.904);
    assert.equal(rows[0].overBudgetMonths, 0);
  });

  it('keeps malformed forecast data safe', () => {
    assert.deepEqual(buildAnnualRollups(null), []);
    const [row] = buildAnnualRollups({ months: [{ amount: Infinity, grossAmount: -1, commitmentSavings: NaN }] });
    assert.deepEqual(row, {
      year: 1, startMonth: 1, endMonth: 1, months: 1,
      amount: 0, grossAmount: 0, commitmentSavings: 0, averageMonthlyTotal: 0, overBudgetMonths: 0,
    });
  });
});
