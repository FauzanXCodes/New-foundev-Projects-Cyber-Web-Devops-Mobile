/**
 * Workload state model.
 *
 * A "workload" is the normalized, DOM-independent description of what the user
 * is estimating: a region, a monthly budget, and a set of AWS service
 * configurations. The estimation engine, scenario storage, sharing, and import
 * all operate on this single shape so there is exactly one source of truth.
 */

import { clampCount, clampRange } from './validation.js';
import { DEFAULT_REGION, DEFAULTS, getRate, getRegion, getScalarRate } from './pricing.js';

/** Resolve a service's enabled flag: honour an explicit boolean, else default. */
function resolveEnabled(value, fallbackEnabled) {
  return typeof value === 'boolean' ? value : fallbackEnabled;
}

/**
 * Application-level planning caps for every user-controlled numeric value.
 *
 * These are deliberately far above the bundled presets, but keep malformed,
 * imported, persisted, and shared values inside a finite, reviewable range.
 * They are guardrails for this sample planner, not AWS service limits.
 */
export const LIMITS = Object.freeze({
  budget: 10_000_000,
  planningHorizonMonths: 60,
  monthlyGrowthPercent: 20,
  contingencyPercent: 50,
  rateVariancePercent: 50,
  commitmentCoveragePercent: 100,
  commitmentDiscountPercent: 80,
  metadataOwnerLength: 80,
  metadataCostCenterLength: 60,
  metadataNotesLength: 1_000,
  ec2Quantity: 1000,
  ec2Hours: 744,
  ec2Rate: 10,
  ebsVolumes: 100,
  ebsSizeGb: 16_384,
  ebsRate: 10,
  s3StorageGb: 1_000_000,
  s3Rate: 10,
  s3Requests: 10_000_000_000,
  s3RequestRate: 1,
  rdsQuantity: 100,
  rdsHours: 744,
  rdsInstanceRate: 10,
  rdsStorageGb: 16_384,
  rdsStorageRate: 10,
  dataTransferGb: 1_000_000,
  dataTransferRate: 10,
  additionalMonthlyCost: 1_000_000,
});

const RDS_ENGINE_IDS = new Set(['postgres', 'mysql', 'mariadb', 'sqlserver', 'oracle']);

/** Bumped whenever the persisted workload shape changes in a breaking way. */
export const WORKLOAD_VERSION = 3;

/** Build a fresh default workload (EC2 + EBS enabled, matching the demo estimate). */
export function createDefaultWorkload() {
  return {
    version: WORKLOAD_VERSION,
    region: DEFAULTS.region ?? 'us-east-1',
    budget: DEFAULTS.budget,
    planning: {
      horizonMonths: 12,
      monthlyGrowthPercent: 0,
      contingencyPercent: 0,
      rateVariancePercent: 0,
    },
    optimization: {
      ec2CoveragePercent: 0,
      ec2DiscountPercent: 0,
      rdsCoveragePercent: 0,
      rdsDiscountPercent: 0,
    },
    metadata: {
      owner: '',
      costCenter: '',
      notes: '',
    },
    services: {
      ec2: {
        enabled: true,
        instanceType: DEFAULTS.ec2Instance,
        quantity: 1,
        hours: DEFAULTS.ec2Hours,
        rate: DEFAULTS.ec2Rate,
      },
      ebs: {
        enabled: true,
        volumeType: DEFAULTS.storageType,
        volumes: 1,
        sizeGb: DEFAULTS.storageGb,
        rate: DEFAULTS.storageRate,
      },
      s3: {
        enabled: false,
        storageClass: 'standard',
        storageGb: 100,
        rate: getRate(DEFAULT_REGION, 's3', 'standard'),
        requests: 1_000_000,
        requestRate: getScalarRate(DEFAULT_REGION, 's3RequestPer1k'),
      },
      rds: {
        enabled: false,
        engine: 'postgres',
        instanceClass: 'db.t3.micro',
        quantity: 1,
        hours: DEFAULTS.ec2Hours,
        instanceRate: getRate(DEFAULT_REGION, 'rds', 'db.t3.micro'),
        storageGb: 20,
        storageRate: getScalarRate(DEFAULT_REGION, 'rdsStorageGbMonth'),
      },
      dataTransfer: {
        enabled: false,
        outboundGb: 100,
        rate: getScalarRate(DEFAULT_REGION, 'dataTransferOutGb'),
      },
      additional: {
        enabled: false,
        label: 'Other AWS services',
        monthlyCost: 0,
      },
    },
  };
}

