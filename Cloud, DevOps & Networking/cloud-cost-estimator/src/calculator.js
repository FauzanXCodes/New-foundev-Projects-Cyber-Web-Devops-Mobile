/**
 * Estimation engine.
 *
 * Pure, DOM-independent functions that turn a normalized workload (see
 * `state.js`) into a structured estimate: per-service line items, per-service
 * subtotals, a monthly total, and basic budget metrics. The engine is built
 * around a service-definition registry so new AWS services can be added by
 * appending one entry rather than editing a monolithic function.
 */

import { clampRange, clampZero } from './validation.js';
import { LIMITS, normalizeWorkload } from './state.js';
import { applyCommitment, getCommitmentAssumption } from './commitments.js';

const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const RATE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const QUANTITY_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

/** Format a monetary value as USD with two decimals. */
export function formatUsd(value) {
  return MONEY_FORMATTER.format(clampZero(value));
}

/** Format a fine-grained rate (up to four decimals) for detail strings. */
export function formatRate(value) {
  return RATE_FORMATTER.format(clampZero(value));
}

/** Format a plain quantity (hours, GB, counts). */
export function formatQuantity(value) {
  return QUANTITY_FORMATTER.format(clampZero(value));
}

/** Format a percentage (0-n) with one decimal, tolerant of null. */
export function formatPercent(value) {
  const number = Number.isFinite(value) ? value : 0;
  return `${Math.round(number * 10) / 10}%`;
}

/** Display names for representative RDS engine profiles. */
const RDS_ENGINE_LABELS = Object.freeze({
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  sqlserver: 'SQL Server',
  oracle: 'Oracle',
});

/**
 * The service registry. Each definition knows how to turn its slice of the
 * workload into one or more line items. Adding a service here automatically
 * feeds totals, subtotals, charts, and exports.
 */
export const SERVICE_DEFINITIONS = [
  {
    id: 'ec2',
    label: 'EC2 compute',
    estimate(service) {
      const quantity = clampRange(service.quantity, 0, LIMITS.ec2Quantity, 1);
      const hours = clampRange(service.hours, 0, LIMITS.ec2Hours);
      const rate = clampRange(service.rate, 0, LIMITS.ec2Rate);
      const instances = quantity === 1 ? '' : `${formatQuantity(quantity)} × `;
      return [
        {
          label: 'EC2 compute',
          detail: `${instances}${formatQuantity(hours)} h × ${formatRate(rate)}/h`,
          amount: quantity * hours * rate,
          commitmentEligible: true,
        },
      ];
    },
  },
  {
    id: 'ebs',
    label: 'EBS storage',
    estimate(service) {
      const volumes = clampRange(service.volumes, 0, LIMITS.ebsVolumes, 1);
      const sizeGb = clampRange(service.sizeGb, 0, LIMITS.ebsSizeGb);
      const rate = clampRange(service.rate, 0, LIMITS.ebsRate);
      const count = volumes === 1 ? '' : `${formatQuantity(volumes)} × `;
      return [
        {
          label: 'EBS storage',
          detail: `${count}${formatQuantity(sizeGb)} GB × ${formatRate(rate)}/GB-mo`,
          amount: volumes * sizeGb * rate,
        },
      ];
    },
  },
  {
    id: 's3',
    label: 'S3 object storage',
    estimate(service) {
      const storageGb = clampRange(service.storageGb, 0, LIMITS.s3StorageGb);
      const rate = clampRange(service.rate, 0, LIMITS.s3Rate);
      const requests = clampRange(service.requests, 0, LIMITS.s3Requests);
      const requestRate = clampRange(service.requestRate, 0, LIMITS.s3RequestRate); // per 1,000 requests
      const items = [
        {
          label: 'S3 storage',
          detail: `${formatQuantity(storageGb)} GB × ${formatRate(rate)}/GB-mo`,
          amount: storageGb * rate,
        },
      ];
      if (requests > 0) {
        items.push({
          label: 'S3 requests',
          detail: `${formatQuantity(requests)} req × ${formatRate(requestRate)}/1k`,
          amount: (requests / 1000) * requestRate,
        });
      }
      return items;
    },
  },
  {
    id: 'rds',
    label: 'RDS database',
    estimate(service) {
      const quantity = clampRange(service.quantity, 0, LIMITS.rdsQuantity, 1);
      const hours = clampRange(service.hours, 0, LIMITS.rdsHours);
      const instanceRate = clampRange(service.instanceRate, 0, LIMITS.rdsInstanceRate);
      const storageGb = clampRange(service.storageGb, 0, LIMITS.rdsStorageGb);
      const storageRate = clampRange(service.storageRate, 0, LIMITS.rdsStorageRate);
      const engine = RDS_ENGINE_LABELS[service.engine] ?? 'Database';
      const count = quantity === 1 ? '' : `${formatQuantity(quantity)} × `;
      const items = [
        {
          label: 'RDS instances',
          detail: `${engine} · ${count}${formatQuantity(hours)} h × ${formatRate(instanceRate)}/h`,
          amount: quantity * hours * instanceRate,
          commitmentEligible: true,
        },
      ];
      if (storageGb > 0) {
        items.push({
          label: 'RDS storage',
          detail: `${formatQuantity(storageGb)} GB × ${formatRate(storageRate)}/GB-mo`,
          amount: storageGb * storageRate,
        });
      }
      return items;
    },
  },
  {
    id: 'dataTransfer',
    label: 'Data transfer',
    estimate(service) {
      const outboundGb = clampRange(service.outboundGb, 0, LIMITS.dataTransferGb);
      const rate = clampRange(service.rate, 0, LIMITS.dataTransferRate);
      return [
        {
          label: 'Outbound transfer',
          detail: `${formatQuantity(outboundGb)} GB × ${formatRate(rate)}/GB`,
          amount: outboundGb * rate,
        },
      ];
    },
  },
  {
    id: 'additional',
    label: 'Other AWS services',
    estimate(service) {
      const amount = clampRange(service.monthlyCost, 0, LIMITS.additionalMonthlyCost);
      return [
        {
          label: service.label || 'Other AWS services',
          detail: 'Manually entered monthly allowance',
          amount,
        },
      ];
    },
  },
];

