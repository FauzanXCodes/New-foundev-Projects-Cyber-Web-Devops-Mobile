import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countEnabledServices,
  createDefaultWorkload,
  LIMITS,
  normalizeWorkload,
  updateService,
  WORKLOAD_VERSION,
} from '../src/state.js';

describe('createDefaultWorkload', () => {
  it('builds a versioned workload with EC2 and EBS enabled', () => {
    const workload = createDefaultWorkload();

    assert.equal(workload.version, WORKLOAD_VERSION);
    assert.equal(workload.services.ec2.enabled, true);
    assert.equal(workload.services.ebs.enabled, true);
    assert.deepEqual(workload.optimization, {
      ec2CoveragePercent: 0,
      ec2DiscountPercent: 0,
      rdsCoveragePercent: 0,
      rdsDiscountPercent: 0,
    });
    assert.equal(typeof workload.region, 'string');
    assert.ok(workload.budget > 0);
    assert.deepEqual(workload.planning, {
      horizonMonths: 12,
      monthlyGrowthPercent: 0,
      contingencyPercent: 0,
      rateVariancePercent: 0,
    });
    assert.deepEqual(workload.metadata, { owner: '', costCenter: '', notes: '' });
  });
});

describe('normalizeWorkload', () => {
  it('fills missing fields from defaults', () => {
    const workload = normalizeWorkload({});

    assert.equal(workload.services.ec2.instanceType, createDefaultWorkload().services.ec2.instanceType);
    assert.equal(workload.version, WORKLOAD_VERSION);
    assert.deepEqual(workload.planning, createDefaultWorkload().planning);
    assert.deepEqual(workload.metadata, createDefaultWorkload().metadata);
  });

  it('never throws for null, undefined, or non-objects', () => {
    assert.doesNotThrow(() => normalizeWorkload(null));
    assert.doesNotThrow(() => normalizeWorkload(undefined));
    assert.doesNotThrow(() => normalizeWorkload(42));
    assert.doesNotThrow(() => normalizeWorkload('text'));
  });

  it('clamps numeric fields and coerces strings', () => {
    const workload = normalizeWorkload({
      budget: '-3',
      services: {
        ec2: { hours: '9999', rate: '0.02' },
        ebs: { sizeGb: -50 },
      },
    });

    assert.equal(workload.budget, 0);
    assert.equal(workload.services.ec2.hours, 744);
    assert.equal(workload.services.ec2.rate, 0.02);
    assert.equal(workload.services.ebs.sizeGb, 0);
  });

  it('coerces EC2 quantity to a bounded integer with a minimum of one', () => {
    assert.equal(normalizeWorkload({ services: { ec2: { quantity: '4.6' } } }).services.ec2.quantity, 5);
    assert.equal(normalizeWorkload({ services: { ec2: { quantity: 0 } } }).services.ec2.quantity, 1);
    assert.equal(normalizeWorkload({ services: { ec2: { quantity: -3 } } }).services.ec2.quantity, 1);
    assert.equal(normalizeWorkload({ services: { ec2: { quantity: 999999 } } }).services.ec2.quantity, 1000);
  });

  it('caps every numeric field and canonicalizes unsupported identifiers', () => {
    const workload = normalizeWorkload({
      region: 'not-a-region',
      budget: LIMITS.budget + 1,
      services: {
        ec2: {
          instanceType: 'not-an-instance',
          quantity: LIMITS.ec2Quantity + 1,
          hours: LIMITS.ec2Hours + 1,
          rate: LIMITS.ec2Rate + 1,
        },
        ebs: {
          volumeType: 'not-a-volume',
          volumes: LIMITS.ebsVolumes + 1,
          sizeGb: LIMITS.ebsSizeGb + 1,
          rate: LIMITS.ebsRate + 1,
        },
        s3: {
          storageClass: 'not-a-class',
          storageGb: LIMITS.s3StorageGb + 1,
          rate: LIMITS.s3Rate + 1,
          requests: LIMITS.s3Requests + 1,
          requestRate: LIMITS.s3RequestRate + 1,
        },
        rds: {
          engine: 'not-an-engine',
          instanceClass: 'not-a-class',
          quantity: LIMITS.rdsQuantity + 1,
          hours: LIMITS.rdsHours + 1,
          instanceRate: LIMITS.rdsInstanceRate + 1,
          storageGb: LIMITS.rdsStorageGb + 1,
          storageRate: LIMITS.rdsStorageRate + 1,
        },
        dataTransfer: { outboundGb: LIMITS.dataTransferGb + 1, rate: LIMITS.dataTransferRate + 1 },
      },
    });

    assert.equal(workload.region, 'us-east-1');
    assert.equal(workload.budget, LIMITS.budget);
    assert.deepEqual(
      workload.services.ec2,
      {
        ...workload.services.ec2,
        instanceType: 't3.micro',
        quantity: LIMITS.ec2Quantity,
        hours: LIMITS.ec2Hours,
        rate: LIMITS.ec2Rate,
      },
    );
    assert.deepEqual(
      workload.services.ebs,
      {
        ...workload.services.ebs,
        volumeType: 'gp3',
        volumes: LIMITS.ebsVolumes,
        sizeGb: LIMITS.ebsSizeGb,
        rate: LIMITS.ebsRate,
      },
    );
    assert.deepEqual(
      workload.services.s3,
      {
        ...workload.services.s3,
        storageClass: 'standard',
        storageGb: LIMITS.s3StorageGb,
        rate: LIMITS.s3Rate,
        requests: LIMITS.s3Requests,
        requestRate: LIMITS.s3RequestRate,
      },
    );
    assert.deepEqual(
      workload.services.rds,
      {
        ...workload.services.rds,
        engine: 'postgres',
        instanceClass: 'db.t3.micro',
        quantity: LIMITS.rdsQuantity,
        hours: LIMITS.rdsHours,
        instanceRate: LIMITS.rdsInstanceRate,
        storageGb: LIMITS.rdsStorageGb,
        storageRate: LIMITS.rdsStorageRate,
      },
    );
    assert.deepEqual(workload.services.dataTransfer, {
      ...workload.services.dataTransfer,
      outboundGb: LIMITS.dataTransferGb,
      rate: LIMITS.dataTransferRate,
    });
  });

  it('respects an explicit disabled flag but defaults to enabled', () => {
    const workload = normalizeWorkload({ services: { ec2: { enabled: false }, ebs: {} } });

    assert.equal(workload.services.ec2.enabled, false);
    assert.equal(workload.services.ebs.enabled, true);
  });

  it('normalizes planning assumptions and portable estimate context', () => {
    const workload = normalizeWorkload({
      planning: {
        horizonMonths: '18.7',
        monthlyGrowthPercent: '2.5',
        contingencyPercent: '8',
        rateVariancePercent: '6',
      },
      metadata: {
        owner: '  Platform   team ',
        costCenter: ' FIN-042 ',
        notes: '  Scope includes\nnon-production storage. ',
      },
    });

    assert.deepEqual(workload.planning, {
      horizonMonths: 19,
      monthlyGrowthPercent: 2.5,
      contingencyPercent: 8,
      rateVariancePercent: 6,
    });
    assert.deepEqual(workload.metadata, {
      owner: 'Platform team',
      costCenter: 'FIN-042',
      notes: 'Scope includes non-production storage.',
    });
  });

  it('clamps planning values and drops malformed metadata safely', () => {
    const workload = normalizeWorkload({
      planning: {
        horizonMonths: LIMITS.planningHorizonMonths + 1,
        monthlyGrowthPercent: -(LIMITS.monthlyGrowthPercent + 1),
        contingencyPercent: LIMITS.contingencyPercent + 1,
      },
      metadata: {
        owner: 'o'.repeat(LIMITS.metadataOwnerLength + 5),
        costCenter: 42,
        notes: null,
      },
    });

    assert.equal(workload.planning.horizonMonths, LIMITS.planningHorizonMonths);
    assert.equal(workload.planning.monthlyGrowthPercent, -LIMITS.monthlyGrowthPercent);
    assert.equal(workload.planning.contingencyPercent, LIMITS.contingencyPercent);
    assert.equal(workload.metadata.owner.length, LIMITS.metadataOwnerLength);
    assert.equal(workload.metadata.costCenter, '');
    assert.equal(workload.metadata.notes, '');
  });

  it('retains a bounded monthly decline assumption', () => {
    const workload = normalizeWorkload({ planning: { monthlyGrowthPercent: '-4.5' } });

    assert.equal(workload.planning.monthlyGrowthPercent, -4.5);
  });

  it('normalizes bounded commitment and rate-risk assumptions', () => {
    const workload = normalizeWorkload({
      planning: { rateVariancePercent: 999 },
      optimization: {
        ec2CoveragePercent: 150,
        ec2DiscountPercent: 95,
        rdsCoveragePercent: -4,
        rdsDiscountPercent: '20',
      },
    });

    assert.equal(workload.planning.rateVariancePercent, LIMITS.rateVariancePercent);
    assert.deepEqual(workload.optimization, {
      ec2CoveragePercent: 100,
      ec2DiscountPercent: 80,
      rdsCoveragePercent: 0,
      rdsDiscountPercent: 20,
    });
  });
});

describe('updateService', () => {
  it('patches a single service without disturbing others', () => {
    const workload = updateService(createDefaultWorkload(), 'ec2', { hours: 100 });

    assert.equal(workload.services.ec2.hours, 100);
    assert.equal(workload.services.ebs.enabled, true);
  });

  it('adds S3 to the model, disabled by default', () => {
    const workload = normalizeWorkload({});
    assert.equal(workload.services.s3.enabled, false);
    assert.equal(typeof workload.services.s3.storageGb, 'number');
  });

  it('ignores unknown service ids', () => {
    const before = createDefaultWorkload();
    const after = updateService(before, 'unknown', { foo: 1 });

    assert.deepEqual(after.services, before.services);
  });
});

describe('countEnabledServices', () => {
  it('counts only enabled services', () => {
    assert.equal(countEnabledServices(createDefaultWorkload()), 2);
    assert.equal(
      countEnabledServices({ services: { ec2: { enabled: false }, ebs: { enabled: false } } }),
      0,
    );
  });
});
