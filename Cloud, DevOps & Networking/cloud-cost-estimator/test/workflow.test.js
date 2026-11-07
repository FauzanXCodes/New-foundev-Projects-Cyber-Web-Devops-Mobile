import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateWorkload, serviceLabel } from '../src/calculator.js';
import {
  createDefaultWorkload,
  countEnabledServices,
  normalizeWorkload,
  presetWorkload,
  setBudget,
} from '../src/state.js';
import { compareEstimates, comparePlanningPolicies } from '../src/compare.js';
import { toForecastCsv, toJson, toSensitivityCsv, parseImport } from '../src/export.js';
import { buildForecast, compareForecasts } from '../src/forecast.js';
import { buildDecisionReadiness } from '../src/readiness.js';
import { buildRateSensitivity } from '../src/risk.js';
import { encodeState, decodeState } from '../src/share.js';
import { saveScenario, loadScenarios } from '../src/scenarios.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

// A fully populated workload with every service enabled and known numbers.
function fullWorkload() {
  return normalizeWorkload({
    region: 'us-east-1',
    budget: 200,
    services: {
      ec2: { enabled: true, instanceType: 't3.medium', quantity: 2, hours: 730, rate: 0.0416 },
      ebs: { enabled: true, volumeType: 'gp3', volumes: 2, sizeGb: 50, rate: 0.08 },
      s3: { enabled: true, storageClass: 'standard', storageGb: 100, rate: 0.023, requests: 1_000_000, requestRate: 0.0004 },
      rds: { enabled: true, engine: 'postgres', instanceClass: 'db.t3.small', quantity: 1, hours: 730, instanceRate: 0.034, storageGb: 50, storageRate: 0.115 },
      dataTransfer: { enabled: true, outboundGb: 200, rate: 0.09 },
      additional: { enabled: true, label: 'Monitoring allowance', monthlyCost: 8 },
    },
  });
}

describe('complete estimation workflow', () => {
  it('sums every enabled service into a consistent total', () => {
    const estimate = estimateWorkload(fullWorkload());

    const subtotalSum = Object.values(estimate.serviceSubtotals).reduce((a, b) => a + b, 0);
    assert.equal(Number(subtotalSum.toFixed(6)), Number(estimate.total.toFixed(6)));

    const lineItemSum = estimate.lineItems.reduce((a, item) => a + item.amount, 0);
    assert.equal(Number(lineItemSum.toFixed(6)), Number(estimate.total.toFixed(6)));

    // Six services -> eight line items (EC2, EBS, S3 storage+requests, RDS instance+storage, transfer, allowance).
    assert.equal(estimate.lineItems.length, 8);
    assert.equal(countEnabledServices(fullWorkload()), 6);
  });

  it('keeps budget metrics internally consistent', () => {
    const estimate = estimateWorkload(fullWorkload());
    assert.equal(estimate.annualTotal, estimate.total * 12);
    assert.equal(estimate.remaining, estimate.budget - estimate.total);
    assert.equal(estimate.overage, Math.max(0, estimate.total - estimate.budget));
    if (estimate.budget > 0) {
      assert.equal(estimate.budgetUsedPercent, (estimate.total / estimate.budget) * 100);
    }
  });

  it('labels every service and stays safe for unknown ids', () => {
    for (const id of ['ec2', 'ebs', 's3', 'rds', 'dataTransfer', 'additional']) {
      assert.equal(typeof serviceLabel(id), 'string');
      assert.ok(serviceLabel(id).length > 0);
    }
    assert.equal(serviceLabel('mystery'), 'mystery');
  });

  it('recomputes budget status when the budget changes', () => {
    const cheap = setBudget(fullWorkload(), 100000);
    assert.equal(estimateWorkload(cheap).budgetStatus, 'healthy');
    const tight = setBudget(fullWorkload(), 1);
    assert.equal(estimateWorkload(tight).budgetStatus, 'over');
  });
});