const SERVICE_LABELS = Object.freeze(
  Object.fromEntries(SERVICE_DEFINITIONS.map((definition) => [definition.id, definition.label])),
);

export const CONTINGENCY_SERVICE_ID = 'contingency';
export const CONTINGENCY_SERVICE_LABEL = 'Contingency buffer';

/** Human-readable label for a service id, safe for unknown ids. */
export function serviceLabel(id) {
  return SERVICE_LABELS[id] ?? id;
}

/**
 * Produce a normalized estimate from a workload.
 * The returned object is plain data suitable for rendering, exporting, and
 * comparison. It never throws for malformed input.
 */
export function estimateWorkload(input) {
  const workload = normalizeWorkload(input);
  const lineItems = [];
  const serviceSubtotals = {};
  const services = [];

  for (const definition of SERVICE_DEFINITIONS) {
    const service = workload.services[definition.id];
    const enabled = Boolean(service && service.enabled);
    let subtotal = 0;
    let grossSubtotal = 0;
    let serviceCommitmentSavings = 0;
    const commitment = getCommitmentAssumption(workload, definition.id);

    if (enabled) {
      const items = definition.estimate(service);
      for (const item of items) {
        const adjustment = applyCommitment(
          clampZero(item.amount),
          item.commitmentEligible ? commitment : null,
        );
        subtotal += adjustment.netAmount;
        grossSubtotal += adjustment.grossAmount;
        serviceCommitmentSavings += adjustment.commitmentSavings;
        lineItems.push({
          service: definition.id,
          serviceLabel: definition.label,
          label: item.label,
          detail: adjustment.commitmentSavings > 0
            ? `${item.detail} (net of ${formatPercent(adjustment.effectiveDiscountPercent)} blended commitment discount)`
            : item.detail,
          amount: adjustment.netAmount,
          grossAmount: adjustment.grossAmount,
          commitmentSavings: adjustment.commitmentSavings,
        });
      }
      serviceSubtotals[definition.id] = subtotal;
    }

    services.push({
      id: definition.id,
      label: definition.label,
      amount: subtotal,
      grossAmount: grossSubtotal,
      commitmentSavings: serviceCommitmentSavings,
      enabled,
    });
  }

  const baseTotal = services.reduce((sum, service) => sum + service.amount, 0);
  const grossBaseTotal = services.reduce((sum, service) => sum + service.grossAmount, 0);
  const directCommitmentSavings = services.reduce((sum, service) => sum + service.commitmentSavings, 0);
  const contingencyPercent = clampRange(
    workload.planning.contingencyPercent,
    0,
    LIMITS.contingencyPercent,
  );
  const contingencyAmount = baseTotal * (contingencyPercent / 100);
  const grossContingencyAmount = grossBaseTotal * (contingencyPercent / 100);
  if (contingencyAmount > 0) {
    lineItems.push({
      service: CONTINGENCY_SERVICE_ID,
      serviceLabel: CONTINGENCY_SERVICE_LABEL,
      label: CONTINGENCY_SERVICE_LABEL,
      detail: `${formatPercent(contingencyPercent)} of modeled monthly costs`,
      amount: contingencyAmount,
      grossAmount: grossContingencyAmount,
      commitmentSavings: grossContingencyAmount - contingencyAmount,
    });
    serviceSubtotals[CONTINGENCY_SERVICE_ID] = contingencyAmount;
    services.push({
      id: CONTINGENCY_SERVICE_ID,
      label: CONTINGENCY_SERVICE_LABEL,
      amount: contingencyAmount,
      grossAmount: grossContingencyAmount,
      commitmentSavings: grossContingencyAmount - contingencyAmount,
      enabled: true,
    });
  }
  const total = baseTotal + contingencyAmount;
  const grossTotal = grossBaseTotal + grossContingencyAmount;
  const budget = clampZero(workload.budget);
  const remaining = budget - total;
  const overage = Math.max(0, total - budget);
  const overBudget = budget > 0 && total > budget;
  const budgetUsedPercent = budget > 0 ? (total / budget) * 100 : null;

  return {
    region: workload.region,
    currency: 'USD',
    lineItems,
    serviceSubtotals,
    services,
    baseTotal,
    grossBaseTotal,
    contingencyPercent,
    contingencyAmount,
    grossContingencyAmount,
    directCommitmentSavings,
    commitmentSavings: grossTotal - total,
    grossTotal,
    total,
    annualTotal: total * 12,
    budget,
    budgetUsedPercent,
    remaining,
    overage,
    overBudget,
    budgetStatus: classifyBudget(budget, budgetUsedPercent),
  };
}

