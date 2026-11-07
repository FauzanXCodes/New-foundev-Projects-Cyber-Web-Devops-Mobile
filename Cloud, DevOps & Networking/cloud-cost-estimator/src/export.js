/**
 * Estimate export/import serialization (pure).
 *
 * Produces a versioned JSON envelope for a workload, a CSV of the estimate's
 * line items, and human-readable filenames. Import validation is defensive:
 * it accepts either a full envelope or a bare workload, and never throws.
 */

import { normalizeWorkload } from './state.js';
import { normalizeEstimateName } from './estimate-name.js';

export const EXPORT_VERSION = 3;
export const SUPPORTED_EXPORT_VERSIONS = Object.freeze([1, 2, EXPORT_VERSION]);
export const MAX_IMPORT_BYTES = 1_000_000;
const APP_ID = 'cloud-cost-calculator';
const SUPPORTED_EXPORT_VERSION_SET = new Set(SUPPORTED_EXPORT_VERSIONS);

function utf8ByteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function normalizeOptionalName(value) {
  return typeof value === 'string' && value.trim() ? normalizeEstimateName(value) : undefined;
}

/** Build the export envelope for a workload. */
export function toExportObject(workload, name) {
  const cleanName = normalizeOptionalName(name);
  return {
    app: APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    ...(cleanName ? { name: cleanName } : {}),
    workload: normalizeWorkload(workload),
  };
}

/** Pretty-printed JSON string of the export envelope. */
export function toJson(workload, name) {
  return JSON.stringify(toExportObject(workload, name), null, 2);
}

/**
 * Parse and validate an imported JSON string.
 * Accepts a full envelope ({ workload }) or a bare workload ({ services }).
 * Returns { ok, workload, name } or { ok: false, error }.
 */
export function parseImport(text) {
  if (typeof text !== 'string' || utf8ByteLength(text) > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'That import is too large. Use a JSON estimate smaller than 1 MB.' };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'That file is not a valid estimate.' };
  }
  const hasEnvelope = Object.prototype.hasOwnProperty.call(parsed, 'workload');
  if (hasEnvelope && (parsed.app !== APP_ID || !SUPPORTED_EXPORT_VERSION_SET.has(parsed.version))) {
    return {
      ok: false,
      error: 'That export uses an unsupported app or version. Import a current Cloud Cost Calculator export or a bare workload.',
    };
  }
  const source = hasEnvelope
    ? parsed.workload
    : parsed.services && typeof parsed.services === 'object'
      ? parsed
      : null;
  if (!source || typeof source.services !== 'object') {
    return { ok: false, error: 'That file does not contain a workload.' };
  }
  return {
    ok: true,
    workload: normalizeWorkload(source),
    name: normalizeOptionalName(parsed.name),
  };
}

/** Validate a browser File before reading its potentially untrusted contents. */
export function validateImportFile(file) {
  if (!file || typeof file !== 'object') {
    return { ok: false, error: 'Choose a JSON estimate to import.' };
  }
  if (!Number.isFinite(file.size) || file.size < 0) {
    return { ok: false, error: 'That file could not be validated.' };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'That import is too large. Use a JSON estimate smaller than 1 MB.' };
  }
  const type = String(file.type ?? '').toLowerCase();
  const name = String(file.name ?? '');
  const hasJsonType = type === '' || type === 'application/json' || type === 'text/json';
  if (!hasJsonType && !/\.json$/i.test(name)) {
    return { ok: false, error: 'Choose a JSON (.json) estimate file.' };
  }
  return { ok: true };
}

