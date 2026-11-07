import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  budgetStateLabel,
  estimateWorkload,
  formatPercent,
  formatUsd,
  formatRate,
  getBudgetMessage,
} from '../src/calculator.js';
import { createDefaultWorkload } from '../src/state.js';

// A single-service workload whose EC2 total is `hours * rate`, everything else off.
function onlyEc2(hours, rate, budget) {
  return {
    budget,
    services: {
      ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours, rate },
      ebs: { enabled: false },
    },
  };
}

function baseWorkload(overrides = {}) {
  return {
    region: 'us-east-1',
    budget: 15,
    services: {
      ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 730, rate: 0.0104 },
      ebs: { enabled: true, volumeType: 'gp3', sizeGb: 30, rate: 0.08 },
    },
    ...overrides,
  };
}

describe('estimateWorkload', () => {
  it('sums EC2 compute and EBS storage into a monthly total', () => {
    const estimate = estimateWorkload(baseWorkload());

    assert.equal(estimate.serviceSubtotals.ec2, 7.592);
    assert.equal(estimate.serviceSubtotals.ebs, 2.4);
    assert.equal(Number(estimate.total.toFixed(2)), 9.99);
    assert.equal(estimate.overBudget, false);
    assert.equal(estimate.budgetStatus, 'healthy');
  });

  it('includes a transparent contingency buffer in totals and budget health', () => {
    const estimate = estimateWorkload(
      baseWorkload({ planning: { contingencyPercent: 10 } }),
    );

    assert.equal(Number(estimate.baseTotal.toFixed(3)), 9.992);
    assert.equal(estimate.contingencyPercent, 10);
    assert.equal(Number(estimate.contingencyAmount.toFixed(4)), 0.9992);
    assert.equal(Number(estimate.total.toFixed(4)), 10.9912);
    assert.equal(estimate.serviceSubtotals.contingency, estimate.contingencyAmount);
    assert.equal(estimate.lineItems.at(-1).detail, '10% of modeled monthly costs');
  });

  it('applies commitment assumptions only to eligible compute while retaining gross and net amounts', () => {
    const workload = createDefaultWorkload();
    workload.planning.contingencyPercent = 10;
    workload.optimization.ec2CoveragePercent = 50;
    workload.optimization.ec2DiscountPercent = 20;
    const estimate = estimateWorkload(workload);
    const ec2 = estimate.lineItems.find((item) => item.service === 'ec2');
    const ebs = estimate.lineItems.find((item) => item.service === 'ebs');

    assert.equal(Number(ec2.grossAmount.toFixed(3)), 7.592);
    assert.equal(Number(ec2.commitmentSavings.toFixed(3)), 0.759);
    assert.equal(Number(ec2.amount.toFixed(3)), 6.833);
    assert.equal(ebs.commitmentSavings, 0);
    assert.equal(Number(estimate.grossBaseTotal.toFixed(3)), 9.992);
    assert.equal(Number(estimate.directCommitmentSavings.toFixed(3)), 0.759);
    assert.equal(Number(estimate.commitmentSavings.toFixed(3)), 0.835);
    assert.ok(estimate.total < estimate.grossTotal);
  });

  it('multiplies EC2 cost by instance quantity', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: true, instanceType: 't3.micro', quantity: 3, hours: 730, rate: 0.0104 },
          ebs: { enabled: false },
        },
      }),
    );

    assert.equal(Number(estimate.serviceSubtotals.ec2.toFixed(3)), 22.776);
    const detail = estimate.lineItems[0].detail;
    assert.match(detail, /3 ×/);
  });

  it('clamps EC2 quantity and runtime to safe limits', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: true, instanceType: 't3.micro', quantity: 999999, hours: 100000, rate: 0.01 },
          ebs: { enabled: false },
        },
      }),
    );

    // quantity capped at 1000, hours capped at 744
    assert.equal(estimate.serviceSubtotals.ec2, 1000 * 744 * 0.01);
  });

  it('returns structured line items for each enabled service', () => {
    const estimate = estimateWorkload(baseWorkload());
    const labels = estimate.lineItems.map((item) => item.label);

    assert.deepEqual(labels, ['EC2 compute', 'EBS storage']);
    assert.ok(estimate.lineItems.every((item) => typeof item.detail === 'string'));
    assert.ok(estimate.lineItems.every((item) => item.amount >= 0));
  });

  it('multiplies EBS cost by volume count and per-volume size', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: false },
          ebs: { enabled: true, volumeType: 'gp3', volumes: 4, sizeGb: 50, rate: 0.08 },
        },
      }),
    );

    assert.equal(estimate.serviceSubtotals.ebs, 4 * 50 * 0.08);
    assert.match(estimate.lineItems[0].detail, /4 ×/);
  });

  it('drops EBS from the estimate when it is disabled', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 730, rate: 0.0104 },
          ebs: { enabled: false, volumeType: 'gp3', volumes: 4, sizeGb: 50, rate: 0.08 },
        },
      }),
    );

    assert.equal(estimate.serviceSubtotals.ebs, undefined);
    assert.equal(estimate.lineItems.length, 1);
    assert.equal(Number(estimate.total.toFixed(3)), 7.592);
  });

  it('excludes disabled services from totals and line items', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: true, instanceType: 't3.micro', hours: 730, rate: 0.0104 },
          ebs: { enabled: false, volumeType: 'EBS gp3', sizeGb: 30, rate: 0.08 },
        },
      }),
    );

    assert.equal(estimate.serviceSubtotals.ebs, undefined);
    assert.equal(estimate.lineItems.length, 1);
    assert.equal(Number(estimate.total.toFixed(3)), 7.592);
    const ebs = estimate.services.find((service) => service.id === 'ebs');
    assert.equal(ebs.enabled, false);
    assert.equal(ebs.amount, 0);
  });

  it('flags estimates that exceed the budget', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        budget: 5,
        services: {
          ec2: { enabled: true, instanceType: 't3.medium', hours: 730, rate: 0.0418 },
          ebs: { enabled: true, volumeType: 'EBS gp3', sizeGb: 100, rate: 0.08 },
        },
      }),
    );

    assert.equal(estimate.overBudget, true);
    assert.equal(estimate.budgetStatus, 'over');
    assert.ok(estimate.remaining < 0);
    assert.match(getBudgetMessage(estimate), /Over budget/);
  });

  it('treats a zero budget as no-budget', () => {
    const estimate = estimateWorkload(baseWorkload({ budget: 0 }));

    assert.equal(estimate.budgetStatus, 'no-budget');
    assert.equal(getBudgetMessage(estimate), 'Add a monthly budget to track budget health.');
  });

  it('coerces negative, string, NaN, and infinite inputs to zero', () => {
    const estimate = estimateWorkload({
      budget: -10,
      services: {
        ec2: { enabled: true, instanceType: 't3.micro', hours: -5, rate: 'not-a-number' },
        ebs: { enabled: true, volumeType: 'EBS gp3', sizeGb: Infinity, rate: NaN },
      },
    });

    assert.equal(estimate.total, 0);
    assert.equal(estimate.budget, 0);
    assert.equal(estimate.budgetStatus, 'no-budget');
  });

  it('handles decimal quantities precisely enough for currency rounding', () => {
    const estimate = estimateWorkload(
      baseWorkload({
        services: {
          ec2: { enabled: true, instanceType: 't3.nano', hours: 12.5, rate: 0.0052 },
          ebs: { enabled: false },
        },
      }),
    );

    assert.equal(Number(estimate.total.toFixed(4)), 0.065);
  });

  it('never throws for malformed input', () => {
    assert.doesNotThrow(() => estimateWorkload(null));
    assert.doesNotThrow(() => estimateWorkload(undefined));
    assert.doesNotThrow(() => estimateWorkload('nonsense'));
    assert.equal(estimateWorkload(null).total, estimateWorkload(undefined).total);
  });
});

