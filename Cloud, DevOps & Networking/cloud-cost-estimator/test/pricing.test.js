import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_REGION,
  DEFAULTS,
  getRate,
  getRegion,
  getScalarRate,
  getServiceOptions,
  listRegions,
} from '../src/pricing.js';

describe('region catalogue', () => {
  it('exposes at least the four required regions', () => {
    const ids = listRegions().map((region) => region.id);
    for (const required of ['us-east-1', 'us-west-2', 'ap-southeast-2', 'eu-west-1']) {
      assert.ok(ids.includes(required), `missing region ${required}`);
    }
  });

  it('labels every region and bills in USD', () => {
    for (const { id } of listRegions()) {
      const region = getRegion(id);
      assert.equal(typeof region.label, 'string');
      assert.ok(region.label.length > 0);
      assert.equal(region.currency, 'USD');
    }
  });

  it('falls back to the default region for unknown ids', () => {
    assert.equal(getRegion('made-up').id, DEFAULT_REGION);
    assert.equal(getRegion(undefined).id, DEFAULT_REGION);
    assert.equal(getRegion(null).id, DEFAULT_REGION);
  });
});

describe('rate lookup', () => {
  it('returns a numeric rate for a known service option', () => {
    const rate = getRate('us-east-1', 'ec2', 't3.micro');
    assert.equal(rate, 0.0104);
  });

  it('returns undefined for unknown options or services', () => {
    assert.equal(getRate('us-east-1', 'ec2', 'does-not-exist'), undefined);
    assert.equal(getRate('us-east-1', 'nope', 't3.micro'), undefined);
  });

  it('returns an empty array for unknown service keys', () => {
    assert.deepEqual(getServiceOptions('us-east-1', 'nope'), []);
    assert.ok(getServiceOptions('us-east-1', 'ec2').length > 0);
  });

  it('scales rates up for more expensive regions', () => {
    const virginia = getRate('us-east-1', 'ec2', 't3.micro');
    const sydney = getRate('ap-southeast-2', 'ec2', 't3.micro');
    assert.ok(sydney > virginia, 'Sydney should be pricier than N. Virginia in the sample model');
  });

  it('exposes region scalar rates safely', () => {
    assert.ok(getScalarRate('us-east-1', 'dataTransferOutGb') > 0);
    assert.equal(getScalarRate('us-east-1', 'missing'), 0);
  });
});

describe('defaults', () => {
  it('keeps the demo default estimate wired to catalogue rates', () => {
    assert.equal(DEFAULTS.region, DEFAULT_REGION);
    assert.equal(DEFAULTS.ec2Rate, getRate(DEFAULT_REGION, 'ec2', DEFAULTS.ec2Instance));
    assert.equal(DEFAULTS.storageRate, getRate(DEFAULT_REGION, 'ebs', DEFAULTS.storageType));
  });
});
