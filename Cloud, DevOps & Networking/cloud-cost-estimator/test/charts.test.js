import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateWorkload } from '../src/calculator.js';
import { breakdownData, donutSegments } from '../src/charts.js';

function workload(services) {
  return { budget: 100, services };
}

describe('breakdownData', () => {
  it('returns enabled non-zero services with shares that sum to 1', () => {
    const estimate = estimateWorkload(
      workload({
        ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 100, rate: 1 }, // 100
        ebs: { enabled: true, volumeType: 'gp3', volumes: 1, sizeGb: 100, rate: 1 }, // 100
      }),
    );
    const data = breakdownData(estimate);

    assert.equal(data.length, 2);
    const shareSum = data.reduce((sum, slice) => sum + slice.share, 0);
    assert.ok(Math.abs(shareSum - 1) < 1e-9);
  });

  it('is sorted largest-first and excludes disabled or zero services', () => {
    const estimate = estimateWorkload(
      workload({
        ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 10, rate: 1 }, // 10
        ebs: { enabled: true, volumeType: 'gp3', volumes: 1, sizeGb: 100, rate: 1 }, // 100
      }),
    );
    const data = breakdownData(estimate);

    assert.deepEqual(data.map((slice) => slice.id), ['ebs', 'ec2']);
    assert.ok(data.every((slice) => slice.amount > 0));
  });

  it('returns an empty array for a zero-cost estimate', () => {
    const estimate = estimateWorkload(workload({ ec2: { enabled: false }, ebs: { enabled: false } }));
    assert.deepEqual(breakdownData(estimate), []);
  });

  it('assigns a colour to every slice', () => {
    const estimate = estimateWorkload(
      workload({ ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 100, rate: 1 } }),
    );
    assert.ok(breakdownData(estimate).every((slice) => /^#/.test(slice.color)));
  });

  it('keeps a contingency buffer visually distinct in the breakdown', () => {
    const estimate = estimateWorkload({
      planning: { contingencyPercent: 10 },
      services: { ec2: { enabled: true, quantity: 1, hours: 100, rate: 1 }, ebs: { enabled: false } },
    });
    const buffer = breakdownData(estimate).find((slice) => slice.id === 'contingency');

    assert.equal(buffer?.label, 'Contingency buffer');
    assert.notEqual(buffer?.color, '#94a3b8');
  });
});

describe('donutSegments', () => {
  it('accumulates offsets and keeps dash + gap at 100 per slice', () => {
    const estimate = estimateWorkload(
      workload({
        ec2: { enabled: true, instanceType: 't3.micro', quantity: 1, hours: 75, rate: 1 }, // 75
        ebs: { enabled: true, volumeType: 'gp3', volumes: 1, sizeGb: 25, rate: 1 }, // 25
      }),
    );
    const segments = donutSegments(breakdownData(estimate));

    assert.equal(segments[0].offset, 0);
    assert.ok(Math.abs(segments[0].dash - 75) < 1e-9);
    segments.forEach((segment) => {
      assert.ok(Math.abs(segment.dash + segment.gap - 100) < 1e-9);
    });
    // second slice starts where the first ends
    assert.ok(Math.abs(segments[1].offset - -75) < 1e-9);
  });
});
