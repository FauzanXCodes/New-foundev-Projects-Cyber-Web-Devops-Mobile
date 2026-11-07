/**
 * Forward cost forecast helpers.
 *
 * Forecasting deliberately compounds the current monthly estimate by a user
 * supplied planning-growth assumption. It is not a prediction or a live AWS
 * price feed; the returned rows make every assumption auditable in the UI,
 * exports, and scenario comparisons.
 */

import { estimateWorkload } from './calculator.js';
import { normalizeWorkload } from './state.js';

function positiveAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Produce one bounded, deterministic projection row for each planning month.
 * The base month is the current estimate; growth starts affecting month two.
 */
export function buildForecast(input) {
  const workload = normalizeWorkload(input);
  const estimate = estimateWorkload(workload);
  const baseMonthlyTotal = positiveAmount(estimate.total);
  const baseMonthlyGrossTotal = positiveAmount(estimate.grossTotal);
  const { horizonMonths, monthlyGrowthPercent } = workload.planning;
  const growthMultiplier = 1 + monthlyGrowthPercent / 100;
  const months = Array.from({ length: horizonMonths }, (_, index) => {
    const amount = baseMonthlyTotal * growthMultiplier ** index;
    const grossAmount = baseMonthlyGrossTotal * growthMultiplier ** index;
    return {
      month: index + 1,
      label: `Month ${index + 1}`,
      amount,
      grossAmount,
      commitmentSavings: Math.max(0, grossAmount - amount),
      budgetDelta: workload.budget > 0 ? workload.budget - amount : null,
      overBudget: workload.budget > 0 && amount > workload.budget,
    };
  });
  const horizonTotal = months.reduce((total, month) => total + month.amount, 0);
  const horizonGrossTotal = months.reduce((total, month) => total + month.grossAmount, 0);
  const finalMonthTotal = months.at(-1)?.amount ?? 0;
  const firstOverBudgetMonth = months.find((month) => month.overBudget)?.month ?? null;

  return {
    horizonMonths,
    monthlyGrowthPercent,
    baseMonthlyTotal,
    baseMonthlyGrossTotal,
    finalMonthTotal,
    finalMonthCommitmentSavings: months.at(-1)?.commitmentSavings ?? 0,
    horizonTotal,
    horizonGrossTotal,
    horizonCommitmentSavings: Math.max(0, horizonGrossTotal - horizonTotal),
    averageMonthlyTotal: horizonMonths > 0 ? horizonTotal / horizonMonths : 0,
    annualizedRunRate: finalMonthTotal * 12,
    growthAmount: monthlyGrowthPercent === 0 ? 0 : horizonTotal - baseMonthlyTotal * horizonMonths,
    monthlyTrend: monthlyGrowthPercent > 0 ? 'growth' : monthlyGrowthPercent < 0 ? 'decline' : 'flat',
    budget: workload.budget,
    monthsOverBudget: months.filter((month) => month.overBudget).length,
    firstOverBudgetMonth,
    months,
  };
}

/**
 * Group a monthly forecast into auditable planning years. The final row may
 * contain fewer than 12 months when the selected horizon is not a full year.
 */
export function buildAnnualRollups(forecast) {
  const months = Array.isArray(forecast?.months) ? forecast.months : [];
  const rows = [];
  for (let start = 0; start < months.length; start += 12) {
    const period = months.slice(start, start + 12);
    const amount = period.reduce((total, month) => total + positiveAmount(month?.amount), 0);
    const grossAmount = period.reduce((total, month) => total + positiveAmount(month?.grossAmount ?? month?.amount), 0);
    const commitmentSavings = period.reduce(
      (total, month) => total + positiveAmount(month?.commitmentSavings),
      0,
    );
    rows.push({
      year: rows.length + 1,
      startMonth: start + 1,
      endMonth: start + period.length,
      months: period.length,
      amount,
      grossAmount,
      commitmentSavings,
      averageMonthlyTotal: period.length > 0 ? amount / period.length : 0,
      overBudgetMonths: period.filter((month) => month?.overBudget === true).length,
    });
  }
  return rows;
}

/**
 * Compare two workload forecasts over the horizon they genuinely share.
 * Scenarios may deliberately use different horizons, so the result never
 * silently compares a 12-month plan with a 24-month plan as if they matched.
 */
export function compareForecasts(activeInput, otherInput) {
  const activeForecast = buildForecast(activeInput);
  const otherForecast = buildForecast(otherInput);
  const horizonMonths = Math.min(activeForecast.horizonMonths, otherForecast.horizonMonths);
  const totalFor = (forecast) => forecast.months
    .slice(0, horizonMonths)
    .reduce((total, month) => total + month.amount, 0);
  const activeHorizonTotal = totalFor(activeForecast);
  const otherHorizonTotal = totalFor(otherForecast);
  const horizonDifference = otherHorizonTotal - activeHorizonTotal;
  const activeFinalMonthTotal = activeForecast.months[horizonMonths - 1]?.amount ?? 0;
  const otherFinalMonthTotal = otherForecast.months[horizonMonths - 1]?.amount ?? 0;

  return {
    horizonMonths,
    horizonsMatch: activeForecast.horizonMonths === otherForecast.horizonMonths,
    active: {
      horizonTotal: activeHorizonTotal,
      finalMonthTotal: activeFinalMonthTotal,
      monthlyGrowthPercent: activeForecast.monthlyGrowthPercent,
    },
    other: {
      horizonTotal: otherHorizonTotal,
      finalMonthTotal: otherFinalMonthTotal,
      monthlyGrowthPercent: otherForecast.monthlyGrowthPercent,
    },
    horizonDifference,
    horizonPercent: activeHorizonTotal > 0
      ? (horizonDifference / activeHorizonTotal) * 100
      : null,
    finalMonthDifference: otherFinalMonthTotal - activeFinalMonthTotal,
  };
}