describe('S3 estimation', () => {
  function withS3(s3) {
    return baseWorkload({
      services: {
        ec2: { enabled: false },
        ebs: { enabled: false },
        s3: { enabled: true, storageClass: 'standard', ...s3 },
      },
    });
  }

  it('prices storage and requests separately', () => {
    const estimate = estimateWorkload(
      withS3({ storageGb: 100, rate: 0.023, requests: 1_000_000, requestRate: 0.0004 }),
    );

    assert.equal(estimate.serviceSubtotals.s3, 100 * 0.023 + (1_000_000 / 1000) * 0.0004);
    assert.deepEqual(
      estimate.lineItems.map((item) => item.label),
      ['S3 storage', 'S3 requests'],
    );
  });

  it('omits the request line when there are no requests', () => {
    const estimate = estimateWorkload(withS3({ storageGb: 50, rate: 0.023, requests: 0, requestRate: 0.0004 }));

    assert.equal(estimate.lineItems.length, 1);
    assert.equal(estimate.lineItems[0].label, 'S3 storage');
    assert.equal(estimate.serviceSubtotals.s3, 50 * 0.023);
  });

  it('is disabled by default so it does not affect the demo estimate', () => {
    const estimate = estimateWorkload(baseWorkload());
    assert.equal(estimate.serviceSubtotals.s3, undefined);
    const s3 = estimate.services.find((service) => service.id === 's3');
    assert.equal(s3.enabled, false);
  });
});

