import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EXPORT_VERSION,
  MAX_IMPORT_BYTES,
  SUPPORTED_EXPORT_VERSIONS,
  buildFilename,
  parseImport,
  toCsv,
  toExportObject,
  toForecastCsv,
  toSensitivityCsv,
  toJson,
  validateImportFile,
} from '../src/export.js';
import { createDefaultWorkload } from '../src/state.js';
import { estimateWorkload } from '../src/calculator.js';

describe('JSON export/import', () => {
  it('round-trips a workload through export and import', () => {
    const workload = createDefaultWorkload();
    const json = toJson(workload, 'Baseline');
    const result = parseImport(json);

    assert.equal(result.ok, true);
    assert.equal(result.name, 'Baseline');
    assert.deepEqual(result.workload.services.ec2, workload.services.ec2);
  });

  it('stamps app id and version into the envelope', () => {
    const envelope = toExportObject(createDefaultWorkload());
    assert.equal(envelope.app, 'cloud-cost-calculator');
    assert.equal(envelope.version, EXPORT_VERSION);
    assert.equal(typeof envelope.exportedAt, 'string');
  });

  it('normalizes untrusted export and import names', () => {
    const oversizedName = `  ${'Long name '.repeat(10)} `;
    const envelope = toExportObject(createDefaultWorkload(), oversizedName);
    const imported = parseImport(JSON.stringify({ ...envelope, name: oversizedName }));

    assert.equal(envelope.name.length, 60);
    assert.equal(imported.name.length, 60);
    assert.equal(imported.name, envelope.name);
  });

  it('accepts a bare workload (no envelope)', () => {
    const result = parseImport(JSON.stringify(createDefaultWorkload()));
    assert.equal(result.ok, true);
    assert.equal(result.workload.services.ebs.enabled, true);
  });

  it('rejects incompatible versioned export envelopes', () => {
    const workload = createDefaultWorkload();
    const future = parseImport(
      JSON.stringify({ app: 'cloud-cost-calculator', version: 999, workload }),
    );
    const otherApp = parseImport(JSON.stringify({ app: 'some-other-app', version: 1, workload }));

    assert.equal(future.ok, false);
    assert.match(future.error, /unsupported/i);
    assert.equal(otherApp.ok, false);
  });

  it('imports legacy envelopes while writing V3 planning and commitment profiles', () => {
    const workload = createDefaultWorkload();
    const legacy = parseImport(JSON.stringify({
      app: 'cloud-cost-calculator',
      version: 1,
      name: 'Legacy baseline',
      workload: { ...workload, version: 1 },
    }));

    assert.deepEqual(SUPPORTED_EXPORT_VERSIONS, [1, 2, 3]);
    assert.equal(legacy.ok, true);
    assert.equal(legacy.name, 'Legacy baseline');
    assert.equal(legacy.workload.version, 3);
    assert.equal(legacy.workload.optimization.ec2CoveragePercent, 0);

    const v2 = parseImport(JSON.stringify({
      app: 'cloud-cost-calculator',
      version: 2,
      workload: createDefaultWorkload(),
    }));
    assert.equal(v2.ok, true);
    assert.deepEqual(legacy.workload.planning, createDefaultWorkload().planning);
  });

  it('rejects invalid JSON and non-workload objects', () => {
    assert.equal(parseImport('{not json').ok, false);
    assert.equal(parseImport('42').ok, false);
    assert.equal(parseImport('{"foo":"bar"}').ok, false);
    assert.equal(parseImport('null').ok, false);
  });

  it('rejects oversized text before parsing it', () => {
    const result = parseImport('x'.repeat(MAX_IMPORT_BYTES + 1));
    assert.equal(result.ok, false);
    assert.match(result.error, /too large/i);
  });

  it('measures the import limit in UTF-8 bytes rather than JavaScript characters', () => {
    const oversizedUnicode = '😀'.repeat(Math.floor(MAX_IMPORT_BYTES / 4) + 1);
    const result = parseImport(oversizedUnicode);

    assert.equal(result.ok, false);
    assert.match(result.error, /too large/i);
  });
});

describe('validateImportFile', () => {
  it('accepts a small JSON file and rejects unsafe file metadata', () => {
    assert.deepEqual(validateImportFile({ name: 'estimate.json', type: 'application/json', size: 100 }), {
      ok: true,
    });
    assert.equal(validateImportFile({ name: 'estimate.txt', type: 'text/plain', size: 100 }).ok, false);
    assert.equal(validateImportFile({ name: 'estimate.json', type: 'application/json', size: MAX_IMPORT_BYTES + 1 }).ok, false);
  });
});