/**
 * Coerce an arbitrary (possibly untrusted) object into a valid workload.
 * Missing fields fall back to defaults; numeric fields are clamped; unknown
 * fields are dropped. Never throws.
 */
export function normalizeWorkload(raw) {
  const defaults = createDefaultWorkload();
  const source = raw && typeof raw === 'object' ? raw : {};
  const services = source.services && typeof source.services === 'object' ? source.services : {};
  const region = getRegion(source.region).id;

  return {
    version: WORKLOAD_VERSION,
    region,
    budget: clampRange(source.budget, 0, LIMITS.budget, defaults.budget),
    planning: normalizePlanning(source.planning, defaults.planning),
    optimization: normalizeOptimization(source.optimization, defaults.optimization),
    metadata: normalizeMetadata(source.metadata),
    services: {
      ec2: normalizeEc2(services.ec2, defaults.services.ec2, region),
      ebs: normalizeEbs(services.ebs, defaults.services.ebs, region),
      s3: normalizeS3(services.s3, defaults.services.s3, region),
      rds: normalizeRds(services.rds, defaults.services.rds, region),
      dataTransfer: normalizeDataTransfer(services.dataTransfer, defaults.services.dataTransfer),
      additional: normalizeAdditional(services.additional, defaults.services.additional),
    },
  };
}

// Numeric fields coerce invalid / infinite / missing values to zero so a
// cleared input or corrupt payload never injects a phantom cost. Known select
// ids are retained; unsupported ids fall back so imported/shared state always
// remains representable by the form controls.
function knownOptionOrFallback(value, region, serviceKey, fallback) {
  return typeof value === 'string' && getRate(region, serviceKey, value) !== undefined
    ? value
    : fallback;
}

function normalizeEc2(raw, fallback, region) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    instanceType: knownOptionOrFallback(source.instanceType, region, 'ec2', fallback.instanceType),
    quantity: clampCount(source.quantity, { min: 1, max: LIMITS.ec2Quantity, fallback: 1 }),
    hours: clampRange(source.hours, 0, LIMITS.ec2Hours, 0),
    rate: clampRange(source.rate, 0, LIMITS.ec2Rate, 0),
  };
}

function normalizeEbs(raw, fallback, region) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    volumeType: knownOptionOrFallback(source.volumeType, region, 'ebs', fallback.volumeType),
    volumes: clampCount(source.volumes, { min: 1, max: LIMITS.ebsVolumes, fallback: 1 }),
    sizeGb: clampRange(source.sizeGb, 0, LIMITS.ebsSizeGb, 0),
    rate: clampRange(source.rate, 0, LIMITS.ebsRate, 0),
  };
}

function normalizeS3(raw, fallback, region) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    storageClass: knownOptionOrFallback(source.storageClass, region, 's3', fallback.storageClass),
    storageGb: clampRange(source.storageGb, 0, LIMITS.s3StorageGb, 0),
    rate: clampRange(source.rate, 0, LIMITS.s3Rate, 0),
    requests: clampRange(source.requests, 0, LIMITS.s3Requests, 0),
    requestRate: clampRange(source.requestRate, 0, LIMITS.s3RequestRate, 0),
  };
}

function normalizeRds(raw, fallback, region) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    engine: RDS_ENGINE_IDS.has(source.engine) ? source.engine : fallback.engine,
    instanceClass: knownOptionOrFallback(source.instanceClass, region, 'rds', fallback.instanceClass),
    quantity: clampCount(source.quantity, { min: 1, max: LIMITS.rdsQuantity, fallback: 1 }),
    hours: clampRange(source.hours, 0, LIMITS.rdsHours, 0),
    instanceRate: clampRange(source.instanceRate, 0, LIMITS.rdsInstanceRate, 0),
    storageGb: clampRange(source.storageGb, 0, LIMITS.rdsStorageGb, 0),
    storageRate: clampRange(source.storageRate, 0, LIMITS.rdsStorageRate, 0),
  };
}

function normalizeDataTransfer(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    outboundGb: clampRange(source.outboundGb, 0, LIMITS.dataTransferGb, 0),
    rate: clampRange(source.rate, 0, LIMITS.dataTransferRate, 0),
  };
}

