/**
 * Commitment-discount helpers.
 *
 * These helpers model a transparent blended discount: a user can state how
 * much eligible compute is covered and the assumed discount for that covered
 * portion. They are intentionally not a recommendation or a live AWS quote.
 */

import { normalizeWorkload } from './state.js';

export const COMMITMENT_SERVICE_IDS = Object.freeze(['ec2', 'rds']);

const COMMITMENT_FIELDS = Object.freeze({
  ec2: { coverage: 'ec2CoveragePercent', discount: 'ec2DiscountPercent' },
  rds: { coverage: 'rdsCoveragePercent', discount: 'rdsDiscountPercent' },
});

const COMMITMENT_SERVICE_LABELS = Object.freeze({
  ec2: 'EC2',
  rds: 'RDS',
});

function positiveAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Return a normalized, explicit assumption for one commitment-eligible service. */
export function getCommitmentAssumption(input, serviceId) {
  const workload = normalizeWorkload(input);
  const fields = COMMITMENT_FIELDS[serviceId];
  if (!fields) {
    return { serviceId, coveragePercent: 0, discountPercent: 0, effectiveDiscountPercent: 0 };
  }
  const coveragePercent = workload.optimization[fields.coverage];
  const discountPercent = workload.optimization[fields.discount];
  return {
    serviceId,
    coveragePercent,
    discountPercent,
    effectiveDiscountPercent: (coveragePercent * discountPercent) / 100,
  };
}

/**
 * Summarize stated commitment and rate assumptions for scenario lists and
 * comparison views. The output describes inputs only; it does not imply that
 * a commitment should be purchased or that a rate change will occur.
 */
export function summarizeCommitmentPolicy(input) {
  const workload = normalizeWorkload(input);
  const commitments = COMMITMENT_SERVICE_IDS.map((serviceId) => {
    const assumption = getCommitmentAssumption(workload, serviceId);
    return {
      ...assumption,
      label: COMMITMENT_SERVICE_LABELS[serviceId],
      configured: assumption.coveragePercent > 0 || assumption.discountPercent > 0,
      active: assumption.effectiveDiscountPercent > 0,
    };
  });

  return {
    rateVariancePercent: workload.planning.rateVariancePercent,
    commitments,
    configured: commitments.some((commitment) => commitment.configured)
      || workload.planning.rateVariancePercent > 0,
    active: commitments.some((commitment) => commitment.active),
  };
}

/** Apply a blended commitment assumption to a non-negative eligible amount. */
export function applyCommitment(amount, assumption) {
  const grossAmount = positiveAmount(amount);
  const effectiveDiscountPercent = Number.isFinite(assumption?.effectiveDiscountPercent)
    ? Math.min(100, Math.max(0, assumption.effectiveDiscountPercent))
    : 0;
  const commitmentSavings = grossAmount * (effectiveDiscountPercent / 100);
  return {
    grossAmount,
    commitmentSavings,
    netAmount: grossAmount - commitmentSavings,
    effectiveDiscountPercent,
  };
}

/** Is a service eligible for a modeled commitment assumption? */
export function isCommitmentEligible(serviceId) {
  return COMMITMENT_SERVICE_IDS.includes(serviceId);
}
