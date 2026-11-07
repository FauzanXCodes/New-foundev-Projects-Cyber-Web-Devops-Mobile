import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyCommitment,
  COMMITMENT_SERVICE_IDS,
  getCommitmentAssumption,
  isCommitmentEligible,
  summarizeCommitmentPolicy,
} from '../src/commitments.js';
import { createDefaultWorkload } from '../src/state.js';

describe('commitment assumptions', () => {
  it('maps EC2 and RDS coverage into an explicit blended discount', () => {
    const workload = createDefaultWorkload();
    workload.optimization.ec2CoveragePercent = 75;
    workload.optimization.ec2DiscountPercent = 20;

    assert.deepEqual(getCommitmentAssumption(workload, 'ec2'), {
      serviceId: 'ec2',
      coveragePercent: 75,
      discountPercent: 20,
      effectiveDiscountPercent: 15,
    });
  });

  it('keeps unknown services and malformed amounts safe', () => {
    assert.deepEqual(COMMITMENT_SERVICE_IDS, ['ec2', 'rds']);
    assert.equal(isCommitmentEligible('ec2'), true);
    assert.equal(isCommitmentEligible('ebs'), false);
    assert.deepEqual(getCommitmentAssumption(createDefaultWorkload(), 'ebs'), {
      serviceId: 'ebs',
      coveragePercent: 0,
      discountPercent: 0,
      effectiveDiscountPercent: 0,
    });
    assert.deepEqual(applyCommitment(-4, { effectiveDiscountPercent: 30 }), {
      grossAmount: 0,
      commitmentSavings: 0,
      netAmount: 0,
      effectiveDiscountPercent: 30,
    });
  });

  it('applies only the covered discount to an eligible gross cost', () => {
    assert.deepEqual(applyCommitment(100, { effectiveDiscountPercent: 15 }), {
      grossAmount: 100,
      commitmentSavings: 15,
      netAmount: 85,
      effectiveDiscountPercent: 15,
    });
  });

  it('makes stated commitment and rate assumptions reviewable as a policy', () => {
    const workload = createDefaultWorkload();
    workload.planning.rateVariancePercent = 12.5;
    workload.optimization.ec2CoveragePercent = 80;
    workload.optimization.ec2DiscountPercent = 25;

    const policy = summarizeCommitmentPolicy(workload);
    assert.equal(policy.rateVariancePercent, 12.5);
    assert.equal(policy.configured, true);
    assert.equal(policy.active, true);
    assert.deepEqual(policy.commitments[0], {
      serviceId: 'ec2',
      label: 'EC2',
      coveragePercent: 80,
      discountPercent: 25,
      effectiveDiscountPercent: 20,
      configured: true,
      active: true,
    });
    assert.equal(policy.commitments[1].configured, false);
  });
});