/** Keep a planning horizon and its explicit assumptions within reviewable bounds. */
function normalizePlanning(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    horizonMonths: clampCount(source.horizonMonths, {
      min: 1,
      max: LIMITS.planningHorizonMonths,
      fallback: fallback.horizonMonths,
    }),
    monthlyGrowthPercent: clampRange(
      source.monthlyGrowthPercent,
      -LIMITS.monthlyGrowthPercent,
      LIMITS.monthlyGrowthPercent,
      fallback.monthlyGrowthPercent,
    ),
    contingencyPercent: clampRange(
      source.contingencyPercent,
      0,
      LIMITS.contingencyPercent,
      fallback.contingencyPercent,
    ),
    rateVariancePercent: clampRange(
      source.rateVariancePercent,
      0,
      LIMITS.rateVariancePercent,
      fallback.rateVariancePercent,
    ),
  };
}

/** Normalize optional commitment coverage and discount assumptions per service. */
function normalizeOptimization(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    ec2CoveragePercent: clampRange(
      source.ec2CoveragePercent,
      0,
      LIMITS.commitmentCoveragePercent,
      fallback.ec2CoveragePercent,
    ),
    ec2DiscountPercent: clampRange(
      source.ec2DiscountPercent,
      0,
      LIMITS.commitmentDiscountPercent,
      fallback.ec2DiscountPercent,
    ),
    rdsCoveragePercent: clampRange(
      source.rdsCoveragePercent,
      0,
      LIMITS.commitmentCoveragePercent,
      fallback.rdsCoveragePercent,
    ),
    rdsDiscountPercent: clampRange(
      source.rdsDiscountPercent,
      0,
      LIMITS.commitmentDiscountPercent,
      fallback.rdsDiscountPercent,
    ),
  };
}

/** Preserve only portable, presentation-safe estimate context. */
function normalizeMetadata(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    owner: normalizeText(source.owner, LIMITS.metadataOwnerLength),
    costCenter: normalizeText(source.costCenter, LIMITS.metadataCostCenterLength),
    notes: normalizeText(source.notes, LIMITS.metadataNotesLength),
  };
}

function normalizeText(value, maxLength) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

function normalizeAdditional(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const label = normalizeText(source.label, 60);
  return {
    enabled: resolveEnabled(source.enabled, fallback.enabled),
    label: label || fallback.label,
    monthlyCost: clampRange(source.monthlyCost, 0, LIMITS.additionalMonthlyCost, 0),
  };
}

/** Shallow-merge a partial patch into a service without losing other fields. */
export function updateService(workload, serviceId, patch) {
  const next = normalizeWorkload(workload);
  if (!next.services[serviceId]) {
    return next;
  }
  next.services[serviceId] = { ...next.services[serviceId], ...patch };
  return normalizeWorkload(next);
}

/** Coerce the top-level numeric budget without disturbing services. */
export function setBudget(workload, budget) {
  const next = normalizeWorkload(workload);
  next.budget = clampRange(budget, 0, LIMITS.budget, next.budget);
  return next;
}

/** Guard used by tests and sharing: is this object plausibly a workload? */
export function isWorkloadLike(value) {
  return Boolean(value && typeof value === 'object' && typeof value.services === 'object');
}

/** Count of enabled services, used for empty-state handling. */
export function countEnabledServices(workload) {
  const normalized = normalizeWorkload(workload);
  return Object.values(normalized.services).filter((service) => service.enabled).length;
}

/**
 * Complete workload presets. Each spec lists the shape of every enabled
 * service (without rates); rates are resolved from the target region so a
 * preset works correctly regardless of the currently selected region.
 */
