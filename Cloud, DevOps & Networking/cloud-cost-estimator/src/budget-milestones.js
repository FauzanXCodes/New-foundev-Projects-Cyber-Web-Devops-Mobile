/**
 * Budget-trajectory milestones.
 *
 * A first over-budget month is useful but loses the earlier warning stages.
 * These helpers expose each threshold directly from the forecast without
 * presenting the entered growth assumption as a prediction.
 */

const MILESTONES = Object.freeze([
  { id: 'watch', label: 'Watch threshold', thresholdPercent: 75, matches: (amount, budget) => amount >= budget * 0.75 },
  { id: 'risk', label: 'Risk threshold', thresholdPercent: 90, matches: (amount, budget) => amount >= budget * 0.9 },
  { id: 'at-budget', label: 'At budget', thresholdPercent: 100, matches: (amount, budget) => amount >= budget },
  { id: 'over-budget', label: 'Over budget', thresholdPercent: 100, matches: (amount, budget) => amount > budget },
]);

function validAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Return the first forecast month that reaches each budget-health threshold. */
export function buildBudgetMilestones(forecast) {
  const budget = validAmount(forecast?.budget);
  if (budget <= 0) {
    return { status: 'no-budget', budget: 0, milestones: [] };
  }
  const months = Array.isArray(forecast?.months) ? forecast.months : [];
  const milestones = MILESTONES.map((definition) => {
    const month = months.find((entry) => definition.matches(validAmount(entry?.amount), budget));
    return {
      id: definition.id,
      label: definition.label,
      thresholdPercent: definition.thresholdPercent,
      firstMonth: Number.isInteger(month?.month) ? month.month : null,
      amount: month ? validAmount(month.amount) : null,
    };
  });
  return {
    status: milestones.some((milestone) => milestone.firstMonth !== null) ? 'has-milestones' : 'within-horizon',
    budget,
    milestones,
  };
}