describe('RDS estimation', () => {
  function withRds(rds) {
    return baseWorkload({
      services: {
        ec2: { enabled: false },
        ebs: { enabled: false },
        rds: { enabled: true, engine: 'postgres', instanceClass: 'db.t3.micro', ...rds },
      },
    });
  }

  it('prices instance runtime and storage', () => {
    const estimate = estimateWorkload(
      withRds({ quantity: 1, hours: 730, instanceRate: 0.017, storageGb: 20, storageRate: 0.115 }),
    );

    assert.equal(estimate.serviceSubtotals.rds, 1 * 730 * 0.017 + 20 * 0.115);
    assert.deepEqual(
      estimate.lineItems.map((item) => item.label),
      ['RDS instances', 'RDS storage'],
    );
    assert.match(estimate.lineItems[0].detail, /PostgreSQL/);
  });

  it('multiplies instance cost by quantity and omits zero storage', () => {
    const estimate = estimateWorkload(
      withRds({ quantity: 2, hours: 730, instanceRate: 0.017, storageGb: 0, storageRate: 0.115 }),
    );

    assert.equal(estimate.serviceSubtotals.rds, 2 * 730 * 0.017);
    assert.equal(estimate.lineItems.length, 1);
    assert.equal(estimate.lineItems[0].label, 'RDS instances');
  });

  it('is disabled by default', () => {
    const estimate = estimateWorkload(baseWorkload());
    assert.equal(estimate.serviceSubtotals.rds, undefined);
  });
});

describe('data transfer estimation', () => {
  function withTransfer(dataTransfer) {
    return baseWorkload({
      services: {
        ec2: { enabled: false },
        ebs: { enabled: false },
        dataTransfer: { enabled: true, ...dataTransfer },
      },
    });
  }

  it('prices outbound GB by the per-GB rate', () => {
    const estimate = estimateWorkload(withTransfer({ outboundGb: 250, rate: 0.09 }));
    assert.equal(estimate.serviceSubtotals.dataTransfer, 250 * 0.09);
    assert.equal(estimate.lineItems[0].label, 'Outbound transfer');
  });

  it('reports zero cost for zero outbound transfer', () => {
    const estimate = estimateWorkload(withTransfer({ outboundGb: 0, rate: 0.09 }));
    assert.equal(estimate.serviceSubtotals.dataTransfer, 0);
    assert.equal(estimate.lineItems[0].amount, 0);
  });

  it('is disabled by default', () => {
    const estimate = estimateWorkload(baseWorkload());
    assert.equal(estimate.serviceSubtotals.dataTransfer, undefined);
  });
});

describe('budget health metrics', () => {
  it('computes annualized total, percent used, remaining, and overage', () => {
    const estimate = estimateWorkload(onlyEc2(50, 1, 100));

    assert.equal(estimate.total, 50);
    assert.equal(estimate.annualTotal, 600);
    assert.equal(estimate.budgetUsedPercent, 50);
    assert.equal(estimate.remaining, 50);
    assert.equal(estimate.overage, 0);
  });

  it('classifies healthy / watch / risk / over at the right boundaries', () => {
    assert.equal(estimateWorkload(onlyEc2(50, 1, 100)).budgetStatus, 'healthy');
    assert.equal(estimateWorkload(onlyEc2(74.9, 1, 100)).budgetStatus, 'healthy');
    assert.equal(estimateWorkload(onlyEc2(75, 1, 100)).budgetStatus, 'watch');
    assert.equal(estimateWorkload(onlyEc2(89.9, 1, 100)).budgetStatus, 'watch');
    assert.equal(estimateWorkload(onlyEc2(90, 1, 100)).budgetStatus, 'risk');
    assert.equal(estimateWorkload(onlyEc2(100, 1, 100)).budgetStatus, 'risk');
    assert.equal(estimateWorkload(onlyEc2(100.1, 1, 100)).budgetStatus, 'over');
  });

  it('reports overage and null percent appropriately', () => {
    const over = estimateWorkload(onlyEc2(120, 1, 100));
    assert.equal(over.overage, 20);
    assert.equal(over.remaining, -20);

    const noBudget = estimateWorkload(onlyEc2(50, 1, 0));
    assert.equal(noBudget.budgetUsedPercent, null);
    assert.equal(noBudget.budgetStatus, 'no-budget');
  });

  it('produces human-friendly status labels and messages', () => {
    assert.equal(budgetStateLabel('over'), 'Over budget');
    assert.equal(budgetStateLabel('healthy'), 'Healthy');
    assert.match(getBudgetMessage(estimateWorkload(onlyEc2(120, 1, 100))), /Over budget by/);
    assert.match(getBudgetMessage(estimateWorkload(onlyEc2(50, 1, 100))), /Using .* remaining/);
  });
});

describe('formatPercent', () => {
  it('rounds to one decimal and tolerates null', () => {
    assert.equal(formatPercent(75), '75%');
    assert.equal(formatPercent(66.666), '66.7%');
    assert.equal(formatPercent(null), '0%');
  });
});

describe('formatting', () => {
  it('formats currency to two decimals', () => {
    assert.equal(formatUsd(9.992), '$9.99');
    assert.equal(formatUsd(0), '$0.00');
    assert.equal(formatUsd(-5), '$0.00');
  });

  it('formats fine-grained rates to four decimals', () => {
    assert.equal(formatRate(0.0104), '$0.0104');
  });
});