const PRESET_SPECS = [
  {
    id: 'dev',
    name: 'Small development',
    description: 'One small instance for part-time development work.',
    budget: 10,
    ec2: { instanceType: 't3.micro', quantity: 1, hours: 40 },
    ebs: { volumeType: 'gp3', volumes: 1, sizeGb: 20 },
  },
  {
    id: 'portfolio',
    name: 'Portfolio web app',
    description: 'An always-on small instance with storage, S3 hosting, and light egress.',
    budget: 25,
    ec2: { instanceType: 't3.small', quantity: 1, hours: 730 },
    ebs: { volumeType: 'gp3', volumes: 1, sizeGb: 30 },
    s3: { storageClass: 'standard', storageGb: 25, requests: 500_000 },
    dataTransfer: { outboundGb: 50 },
  },
  {
    id: 'production',
    name: 'Small production app',
    description: 'Redundant compute, a managed database, storage, and moderate egress.',
    budget: 120,
    ec2: { instanceType: 't3.medium', quantity: 2, hours: 730 },
    ebs: { volumeType: 'gp3', volumes: 2, sizeGb: 50 },
    s3: { storageClass: 'standard', storageGb: 100, requests: 2_000_000 },
    rds: { engine: 'postgres', instanceClass: 'db.t3.small', quantity: 1, hours: 730, storageGb: 50 },
    dataTransfer: { outboundGb: 200 },
  },
  {
    id: 'data-heavy',
    name: 'Data-heavy app',
    description: 'Large compute and database with heavy object storage and transfer.',
    budget: 600,
    ec2: { instanceType: 't3.large', quantity: 3, hours: 730 },
    ebs: { volumeType: 'gp3', volumes: 4, sizeGb: 200 },
    s3: { storageClass: 'standard', storageGb: 2000, requests: 20_000_000 },
    rds: { engine: 'postgres', instanceClass: 'db.m5.large', quantity: 2, hours: 730, storageGb: 500 },
    dataTransfer: { outboundGb: 2000 },
  },
];

/** Preset metadata for building selection UI. */
export function listPresets() {
  return PRESET_SPECS.map(({ id, name, description }) => ({ id, name, description }));
}

/**
 * Build a complete workload from a preset, resolving every rate from the given
 * region. Services not named by the preset are disabled (but keep sensible,
 * region-correct defaults for when they are re-enabled). Unknown preset ids
 * fall back to the default workload.
 */
export function presetWorkload(presetId, region = DEFAULT_REGION) {
  const spec = PRESET_SPECS.find((preset) => preset.id === presetId);
  const regionId = getRegion(region).id;
  const workload = createDefaultWorkload();
  workload.region = regionId;

  // Ensure every service carries region-correct rates before applying the spec.
  workload.services.ec2.rate = getRate(regionId, 'ec2', workload.services.ec2.instanceType);
  workload.services.ebs.rate = getRate(regionId, 'ebs', workload.services.ebs.volumeType);
  workload.services.s3.rate = getRate(regionId, 's3', workload.services.s3.storageClass);
  workload.services.s3.requestRate = getScalarRate(regionId, 's3RequestPer1k');
  workload.services.rds.instanceRate = getRate(regionId, 'rds', workload.services.rds.instanceClass);
  workload.services.rds.storageRate = getScalarRate(regionId, 'rdsStorageGbMonth');
  workload.services.dataTransfer.rate = getScalarRate(regionId, 'dataTransferOutGb');

  if (!spec) {
    return workload;
  }

  workload.budget = spec.budget;

  workload.services.ec2 = {
    enabled: true,
    instanceType: spec.ec2.instanceType,
    quantity: spec.ec2.quantity,
    hours: spec.ec2.hours,
    rate: getRate(regionId, 'ec2', spec.ec2.instanceType),
  };

  applyOptional(workload, 'ebs', Boolean(spec.ebs), () => ({
    volumeType: spec.ebs.volumeType,
    volumes: spec.ebs.volumes,
    sizeGb: spec.ebs.sizeGb,
    rate: getRate(regionId, 'ebs', spec.ebs.volumeType),
  }));

  applyOptional(workload, 's3', Boolean(spec.s3), () => ({
    storageClass: spec.s3.storageClass,
    storageGb: spec.s3.storageGb,
    rate: getRate(regionId, 's3', spec.s3.storageClass),
    requests: spec.s3.requests,
    requestRate: getScalarRate(regionId, 's3RequestPer1k'),
  }));

  applyOptional(workload, 'rds', Boolean(spec.rds), () => ({
    engine: spec.rds.engine,
    instanceClass: spec.rds.instanceClass,
    quantity: spec.rds.quantity,
    hours: spec.rds.hours,
    instanceRate: getRate(regionId, 'rds', spec.rds.instanceClass),
    storageGb: spec.rds.storageGb,
    storageRate: getScalarRate(regionId, 'rdsStorageGbMonth'),
  }));

  applyOptional(workload, 'dataTransfer', Boolean(spec.dataTransfer), () => ({
    outboundGb: spec.dataTransfer.outboundGb,
    rate: getScalarRate(regionId, 'dataTransferOutGb'),
  }));

  return normalizeWorkload(workload);
}

function applyOptional(workload, serviceId, enabled, buildFields) {
  if (enabled) {
    workload.services[serviceId] = { enabled: true, ...buildFields() };
  } else {
    workload.services[serviceId].enabled = false;
  }
}
