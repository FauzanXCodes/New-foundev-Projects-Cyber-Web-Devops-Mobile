/**
 * Budget-gap planning helpers.
 *
 * These functions turn a structured estimate into transparent reduction
 * targets. They do not predict discounts; they show the measured gap between
 * the current estimate and its monthly budget so a user can choose a real
 * optimisation lever.
 */

function amount(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Build headline savings targets from an estimate without mutating it. */
export function buildSavingsPlan(estimate) {
  const total = amount(estimate?.total);
  const budget = amount(estimate?.budget);
  const monthlyGap = budget > 0 ? Math.max(0, total - budget) : 0;
  const headroom = budget > 0 ? Math.max(0, budget - total) : 0;

  return {
    status: budget === 0 ? 'no-budget' : monthlyGap > 0 ? 'over' : 'within',
    total,
    budget,
    monthlyGap,
    annualGap: monthlyGap * 12,
    dailyReductionTarget: monthlyGap / 30,
    reductionPercent: total > 0 ? (monthlyGap / total) * 100 : 0,
    headroom,
  };
}

/**
 * Describe the reduction pressure that appears later in a forecast. This is
 * kept separate from today's savings target: the first shows the present gap,
 * while this one makes a future budget crossing concrete without pretending
 * the same reduction can be achieved automatically.
 */
export function buildForecastSavingsPlan(forecast) {
  const budget = amount(forecast?.budget);
  const months = Array.isArray(forecast?.months) ? forecast.months : [];
  const overages = budget > 0
    ? months.map((month) => Math.max(0, amount(month?.amount) - budget))
    : [];
  const firstOverBudgetIndex = overages.findIndex((overage) => overage > 0);
  const finalMonthTotal = amount(forecast?.finalMonthTotal);
  const finalMonthGap = budget > 0 ? Math.max(0, finalMonthTotal - budget) : 0;

  return {
    status: budget === 0
      ? 'no-budget'
      : firstOverBudgetIndex >= 0
        ? 'crosses-budget'
        : 'within-horizon',
    budget,
    firstOverBudgetMonth: firstOverBudgetIndex >= 0 ? firstOverBudgetIndex + 1 : null,
    monthsOverBudget: overages.filter((overage) => overage > 0).length,
    horizonOverage: overages.reduce((total, overage) => total + overage, 0),
    finalMonthTotal,
    finalMonthGap,
  };
}

/**
 * Allocate the required monthly reduction across the largest cost drivers.
 * The output is a planning aid: it never assumes a particular service can
 * actually be reduced by the suggested amount.
 */
export function allocateSavingsTarget(estimate) {
  const plan = buildSavingsPlan(estimate);
  let remaining = plan.monthlyGap;
  const drivers = Array.isArray(estimate?.services) ? estimate.services : [];

  return drivers
    .filter((service) => service?.id !== 'contingency' && service?.enabled && amount(service.amount) > 0)
    .slice()
    .sort((a, b) => amount(b.amount) - amount(a.amount))
    .map((service) => {
      const serviceAmount = amount(service.amount);
      const targetReduction = Math.min(serviceAmount, remaining);
      remaining -= targetReduction;
      return {
        id: service.id,
        label: service.label || service.id || 'Service',
        amount: serviceAmount,
        share: plan.total > 0 ? serviceAmount / plan.total : 0,
        targetReduction,
        targetReductionPercent: serviceAmount > 0 ? (targetReduction / serviceAmount) * 100 : 0,
      };
    });
}