function csvCell(value) {
  let text = String(value);
  // Spreadsheet applications may evaluate a cell that begins with one of
  // these characters as a formula. Prefix it with a literal marker so an
  // exported user-provided allowance label remains data when opened there.
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV of gross, commitment-adjusted, and net estimate line items plus totals. */
export function toCsv(estimate) {
  const rows = [['Service', 'Detail', 'Gross monthly (USD)', 'Commitment saving (USD)', 'Net monthly (USD)']];
  const lineItems = Array.isArray(estimate?.lineItems) ? estimate.lineItems : [];
  lineItems.forEach((item) => {
    const line = item && typeof item === 'object' ? item : {};
    const amount = Number.isFinite(line.amount) && line.amount >= 0 ? line.amount : 0;
    const grossAmount = Number.isFinite(line.grossAmount) && line.grossAmount >= 0
      ? line.grossAmount
      : amount;
    const commitmentSavings = Number.isFinite(line.commitmentSavings) && line.commitmentSavings >= 0
      ? line.commitmentSavings
      : 0;
    rows.push([
      line.serviceLabel ?? 'Service',
      line.detail ?? '',
      grossAmount.toFixed(2),
      commitmentSavings.toFixed(2),
      amount.toFixed(2),
    ]);
  });
  const total = Number.isFinite(estimate?.total) && estimate.total >= 0 ? estimate.total : 0;
  const grossTotal = Number.isFinite(estimate?.grossTotal) && estimate.grossTotal >= 0
    ? estimate.grossTotal
    : total;
  const commitmentSavings = Number.isFinite(estimate?.commitmentSavings) && estimate.commitmentSavings >= 0
    ? estimate.commitmentSavings
    : Math.max(0, grossTotal - total);
  rows.push(['Total', '', grossTotal.toFixed(2), commitmentSavings.toFixed(2), total.toFixed(2)]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/**
 * CSV of a forecast's cash flow. Amounts are produced by the calculator (not
 * copied from user-controlled labels), so signed budget differences stay
 * numeric when opened in spreadsheet software.
 */
export function toForecastCsv(forecast) {
  const months = Array.isArray(forecast?.months) ? forecast.months : [];
  const rows = [['Month', 'Gross monthly cost (USD)', 'Commitment saving (USD)', 'Projected monthly cost (USD)', 'Budget difference (USD)', 'Budget state']];
  months.forEach((month, index) => {
    const amount = Number.isFinite(month?.amount) && month.amount >= 0 ? month.amount : 0;
    const grossAmount = Number.isFinite(month?.grossAmount) && month.grossAmount >= 0
      ? month.grossAmount
      : amount;
    const commitmentSavings = Number.isFinite(month?.commitmentSavings) && month.commitmentSavings >= 0
      ? month.commitmentSavings
      : Math.max(0, grossAmount - amount);
    const budgetDifference = Number.isFinite(month?.budgetDelta) ? month.budgetDelta : null;
    const state = budgetDifference === null
      ? 'No budget set'
      : month?.overBudget
        ? 'Over budget'
        : 'Within budget';
    rows.push([
      `Month ${index + 1}`,
      grossAmount.toFixed(2),
      commitmentSavings.toFixed(2),
      amount.toFixed(2),
      budgetDifference === null ? '' : budgetDifference.toFixed(2),
      state,
    ]);
  });
  const total = Number.isFinite(forecast?.horizonTotal) && forecast.horizonTotal >= 0
    ? forecast.horizonTotal
    : 0;
  const grossTotal = Number.isFinite(forecast?.horizonGrossTotal) && forecast.horizonGrossTotal >= 0
    ? forecast.horizonGrossTotal
    : total;
  const commitmentSavings = Number.isFinite(forecast?.horizonCommitmentSavings)
    && forecast.horizonCommitmentSavings >= 0
    ? forecast.horizonCommitmentSavings
    : Math.max(0, grossTotal - total);
  rows.push([`Horizon total (${months.length} months)`, grossTotal.toFixed(2), commitmentSavings.toFixed(2), total.toFixed(2), '', '']);

  return rows
    .map(([month, grossAmount, savings, amount, difference, state]) => [
      csvCell(month),
      grossAmount,
      savings,
      amount,
      difference,
      csvCell(state),
    ].join(','))
    .join('\r\n');
}

/** CSV evidence for the low/base/high monthly rate-sensitivity envelope. */
export function toSensitivityCsv(sensitivity) {
  const cases = Array.isArray(sensitivity?.cases)
    ? sensitivity.cases
    : ['low', 'base', 'high'].map((id) => sensitivity?.[id]).filter(Boolean);
  const rows = [['Case', 'Monthly cost (USD)', 'Budget difference (USD)', 'Budget state']];

  cases.forEach((entry, index) => {
    const caseData = entry && typeof entry === 'object' ? entry : {};
    const total = Number.isFinite(caseData.total) && caseData.total >= 0 ? caseData.total : 0;
    const budgetDifference = Number.isFinite(caseData.budgetDelta) ? caseData.budgetDelta : null;
    const state = budgetDifference === null
      ? 'No budget set'
      : caseData.overBudget
        ? 'Over budget'
        : 'Within budget';
    rows.push([
      caseData.label || `Case ${index + 1}`,
      total.toFixed(2),
      budgetDifference === null ? '' : budgetDifference.toFixed(2),
      state,
    ]);
  });

  return rows
    .map(([label, total, difference, state]) => [csvCell(label), total, difference, csvCell(state)].join(','))
    .join('\r\n');
}

/** Build a human-readable, filesystem-safe filename. */
export function buildFilename(base, extension) {
  const slug =
    String(base ?? 'estimate')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'estimate';
  const safeExtension = String(extension ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10) || 'txt';
  const date = new Date().toISOString().slice(0, 10);
  return `cloud-cost-${slug}-${date}.${safeExtension}`;
}
