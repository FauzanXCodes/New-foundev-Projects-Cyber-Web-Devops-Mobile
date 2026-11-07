/**
 * Cost-rate sensitivity helpers.
 *
 * A sensitivity envelope is an explicit what-if around the current calculated
 * plan. It does not mutate the estimate, alter pricing samples, or claim a
 * prediction; it simply makes a user-entered rate variance reviewable.
 */

import { estimateWorkload } from './calculator.js';
import { buildForecast } from './forecast.js';
import { normalizeWorkload } from './state.js';

function amount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function caseFor(id, label, baseTotal, multiplier, budget) {
  const total = amount(baseTotal) * multiplier;
  const budgetDelta = budget > 0 ? budget - total : null;
  return {
    id,
    label,
    multiplier,
    total,
    budgetDelta,
    overBudget: budget > 0 && total > budget,
  };
}

/**
 * Build low/base/high monthly cases from a bounded rate-variance assumption.
 * The base case always exactly matches `estimateWorkload(input).total`.
 */
export function buildRateSensitivity(input) {
  const workload = normalizeWorkload(input);
  const estimate = estimateWorkload(workload);
  const rateVariancePercent = workload.planning.rateVariancePercent;
  const varianceMultiplier = rateVariancePercent / 100;
  const baseTotal = amount(estimate.total);
  const budget = amount(workload.budget);
  const cases = [
    caseFor('low', 'Lower-rate case', baseTotal, Math.max(0, 1 - varianceMultiplier), budget),
    caseFor('base', 'Current plan', baseTotal, 1, budget),
    caseFor('high', 'Higher-rate case', baseTotal, 1 + varianceMultiplier, budget),
  ];

  return {
    rateVariancePercent,
    baseTotal,
    budget,
    varianceAmount: baseTotal * varianceMultiplier,
    cases,
    low: cases[0],
    base: cases[1],
    high: cases[2],
  };
}

function forecastCase(id, label, forecast, multiplier) {
  const budget = amount(forecast?.budget);
  const months = (Array.isArray(forecast?.months) ? forecast.months : []).map((month, index) => {
    const projectedCost = amount(month?.amount) * multiplier;
    return {
      month: index + 1,
      label: `Month ${index + 1}`,
      amount: projectedCost,
      budgetDelta: budget > 0 ? budget - projectedCost : null,
      overBudget: budget > 0 && projectedCost > budget,
    };
  });
  const horizonTotal = months.reduce((total, month) => total + month.amount, 0);
  const firstOverBudgetMonth = months.find((month) => month.overBudget)?.month ?? null;

  return {
    id,
    label,
    multiplier,
    horizonMonths: months.length,
    budget,
    horizonTotal,
    finalMonthTotal: months.at(-1)?.amount ?? 0,
    firstOverBudgetMonth,
    monthsOverBudget: months.filter((month) => month.overBudget).length,
    months,
  };
}

/**
 * Carry the same explicit rate variance across each month of the base forecast.
 * This turns a monthly risk envelope into a budget-crossing planning view.
 */
export function buildRateSensitivityForecast(input) {
  const workload = normalizeWorkload(input);
  const forecast = buildForecast(workload);
  const varianceMultiplier = workload.planning.rateVariancePercent / 100;
  const low = forecastCase('low', 'Lower-rate case', forecast, Math.max(0, 1 - varianceMultiplier));
  const base = forecastCase('base', 'Current plan', forecast, 1);
  const high = forecastCase('high', 'Higher-rate case', forecast, 1 + varianceMultiplier);

  return {
    rateVariancePercent: workload.planning.rateVariancePercent,
    horizonMonths: forecast.horizonMonths,
    budget: forecast.budget,
    low,
    base,
    high,
  };
}
