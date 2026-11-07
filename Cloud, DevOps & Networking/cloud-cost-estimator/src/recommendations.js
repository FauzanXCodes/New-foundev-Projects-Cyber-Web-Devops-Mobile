/**
 * Deterministic, estimate-driven recommendations.
 *
 * Recommendations are derived purely from the structured estimate (budget
 * status and the ranked cost drivers). They deliberately use tentative
 * language ("could", "consider") and never promise a specific saving, because
 * the underlying rates are simplified samples.
 */

import { formatPercent, formatUsd } from './calculator.js';

/** Enabled, non-zero services ranked from most to least expensive. */
export function analyzeDrivers(estimate) {
  return estimate.services
    .filter((service) => service.id !== 'contingency' && service.enabled && service.amount > 0)
    .slice()
    .sort((a, b) => b.amount - a.amount);
}

// Service-specific levers a user could pull to reduce the largest driver.
const DRIVER_ADVICE = Object.freeze({
  ec2: 'Right-size the instance, reduce the instance count, or shorten runtime hours (for example move an always-on box to business hours).',
  ebs: 'Prefer gp3 over gp2, trim unused provisioned capacity, or reduce the number of volumes.',
  s3: 'Move cold objects to a cheaper storage class or add lifecycle rules; batch small requests where possible.',
  rds: 'Right-size the instance class or shorten runtime for non-production databases; storage and instances are billed separately.',
  dataTransfer: 'Cache responses or front the workload with a CDN to reduce outbound egress.',
});

function driverRecommendation(top, total) {
  const share = total > 0 ? (top.amount / total) * 100 : 0;
  return {
    id: `driver-${top.id}`,
    severity: 'info',
    title: `${top.label} is your largest cost driver`,
    detail: `${top.label} is ${formatUsd(top.amount)} of the estimate (${formatPercent(share)}). ${
      DRIVER_ADVICE[top.id] ?? 'Review its configuration to reduce cost.'
    }`,
  };
}

/**
 * Build an ordered list of recommendations for an estimate.
 * The most actionable item (budget pressure or the top driver) comes first.
 */
export function buildRecommendations(estimate, forecast = null) {
  const recommendations = [];
  const drivers = analyzeDrivers(estimate);

  if (drivers.length === 0) {
    recommendations.push({
      id: 'empty',
      severity: 'info',
      title: 'No billable services yet',
      detail: 'Enable a service or add usage above to see cost drivers and tips.',
    });
    return recommendations;
  }

  switch (estimate.budgetStatus) {
    case 'over':
      recommendations.push({
        id: 'budget-over',
        severity: 'critical',
        title: 'Estimate is over budget',
        detail: `This workload is ${formatUsd(estimate.overage)} over the ${formatUsd(
          estimate.budget,
        )} budget. Reduce the drivers below or raise the budget.`,
      });
      break;
    case 'risk':
    case 'watch':
      recommendations.push({
        id: 'budget-watch',
        severity: 'warning',
        title: 'Approaching the budget limit',
        detail: `You're using ${formatPercent(
          estimate.budgetUsedPercent,
        )} of the budget, with ${formatUsd(estimate.remaining)} of headroom left.`,
      });
      break;
    case 'healthy':
      recommendations.push({
        id: 'budget-healthy',
        severity: 'positive',
        title: 'Comfortably within budget',
        detail: `The estimate uses ${formatPercent(
          estimate.budgetUsedPercent,
        )} of the budget, leaving ${formatUsd(estimate.remaining)} of headroom.`,
      });
      break;
    default:
      recommendations.push({
        id: 'budget-none',
        severity: 'info',
        title: 'Set a monthly budget',
        detail: 'Add a budget to unlock budget-health tracking and over-spend warnings.',
      });
  }

  if (estimate.budgetStatus !== 'over' && forecast?.firstOverBudgetMonth) {
    recommendations.push({
      id: 'forecast-budget-crossing',
      severity: 'warning',
      title: `Forecast crosses the budget in month ${forecast.firstOverBudgetMonth}`,
      detail: `At ${formatPercent(forecast.monthlyGrowthPercent)} monthly growth, the projected run rate reaches ${formatUsd(
        forecast.finalMonthTotal,
      )} by month ${forecast.horizonMonths}. Review the budget or cost drivers before that point.`,
    });
  }

  if (estimate.contingencyPercent === 0) {
    recommendations.push({
      id: 'contingency-none',
      severity: 'info',
      title: 'No contingency buffer is included',
      detail: 'Consider adding a visible contingency buffer for variable usage or costs outside this simplified model.',
    });
  }

  const commitmentSavings = Number.isFinite(estimate.commitmentSavings)
    ? Math.max(0, estimate.commitmentSavings)
    : 0;
  const eligibleGrossCost = Array.isArray(estimate.services)
    ? estimate.services
      .filter((service) => service?.enabled && (service.id === 'ec2' || service.id === 'rds'))
      .reduce((total, service) => total + Math.max(0, service.grossAmount ?? service.amount ?? 0), 0)
    : 0;
  if (commitmentSavings > 0) {
    recommendations.push({
      id: 'commitment-active',
      severity: 'positive',
      title: 'Commitment assumptions reduce the modeled plan',
      detail: `The transparent gross-to-net assumption lowers this monthly estimate by ${formatUsd(commitmentSavings)}. Re-check coverage and discount inputs before treating it as a purchasing case.`,
    });
  } else if (eligibleGrossCost > 0) {
    recommendations.push({
      id: 'commitment-unmodeled',
      severity: 'info',
      title: 'Eligible compute has no commitment assumption',
      detail: `${formatUsd(eligibleGrossCost)} of EC2 or RDS cost is modeled at the entered rate. If a commitment is relevant, test its coverage and discount openly rather than assuming a saving.`,
    });
  }

  recommendations.push(driverRecommendation(drivers[0], estimate.total));

  // A concentration warning when a single service dominates the estimate.
  const topShare = estimate.total > 0 ? (drivers[0].amount / estimate.total) * 100 : 0;
  if (drivers.length > 1 && topShare >= 70) {
    recommendations.push({
      id: 'concentration',
      severity: 'info',
      title: 'Cost is concentrated in one service',
      detail: `${formatPercent(topShare)} of the estimate comes from ${drivers[0].label}. Optimising it has the most leverage.`,
    });
  }

  return recommendations;
}
