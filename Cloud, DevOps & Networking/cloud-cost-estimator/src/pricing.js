/**
 * Region-aware sample pricing catalogue.
 *
 * IMPORTANT: every rate here is a *curated sample assumption* for learning and
 * portfolio demonstration. Rates are NOT fetched live and are NOT an official
 * AWS quote. Real bills vary by region, operating system, usage model, taxes,
 * free-tier credits, networking, monitoring, commitment discounts, and more.
 *
 * To stay honest and maintainable, the catalogue is built from one reference
 * table (roughly US East on-demand Linux) scaled by a transparent per-region
 * factor rather than fabricating precise, unverifiable numbers per region.
 */

/** Reference on-demand rates (approx. us-east-1, Linux). Sample values. */
const EC2_BASE = [
  { id: 't3.nano', label: 't3.nano', spec: '2 vCPU · 0.5 GiB', rate: 0.0052 },
  { id: 't3.micro', label: 't3.micro', spec: '2 vCPU · 1 GiB', rate: 0.0104 },
  { id: 't3.small', label: 't3.small', spec: '2 vCPU · 2 GiB', rate: 0.0208 },
  { id: 't3.medium', label: 't3.medium', spec: '2 vCPU · 4 GiB', rate: 0.0416 },
  { id: 't3.large', label: 't3.large', spec: '2 vCPU · 8 GiB', rate: 0.0832 },
  { id: 'm5.large', label: 'm5.large', spec: '2 vCPU · 8 GiB', rate: 0.096 },
  { id: 'c5.large', label: 'c5.large', spec: '2 vCPU · 4 GiB', rate: 0.085 },
];

const EBS_BASE = [
  { id: 'gp3', label: 'gp3 · General Purpose SSD', rate: 0.08 },
  { id: 'gp2', label: 'gp2 · General Purpose SSD', rate: 0.1 },
  { id: 'io2', label: 'io2 · Provisioned IOPS SSD', rate: 0.125 },
  { id: 'st1', label: 'st1 · Throughput HDD', rate: 0.045 },
  { id: 'sc1', label: 'sc1 · Cold HDD', rate: 0.015 },
];

const S3_BASE = [
  { id: 'standard', label: 'S3 Standard', rate: 0.023 },
  { id: 'standard-ia', label: 'S3 Standard-IA', rate: 0.0125 },
  { id: 'onezone-ia', label: 'S3 One Zone-IA', rate: 0.01 },
  { id: 'glacier-ir', label: 'S3 Glacier Instant Retrieval', rate: 0.004 },
];

const RDS_BASE = [
  { id: 'db.t3.micro', label: 'db.t3.micro', spec: '2 vCPU · 1 GiB', rate: 0.017 },
  { id: 'db.t3.small', label: 'db.t3.small', spec: '2 vCPU · 2 GiB', rate: 0.034 },
  { id: 'db.t3.medium', label: 'db.t3.medium', spec: '2 vCPU · 4 GiB', rate: 0.068 },
  { id: 'db.m5.large', label: 'db.m5.large', spec: '2 vCPU · 8 GiB', rate: 0.171 },
];

/** Reference scalar rates (per unit) at factor 1.0. Sample values. */
const SCALAR_BASE = Object.freeze({
  s3RequestPer1k: 0.0004, // blended GET/PUT sample, per 1,000 requests
  rdsStorageGbMonth: 0.115, // gp2 database storage
  dataTransferOutGb: 0.09, // internet egress after free tier (flat sample)
});

/** Per-region metadata and the multiplier applied to the reference table. */
const REGION_META = [
  { id: 'us-east-1', label: 'US East (N. Virginia)', location: 'Northern Virginia, USA', factor: 1.0 },
  { id: 'us-west-2', label: 'US West (Oregon)', location: 'Oregon, USA', factor: 1.0 },
  { id: 'ap-southeast-2', label: 'Asia Pacific (Sydney)', location: 'Sydney, Australia', factor: 1.27 },
  { id: 'eu-west-1', label: 'Europe (Ireland)', location: 'Dublin, Ireland', factor: 1.08 },
];

