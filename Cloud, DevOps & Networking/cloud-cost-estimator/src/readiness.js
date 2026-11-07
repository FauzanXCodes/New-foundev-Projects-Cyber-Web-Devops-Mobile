/**
 * Decision-readiness checks.
 *
 * This module intentionally returns explicit checks instead of a composite
 * score. A review can see what is prepared, what needs attention, and why;
 * the calculator never turns that judgment into an opaque recommendation.
 */

import { estimateWorkload } from './calculator.js';
import { buildForecast } from './forecast.js';
import { buildRateSensitivity } from './risk.js';
import { normalizeWorkload } from './state.js';

function check(id, label, status, detail) {
  return { id, label, status, detail };
}

function eligibleGrossCost(estimate) {
  const services = Array.isArray(estimate?.services) ? estimate.services : [];
  return services
    .filter((service) => service?.id === 'ec2' || service?.id === 'rds')
    .reduce((total, service) => total + (Number.isFinite(service.grossAmount) ? service.grossAmount : 0), 0);
}

/**
 * Return auditable review checks for the supplied workload. Status values are
 * `ready`, `attention`, and `info`; consumers should display them directly.
 */
export function buildDecisionReadiness(input) {
  const workload = normalizeWorkload(input);
  const estimate = estimateWorkload(workload);
  const forecast = buildForecast(workload);
  const sensitivity = buildRateSensitivity(workload);
  const hasReviewContext = Boolean(workload.metadata.owner || workload.metadata.costCenter);
  const hasEligibleSpend = eligibleGrossCost(estimate) > 0;
  const checks = [
    check(
      'review-context',
      'Review context',
      hasReviewContext ? 'ready' : 'attention',
      hasReviewContext
        ? 'An owner or cost centre is attached to this estimate.'
        : 'Add an estimate owner or cost centre before sharing a decision.',
    ),
    check(
      'budget',
      'Monthly budget',
      workload.budget > 0 ? 'ready' : 'attention',
      workload.budget > 0
        ? `A monthly budget of ${workload.budget.toFixed(2)} is available for comparison.`
        : 'Set a monthly budget to evaluate plan headroom and overage.',
    ),
    check(
      'contingency',
      'Contingency reserve',
      workload.planning.contingencyPercent > 0 ? 'ready' : 'attention',
      workload.planning.contingencyPercent > 0
        ? `${workload.planning.contingencyPercent}% contingency is included in the modeled plan.`
        : 'State a contingency reserve or document why this plan has none.',
    ),
    check(
      'rate-sensitivity',
      'Rate sensitivity',
      sensitivity.rateVariancePercent > 0 ? 'ready' : 'attention',
      sensitivity.rateVariancePercent > 0
        ? `Low and high cases use a +/-${sensitivity.rateVariancePercent}% rate variance.`
        : 'Add a rate variance to make a low/base/high envelope reviewable.',
    ),
    check(
      'forecast-budget',
      'Forecast budget check',
      workload.budget <= 0 ? 'attention' : forecast.firstOverBudgetMonth ? 'attention' : 'ready',
      workload.budget <= 0
        ? 'A forecast budget check needs a monthly budget.'
        : forecast.firstOverBudgetMonth
          ? `The forecast first exceeds budget in month ${forecast.firstOverBudgetMonth}.`
          : `The forecast remains within budget for ${forecast.horizonMonths} months.`,
    ),
    check(
      'commitment-evidence',
      'Commitment evidence',
      !hasEligibleSpend ? 'info' : estimate.commitmentSavings > 0 ? 'ready' : 'info',
      !hasEligibleSpend
        ? 'No eligible EC2 or RDS cost is modeled for a commitment assumption.'
        : estimate.commitmentSavings > 0
          ? `${estimate.commitmentSavings.toFixed(2)} per month of commitment savings is modeled explicitly.`
          : 'No commitment savings are modeled; this is a transparent base-policy assumption.',
    ),
  ];
  const readyCount = checks.filter((item) => item.status === 'ready').length;
  const attentionCount = checks.filter((item) => item.status === 'attention').length;

  return { checks, readyCount, attentionCount, infoCount: checks.length - readyCount - attentionCount };
}