describe('CSV export', () => {
  it('lists each line item and a total row', () => {
    const estimate = estimateWorkload(createDefaultWorkload());
    const csv = toCsv(estimate);
    const lines = csv.split('\r\n');

    assert.equal(lines[0], 'Service,Detail,Gross monthly (USD),Commitment saving (USD),Net monthly (USD)');
    assert.ok(lines.some((line) => line.startsWith('EC2 compute')));
    assert.ok(lines.at(-1).startsWith('Total,,9.99,0.00,9.99'));
  });

  it('escapes cells that contain commas or quotes', () => {
    const estimate = {
      lineItems: [{ serviceLabel: 'Odd, "svc"', detail: 'a,b', amount: 1.5 }],
      total: 1.5,
    };
    const csv = toCsv(estimate);
    assert.ok(csv.includes('"Odd, ""svc"""'));
    assert.ok(csv.includes('"a,b"'));
  });

  it('neutralizes spreadsheet formulas in user-provided cells', () => {
    const estimate = {
      lineItems: [{ serviceLabel: '=HYPERLINK("https://example.com")', detail: '+1', amount: 1 }],
      total: 1,
    };

    const csv = toCsv(estimate);
    assert.ok(csv.includes(`"'=HYPERLINK(""https://example.com"")"`));
    assert.ok(csv.includes("'+1"));
  });

  it('falls back to safe zero values for malformed estimate data', () => {
    assert.doesNotThrow(() => toCsv(null));
    const csv = toCsv({ lineItems: [null, { serviceLabel: 'Odd', amount: 'not-a-number' }], total: -1 });

    assert.ok(csv.includes('Service,,0.00,0.00,0.00'));
    assert.ok(csv.includes('Odd,,0.00,0.00,0.00'));
    assert.ok(csv.endsWith('Total,,0.00,0.00,0.00'));
  });

  it('keeps a commitment saving as a separate numeric column', () => {
    const csv = toCsv({
      lineItems: [{ serviceLabel: 'Compute', detail: 'Sample', grossAmount: 100, commitmentSavings: 15, amount: 85 }],
      grossTotal: 100,
      commitmentSavings: 15,
      total: 85,
    });

    assert.match(csv, /Compute,Sample,100\.00,15\.00,85\.00/);
    assert.ok(csv.endsWith('Total,,100.00,15.00,85.00'));
  });
});

describe('forecast CSV export', () => {
  it('exports cash flow, signed budget differences, and a planning-horizon total', () => {
    const csv = toForecastCsv({
      horizonTotal: 315,
      horizonGrossTotal: 360,
      horizonCommitmentSavings: 45,
      months: [
        { amount: 95, grossAmount: 110, commitmentSavings: 15, budgetDelta: 5, overBudget: false },
        { amount: 105, grossAmount: 120, commitmentSavings: 15, budgetDelta: -5, overBudget: true },
        { amount: 115, grossAmount: 130, commitmentSavings: 15, budgetDelta: -15, overBudget: true },
      ],
    });
    const lines = csv.split('\r\n');

    assert.equal(lines[0], 'Month,Gross monthly cost (USD),Commitment saving (USD),Projected monthly cost (USD),Budget difference (USD),Budget state');
    assert.equal(lines[1], 'Month 1,110.00,15.00,95.00,5.00,Within budget');
    assert.equal(lines[2], 'Month 2,120.00,15.00,105.00,-5.00,Over budget');
    assert.equal(lines.at(-1), 'Horizon total (3 months),360.00,45.00,315.00,,');
  });

  it('keeps malformed forecast data safe and handles a missing budget', () => {
    const csv = toForecastCsv({ months: [null, { amount: 'invalid', budgetDelta: null }] });

    assert.match(csv, /Month 1,0.00,0.00,0.00,,No budget set/);
    assert.match(csv, /Month 2,0.00,0.00,0.00,,No budget set/);
    assert.match(csv, /Horizon total \(2 months\),0.00,0.00,0.00/);
  });
});

describe('sensitivity CSV export', () => {
  it('exports low/base/high cases with honest budget states', () => {
    const csv = toSensitivityCsv({
      cases: [
        { label: 'Lower-rate case', total: 80, budgetDelta: 20, overBudget: false },
        { label: 'Current plan', total: 100, budgetDelta: 0, overBudget: false },
        { label: 'Higher-rate case', total: 120, budgetDelta: -20, overBudget: true },
      ],
    });

    const lines = csv.split('\r\n');
    assert.equal(lines[0], 'Case,Monthly cost (USD),Budget difference (USD),Budget state');
    assert.equal(lines[1], 'Lower-rate case,80.00,20.00,Within budget');
    assert.equal(lines.at(-1), 'Higher-rate case,120.00,-20.00,Over budget');
  });

  it('keeps malformed sensitivity records safe', () => {
    assert.match(toSensitivityCsv({ cases: [null] }), /Case 1,0\.00,,No budget set/);
  });
});

describe('buildFilename', () => {
  it('produces a safe, dated filename', () => {
    const name = buildFilename('My Prod Estimate!', 'json');
    assert.match(name, /^cloud-cost-my-prod-estimate-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('falls back to a default base when empty', () => {
    assert.match(buildFilename('', 'csv'), /^cloud-cost-estimate-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('sanitizes a caller-provided extension', () => {
    const filename = buildFilename('Estimate', '../JSON?download=true');
    assert.match(filename, /^cloud-cost-estimate-\d{4}-\d{2}-\d{2}\.jsondownlo$/);
    assert.doesNotMatch(filename, /[/?\\]/);
  });
});