export const DEFAULT_REGION = 'us-east-1';

function round4(value) {
  return Math.round(value * 1e4) / 1e4;
}

function scaleOptions(base, factor) {
  return base.map((option) => ({ ...option, rate: round4(option.rate * factor) }));
}

/** The frozen catalogue: region id -> region pricing object. */
export const REGIONS = Object.freeze(
  Object.fromEntries(
    REGION_META.map((meta) => [
      meta.id,
      Object.freeze({
        id: meta.id,
        label: meta.label,
        location: meta.location,
        currency: 'USD',
        factor: meta.factor,
        ec2: Object.freeze(scaleOptions(EC2_BASE, meta.factor)),
        ebs: Object.freeze(scaleOptions(EBS_BASE, meta.factor)),
        s3: Object.freeze(scaleOptions(S3_BASE, meta.factor)),
        rds: Object.freeze(scaleOptions(RDS_BASE, meta.factor)),
        rates: Object.freeze({
          s3RequestPer1k: round4(SCALAR_BASE.s3RequestPer1k * meta.factor),
          rdsStorageGbMonth: round4(SCALAR_BASE.rdsStorageGbMonth * meta.factor),
          dataTransferOutGb: round4(SCALAR_BASE.dataTransferOutGb * meta.factor),
        }),
      }),
    ]),
  ),
);

/** Ordered list of regions for populating selects. Never empty. */
export function listRegions() {
  return REGION_META.map(({ id, label, location }) => ({ id, label, location }));
}

/** Resolve a region object, always falling back to the default region. */
export function getRegion(regionId) {
  return REGIONS[regionId] ?? REGIONS[DEFAULT_REGION];
}

/** Option list (id/label/rate/spec) for a service in a region. Safe for unknown keys. */
export function getServiceOptions(regionId, serviceKey) {
  const region = getRegion(regionId);
  return Array.isArray(region[serviceKey]) ? region[serviceKey] : [];
}

/** Look up a single option's sample rate. Returns `undefined` when unknown. */
export function getRate(regionId, serviceKey, optionId) {
  const option = getServiceOptions(regionId, serviceKey).find((entry) => entry.id === optionId);
  return option ? option.rate : undefined;
}

/** Look up a region scalar rate (e.g. dataTransferOutGb). Returns 0 when unknown. */
export function getScalarRate(regionId, key) {
  const region = getRegion(regionId);
  return region.rates[key] ?? 0;
}

const DEFAULT = getRegion(DEFAULT_REGION);

/** Backwards-compatible flat defaults used to seed a fresh workload. */
export const DEFAULTS = Object.freeze({
  region: DEFAULT_REGION,
  ec2Instance: 't3.micro',
  ec2Hours: 730,
  ec2Rate: getRate(DEFAULT_REGION, 'ec2', 't3.micro'),
  storageType: 'gp3',
  storageGb: 30,
  storageRate: getRate(DEFAULT_REGION, 'ebs', 'gp3'),
  budget: 15,
});

/** Convenience maps kept for callers that only need id -> rate. */
export const EC2_RATES = Object.freeze(
  Object.fromEntries(DEFAULT.ec2.map((option) => [option.id, option.rate])),
);
export const STORAGE_RATES = Object.freeze(
  Object.fromEntries(DEFAULT.ebs.map((option) => [option.id, option.rate])),
);

/** Global, region-independent pricing context and the mandatory disclaimer. */
export const PRICING_NOTES = Object.freeze({
  operatingSystem: 'Linux/Unix',
  currency: 'USD',
  monthLength: '730 hours for a rough always-on month',
  basis: 'Sample rates are the us-east-1 reference scaled by a per-region factor.',
  disclaimer:
    'Curated sample pricing for learning and portfolio use. Not fetched live and not an official AWS quote. Real bills vary by region, OS, usage model, taxes, free-tier credits, data transfer, snapshots, monitoring, and commitment discounts.',
});
