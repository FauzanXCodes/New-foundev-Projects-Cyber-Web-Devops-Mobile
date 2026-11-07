/**
 * Cost-allocation reporting helpers.
 *
 * The calculator already produces service subtotals. This module makes those
 * subtotals useful in a review by ranking them and exposing both individual
 * and cumulative portions of the monthly total.
 */

function amount(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Return enabled, non-zero service allocations ordered by monthly cost. */
export function buildAllocationRows(estimate) {
  const total = amount(estimate?.total);
  const services = Array.isArray(estimate?.services) ? estimate.services : [];
  let cumulativeAmount = 0;

  return services
    .filter((service) => service?.enabled && amount(service.amount) > 0)
    .slice()
    .sort((a, b) => amount(b.amount) - amount(a.amount))
    .map((service) => {
      const serviceAmount = amount(service.amount);
      cumulativeAmount += serviceAmount;
      return {
        id: service.id,
        label: service.label || service.id || 'Service',
        amount: serviceAmount,
        share: total > 0 ? serviceAmount / total : 0,
        cumulativeAmount,
        cumulativeShare: total > 0 ? cumulativeAmount / total : 0,
      };
    });
}

/** Summarise the largest driver for lightweight allocation headings. */
export function allocationSummary(estimate) {
  const rows = buildAllocationRows(estimate);
  return {
    total: amount(estimate?.total),
    count: rows.length,
    largest: rows[0] ?? null,
  };
}

/**
 * Attribute a transparent commitment saving to its affected service rows.
 * The net estimate remains the source of truth; this companion view explains
 * why the gross and net plan totals differ.
 */
export function buildCommitmentAllocationRows(estimate) {
  const totalSavings = amount(estimate?.commitmentSavings);
  const services = Array.isArray(estimate?.services) ? estimate.services : [];

  return services
    .filter((service) => service?.enabled && amount(service.commitmentSavings) > 0)
    .slice()
    .sort((a, b) => amount(b.commitmentSavings) - amount(a.commitmentSavings))
    .map((service) => {
      const savings = amount(service.commitmentSavings);
      return {
        id: service.id,
        label: service.label || service.id || 'Service',
        grossAmount: amount(service.grossAmount),
        netAmount: amount(service.amount),
        savings,
        shareOfSavings: totalSavings > 0 ? savings / totalSavings : 0,
      };
    });
}

/** Headline information for a compact commitment-impact report. */
export function commitmentAllocationSummary(estimate) {
  const rows = buildCommitmentAllocationRows(estimate);
  return {
    grossTotal: amount(estimate?.grossTotal),
    netTotal: amount(estimate?.total),
    savings: amount(estimate?.commitmentSavings),
    count: rows.length,
    largest: rows[0] ?? null,
  };
}