describe('cross-module round-trips preserve the estimate', () => {
  it('survives JSON export then import', () => {
    const workload = fullWorkload();
    const before = estimateWorkload(workload).total;
    const result = parseImport(toJson(workload, 'Full'));
    assert.equal(result.ok, true);
    assert.equal(estimateWorkload(result.workload).total, before);
  });

  it('survives share encode then decode', () => {
    const workload = fullWorkload();
    const before = estimateWorkload(workload).total;
    const decoded = decodeState(encodeState(workload));
    assert.equal(estimateWorkload(decoded).total, before);
  });

  it('survives a scenario save then load', () => {
    const storage = memoryStorage();
    const workload = fullWorkload();
    const before = estimateWorkload(workload).total;
    saveScenario(storage, 'Full workload', workload);
    const [scenario] = loadScenarios(storage);
    assert.equal(estimateWorkload(scenario.workload).total, before);
  });

  it('keeps planning assumptions and decision context coherent across the workflow', () => {
    const workload = normalizeWorkload({
      ...fullWorkload(),
      budget: 250,
      planning: { horizonMonths: 6, monthlyGrowthPercent: 4, contingencyPercent: 12, rateVariancePercent: 10 },
      optimization: {
        ec2CoveragePercent: 80,
        ec2DiscountPercent: 20,
        rdsCoveragePercent: 50,
        rdsDiscountPercent: 15,
      },
      metadata: { owner: 'FinOps', costCenter: 'Platform', notes: 'Plan for launch growth.' },
    });
    const imported = parseImport(toJson(workload, 'Launch plan'));
    assert.equal(imported.ok, true);
    assert.deepEqual(imported.workload.planning, workload.planning);
    assert.deepEqual(imported.workload.optimization, workload.optimization);
    assert.deepEqual(imported.workload.metadata, workload.metadata);

    const forecast = buildForecast(imported.workload);
    assert.equal(forecast.months.length, 6);
    assert.ok(forecast.finalMonthTotal > forecast.baseMonthlyTotal);
    assert.match(toForecastCsv(forecast), /Horizon total \(6 months\)/);
    assert.ok(forecast.horizonCommitmentSavings > 0);

    const sensitivity = buildRateSensitivity(imported.workload);
    assert.equal(sensitivity.base.total, estimateWorkload(imported.workload).total);
    assert.ok(sensitivity.high.total > sensitivity.base.total);
    assert.match(toSensitivityCsv(sensitivity), /Higher-rate case/);
    assert.equal(buildDecisionReadiness(imported.workload).attentionCount, 0);

    const storage = memoryStorage();
    saveScenario(storage, 'Launch plan', imported.workload, {
      tag: 'approved',
      description: 'Capacity review approved.',
    });
    const [scenario] = loadScenarios(storage);
    assert.equal(scenario.tag, 'approved');
    assert.equal(scenario.description, 'Capacity review approved.');
    assert.equal(compareForecasts(imported.workload, scenario.workload).horizonDifference, 0);
    assert.equal(comparePlanningPolicies(imported.workload, scenario.workload).changed, false);
  });
});

describe('comparison over the full workflow', () => {
  it('reports equality when comparing an estimate with itself', () => {
    const estimate = estimateWorkload(fullWorkload());
    const result = compareEstimates(estimate, estimate);
    assert.equal(result.cheaper, 'equal');
    assert.equal(result.monthlyDiff, 0);
    assert.ok(result.services.every((row) => row.diff === 0));
  });

  it('detects the cheaper of two presets', () => {
    const dev = estimateWorkload(presetWorkload('dev', 'us-east-1'));
    const heavy = estimateWorkload(presetWorkload('data-heavy', 'us-east-1'));
    const result = compareEstimates(heavy, dev); // active = heavy, other = dev
    assert.equal(result.cheaper, 'other');
    assert.ok(result.monthlyDiff < 0);
  });
});

describe('resilience across the pipeline', () => {
  it('never throws and yields a zero estimate for corrupt input', () => {
    for (const bad of [null, undefined, 'garbage', 42, [], { services: 'nope' }]) {
      assert.doesNotThrow(() => estimateWorkload(bad));
      assert.equal(estimateWorkload(bad).total, 0);
    }
  });

  it('treats a corrupt share token as absent', () => {
    assert.equal(decodeState('%%%not-base64%%%'), null);
    assert.equal(estimateWorkload(decodeState('') ?? createDefaultWorkload()).total > 0, true);
  });
});
