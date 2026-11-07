/**
 * Plain-text decision brief helpers.
 *
 * A copied brief keeps the estimate, the stated assumptions, and the review
 * gaps together in a format that is useful in a ticket, pull request, or
 * planning note. It is intentionally an export of entered sample data, not a
 * pricing quote or a recommendation to buy a commitment.
 */

import { budgetStateLabel, estimateWorkload, formatPercent, formatUsd } from './calculator.js';
import { buildDecisionReadiness } from './readiness.js';
import { buildForecast } from './forecast.js';
import { getRegion } from './pricing.js';
import { normalizeEstimateName } from './estimate-name.js';
import { normalizeWorkload } from './state.js';

function textLine(label, value) {
  return value ? `${label}: ${value}` : null;
}

/** Build a concise, portable summary of an estimate and its review evidence. */
export function buildReviewBrief(input, name) {
  const workload = normalizeWorkload(input);
  const estimate = estimateWorkload(workload);
  const forecast = buildForecast(workload);
  const readiness = buildDecisionReadiness(workload);
  const largestDriver = estimate.services
    .filter((service) => service.enabled && service.amount > 0 && service.id !== 'contingency')
    .sort((left, right) => right.amount - left.amount)[0];
  const forecastTrend = forecast.monthlyTrend === 'growth'
    ? `grows to ${formatUsd(forecast.finalMonthTotal)}/mo`
    : forecast.monthlyTrend === 'decline'
      ? `declines to ${formatUsd(forecast.finalMonthTotal)}/mo`
      : `holds at ${formatUsd(forecast.finalMonthTotal)}/mo`;
  const budgetDetail = estimate.budget > 0
    ? `${formatUsd(estimate.budget)}/mo (${budgetStateLabel(estimate.budgetStatus)})`
    : 'Not set';
  const lines = [
    `${normalizeEstimateName(name)} — Cloud Cost Calculator review brief`,
    'Sample pricing for learning; not a live or official AWS quote.',
    '',
    `Region: ${getRegion(workload.region).label}`,
    `Current estimate: ${formatUsd(estimate.total)}/mo (${formatUsd(estimate.annualTotal)}/yr)`,
    `Monthly budget: ${budgetDetail}`,
    `Forecast: ${forecast.horizonMonths} months at ${formatPercent(forecast.monthlyGrowthPercent)} monthly change; ${forecastTrend}.`,
    forecast.firstOverBudgetMonth
      ? `Forecast budget check: first exceeds budget in month ${forecast.firstOverBudgetMonth}.`
      : estimate.budget > 0
        ? `Forecast budget check: within budget for all ${forecast.horizonMonths} months.`
        : null,
    largestDriver ? `Largest cost driver: ${largestDriver.label} at ${formatUsd(largestDriver.amount)}/mo.` : null,
    estimate.commitmentSavings > 0
      ? `Modeled commitment saving: ${formatUsd(estimate.commitmentSavings)}/mo.`
      : null,
    `Decision readiness: ${readiness.readyCount} ready, ${readiness.attentionCount} need attention.`,
    textLine('Owner', workload.metadata.owner),
    textLine('Cost centre', workload.metadata.costCenter),
    textLine('Review note', workload.metadata.notes),
  ];

  return lines.filter((line) => line !== null).join('\n');
}