/**
 * Budget health thresholds (percent of budget used).
 * healthy < 75 <= watch < 90 <= risk <= 100 < over.
 */
export const BUDGET_THRESHOLDS = Object.freeze({ watch: 75, risk: 90, over: 100 });

function classifyBudget(budget, percent) {
  if (budget <= 0 || percent === null) {
    return 'no-budget';
  }
  if (percent > BUDGET_THRESHOLDS.over) {
    return 'over';
  }
  if (percent >= BUDGET_THRESHOLDS.risk) {
    return 'risk';
  }
  if (percent >= BUDGET_THRESHOLDS.watch) {
    return 'watch';
  }
  return 'healthy';
}

const BUDGET_STATE_LABELS = Object.freeze({
  'no-budget': 'No budget set',
  healthy: 'Healthy',
  watch: 'Watch',
  risk: 'At risk',
  over: 'Over budget',
});

/** Short label for a budget status, safe for text-only (non-colour) signalling. */
export function budgetStateLabel(status) {
  return BUDGET_STATE_LABELS[status] ?? status;
}

/** Plain-language budget summary derived from an estimate. */
export function getBudgetMessage(estimate) {
  if (estimate.budgetStatus === 'no-budget') {
    return 'Add a monthly budget to track budget health.';
  }

  const percent = formatPercent(estimate.budgetUsedPercent);

  if (estimate.budgetStatus === 'over') {
    return `Over budget by ${formatUsd(estimate.overage)} (${percent} of budget).`;
  }

  return `Using ${percent} of budget, ${formatUsd(estimate.remaining)} remaining.`;
}
