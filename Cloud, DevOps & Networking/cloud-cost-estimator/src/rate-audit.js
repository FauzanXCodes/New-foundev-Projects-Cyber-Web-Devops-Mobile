/**
 * Editable-rate audit helpers.
 *
 * Sample catalogue rates are convenient starting points, but a review needs
 * to know when the estimate deliberately relies on a different rate. This
 * module compares the normalized workload with its selected region catalogue;
 * it does not judge whether an override is correct or fetch live pricing.
 */

import { getRate, getScalarRate } from './pricing.js';
import { normalizeWorkload } from './state.js';

const RATE_FIELDS = Object.freeze([
  { serviceId: 'ec2', label: 'EC2 instance rate', field: 'rate', sample: (w) => getRate(w.region, 'ec2', w.services.ec2.instanceType) },
  { serviceId: 'ebs', label: 'EBS storage rate', field: 'rate', sample: (w) => getRate(w.region, 'ebs', w.services.ebs.volumeType) },
  { serviceId: 's3', label: 'S3 storage rate', field: 'rate', sample: (w) => getRate(w.region, 's3', w.services.s3.storageClass) },
  { serviceId: 's3', label: 'S3 request rate', field: 'requestRate', sample: (w) => getScalarRate(w.region, 's3RequestPer1k') },
  { serviceId: 'rds', label: 'RDS instance rate', field: 'instanceRate', sample: (w) => getRate(w.region, 'rds', w.services.rds.instanceClass) },
  { serviceId: 'rds', label: 'RDS storage rate', field: 'storageRate', sample: (w) => getScalarRate(w.region, 'rdsStorageGbMonth') },
  { serviceId: 'dataTransfer', label: 'Outbound data-transfer rate', field: 'rate', sample: (w) => getScalarRate(w.region, 'dataTransferOutGb') },
]);

function sameRate(left, right) {
  return Math.abs(left - right) < 0.0000001;
}

/** Return every enabled-rate assumption and identify intentional overrides. */
export function buildRateAudit(input) {
  const workload = normalizeWorkload(input);
  const entries = RATE_FIELDS
    .filter((definition) => workload.services[definition.serviceId].enabled)
    .map((definition) => {
      const enteredRate = workload.services[definition.serviceId][definition.field];
      const sampleRate = definition.sample(workload);
      const difference = enteredRate - sampleRate;
      const overridden = !sameRate(enteredRate, sampleRate);
      return {
        id: `${definition.serviceId}-${definition.field}`,
        label: definition.label,
        enteredRate,
        sampleRate,
        difference,
        differencePercent: sampleRate > 0 ? (difference / sampleRate) * 100 : null,
        overridden,
      };
    });
  const overrides = entries.filter((entry) => entry.overridden);
  return { entries, overrides, overrideCount: overrides.length };
}
