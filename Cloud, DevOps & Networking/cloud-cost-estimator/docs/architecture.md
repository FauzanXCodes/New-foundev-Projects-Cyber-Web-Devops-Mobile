# Architecture

The application is plain HTML, CSS, and dependency-free ES modules. The guiding
principle is a **pure, testable calculation core** kept strictly separate from a
single DOM-orchestration module.

## Layers

```text
             ┌───────────────────────────────────────────────┐
 DOM layer   │  app.js  (the only module that touches the DOM) │
             └───────────────┬───────────────────────────────┘
                             │ reads inputs -> builds a workload
                             v
 Model       │  state.js     workload schema, normalization, presets
             │  validation.js numeric coercion / clamping primitives
                             │
                             v
 Engine      │  calculator.js  estimateWorkload() -> structured estimate
             │  forecast.js    bounded cash-flow projection and comparison
             │  pricing.js     region-aware sample rate catalogue
                             │
             ┌───────────────┴───────────────────────────────┐
 Features    │ recommendations.js  savings.js  charts.js  compare.js       │
             │ scenarios.js  export.js  share.js  theme.js                  │
             └───────────────────────────────────────────────┘
```

Only `app.js` imports the DOM. Every other module is pure data-in / data-out (or
storage-injectable), which is why the test suite can exercise the whole system
in Node without a browser.

## The workload model

A **workload** is the single source of truth: a region, a monthly budget, and a
set of service configurations.

```js
{
  version: 3,
  region: 'us-east-1',
  budget: 15,
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
    ec2:          { enabled, instanceType, quantity, hours, rate },
    ebs:          { enabled, volumeType, volumes, sizeGb, rate },
    s3:           { enabled, storageClass, storageGb, rate, requests, requestRate },
    rds:          { enabled, engine, instanceClass, quantity, hours, instanceRate, storageGb, storageRate },
    dataTransfer: { enabled, outboundGb, rate },
    additional:   { enabled, label, monthlyCost },
  }
}
```

`normalizeWorkload()` coerces any untrusted object (persisted state, imported
file, shared URL) into this shape: invalid, infinite, negative, or missing
numbers collapse to safe values; every user-controlled numeric field is capped
by a central planning limit; and unsupported regions, service options, and RDS
engine ids fall back to known form values. Unknown fields are dropped. It never
throws.

## The estimate

`estimateWorkload(workload)` returns plain data suitable for rendering,
exporting, and comparison:

```js
{
  region, currency,
  lineItems: [{ service, serviceLabel, label, detail, grossAmount, commitmentSavings, amount }],
  serviceSubtotals: { [serviceId]: amount },   // net enabled services only
  services: [{ id, label, grossAmount, commitmentSavings, amount, enabled }],
  grossBaseTotal, grossTotal, commitmentSavings,
  baseTotal, contingencyAmount, contingencyPercent,
  total, annualTotal,
  budget, budgetUsedPercent, remaining, overage, overBudget,
  budgetStatus,  // 'no-budget' | 'healthy' | 'watch' | 'risk' | 'over'
}
```

## Service registry (extension point)

`SERVICE_DEFINITIONS` in `calculator.js` is an array of `{ id, label, estimate }`.
Each `estimate(service)` returns one or more line items. Adding a new AWS service
means appending one entry there and a matching config in the workload model;
totals, subtotals, the chart, exports, and comparison all pick it up
automatically.

## Data flow on input

1. The user edits a control; `app.js` reads the form into a workload.
2. `estimateWorkload()` produces the estimate.
3. `app.js` renders the total, commitment impact, breakdown chart, budget health,
   recommendations, savings target, allocation report, forecast cash flow, rate
   envelope, and decision-readiness checks; it also refreshes active comparisons.
4. The workload is persisted to local storage for the next visit.

## Persistence and portability

- **Scenarios** (`scenarios.js`) use a versioned local-storage envelope with
  bounded, de-duplicated entries, decision tags/notes, per-entry sanitization,
  and migration; corrupt data degrades to an empty list.
- **Export/import** (`export.js`) uses a versioned JSON envelope; import accepts
  an envelope or a bare workload and validates type, size, and shape before
  applying. Estimate, forecast, and sensitivity CSVs are derived from pure rows.
- **Sharing** (`share.js`) encodes the workload as URL-safe base64; decoding is
  defensive and yields `null` for tampered state. Native sharing falls back to
  a copyable link when unavailable.
- **Local workflow state** keeps the estimate name out of share URLs and holds
  one normalized reset snapshot so the reset action is reversible; resetting an
  estimate never deletes saved scenarios.
- **Review briefs** (`review-brief.js`) generate portable plain text that keeps
  the sample-pricing disclaimer, estimate, forecast, readiness checks, and
  entered review context together for tickets or planning notes.

All three funnel back through `normalizeWorkload()`, so no external input can put
the app into an invalid state.

## Planning projection

`buildForecast(workload)` starts from the already-calculated monthly total
(including any explicit contingency reserve), then compounds the user-entered
monthly cost-change assumption, which may model growth or a planned reduction.
It returns transparent rows for each
month, a horizon total, final-month run rate, and budget state. It does not call
AWS or claim to forecast pricing. `compareForecasts()` uses only the shortest
shared horizon when saved scenarios disagree, preventing a misleading 12-month
versus 24-month total comparison.

## Commitment, sensitivity, and readiness

`commitments.js` keeps EC2 and RDS commitment assumptions explicit. A savings
input is always calculated as a blended what-if: eligible gross cost multiplied
by coverage and the covered-cost discount. `risk.js` carries a bounded
low/base/high rate variance through the monthly plan and forecast without
mutating sample pricing. `readiness.js` reports individual `ready`, `attention`,
and `info` checks for review context, budget, contingency, sensitivity,
forecast budget behaviour, and commitment evidence. It intentionally returns no
composite score.
