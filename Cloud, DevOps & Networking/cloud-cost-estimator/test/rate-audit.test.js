import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRateAudit } from '../src/rate-audit.js';
import { createDefaultWorkload } from '../src/state.js';

describe('buildRateAudit', () => {
  it('lists enabled catalogue assumptions without calling them overrides', () => {
    const audit = buildRateAudit(createDefaultWorkload());
    assert.equal(audit.entries.length, 2);
    assert.equal(audit.overrideCount, 0);
    assert.ok(audit.entries.every((entry) => entry.overridden === false));
  });

  it('identifies only enabled custom rates with signed differences', () => {
    const workload = createDefaultWorkload();
    workload.services.ec2.rate = 0.02;
    workload.services.s3.enabled = true;
    workload.services.s3.requestRate = 0.0006;
    const audit = buildRateAudit(workload);
    assert.equal(audit.overrideCount, 2);
    assert.equal(audit.overrides[0].id, 'ec2-rate');
    assert.equal(Number(audit.overrides[0].difference.toFixed(4)), 0.0096);
    assert.equal(audit.overrides[1].id, 's3-requestRate');
    assert.ok(audit.overrides[1].differencePercent > 0);
  });

  it('is defensive with malformed inputs', () => {
    const audit = buildRateAudit({ services: { ec2: { enabled: false }, ebs: { enabled: false } } });
    assert.equal(audit.overrideCount, 0);
    assert.deepEqual(audit.entries, []);
  });
});
