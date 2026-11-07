# Cloud Cost Calculator

A lightweight, dependency-free **AWS FinOps planning workbench**. Model a
multi-service workload across regions, watch budget health, compare scenarios,
and export or share the result. It runs as a static frontend with no backend
and no build step.

> **Simplified pricing disclaimer.** Every rate in this project is a *curated
> sample assumption* for learning and portfolio use. Rates are **not fetched
> live** and are **not an official AWS quote**. Real bills vary by region,
> operating system, usage model, taxes, free-tier credits, data transfer,
> snapshots, monitoring, commitment discounts, and other services.  

## Live demo

Deployable to GitHub Pages (see [Deployment](#deployment)):

```
https://<your-username>.github.io/cloud-cost-calculator/
```

You can also open `index.html` directly, or run a local static server (see
[Local setup](#local-setup)).

## Capabilities

- **Six service models** with per-service enable/disable:
  - EC2 compute (instance type, quantity, monthly hours, editable rate)
  - EBS storage (volume type, volume count, size per volume, editable rate)
  - S3 object storage (storage class, GB, request volume, editable rates)
  - RDS database (engine profile, instance class, quantity, hours, storage)
  - Outbound data transfer (GB, editable per-GB rate)
  - Other AWS services allowance (labelled monthly amount for unmodelled costs)
- **Region-aware sample pricing** for US East (N. Virginia), US West (Oregon),
  Asia Pacific (Sydney), and Europe (Ireland).
- **Budget intelligence:** monthly and annualized totals, budget-used percent,
  remaining or overage, and healthy / watch / risk / over classification with an
  accessible progress bar, a text status label, and a transparent savings target
  when the estimate is over budget.
- **Planning profile:** a bounded 1-60 month horizon, monthly cost-change assumption
  (including planned reductions),
  contingency reserve, rate-sensitivity envelope, and portable owner/cost-centre/review context.
- **Transparent commitment what-ifs:** explicit EC2/RDS coverage and covered-cost
  discount assumptions, with gross, modeled saving, and net totals kept separate.
- **Forecast-aware recommendations and savings planning** that identify a later
  budget crossing as well as today's budget gap, with annual planning rollups
  for multi-year horizons.
- **Budget-trajectory milestones** that show when the forecast first reaches
  watch, risk, at-budget, and over-budget stages.
- **Cost allocation report** with ranked service shares and cumulative spend.
- **Complete workload presets** (development, portfolio, production, data-heavy).
- **Named scenarios** saved to local storage, with decision status, notes,
  filtering, load, duplicate, rename, delete, and an explicit comparison
  baseline.
- **Scenario comparison** with per-service/monthly/annual deltas, commitment-policy
  context, and an honest shared-horizon cash-flow summary.
- **Decision-readiness checks** that surface missing review context, budget,
  contingency, sensitivity, and forecast evidence without an opaque score.
- **Editable-rate audit** that plainly identifies enabled rates which differ
  from the selected region's bundled sample catalogue.
- **Accessible cost breakdown** donut chart with a text legend equivalent.
- **Export / import / share:** named JSON, gross/net estimate CSV, commitment-aware
  forecast CSV, and sensitivity CSV downloads; guarded JSON import, native
  sharing where supported, a copyable decision-review brief, and a shareable URL
  that encodes the workload.
- **Print-ready reports** that retain planning assumptions and cash flow while
  leaving editing controls off the page.
- **Reversible reset:** restore the previous workload after resetting defaults.
- **Light, dark, and system themes** with a persisted preference.

## Supported service models

| Service | Model | Notes |
| --- | --- | --- |
| EC2 | `quantity × hours × hourly rate` | Linux/Unix on-demand sample rates |
| EBS | `volumes × GB × GB-month rate` | gp3/gp2/io2/st1/sc1 sample rates |
| S3 | `GB × GB-month rate` + `requests/1000 × request rate` | one blended request rate |
| RDS | `quantity × hours × instance rate` + `GB × storage rate` | licensing/backups/Multi-AZ excluded |
| Data transfer | `outbound GB × per-GB rate` | flat sample; real egress is tiered |

See [docs/pricing-assumptions.md](docs/pricing-assumptions.md) for the full model
and every exclusion.

## Screenshots

Screenshots are not committed. To capture your own for a portfolio writeup:

1. Run the app locally (see [Local setup](#local-setup)).
2. Capture the calculator at desktop width (~1440px) in both dark and light
   themes, and once at mobile width (~390px).
3. Suggested shots: the default estimate, an over-budget state, the scenario
   comparison table, and the cost breakdown chart.
4. Save them under a `screenshots/` folder and link them here.

## Architecture

Plain HTML, CSS, and ES modules. The calculation layer is pure and
DOM-independent; the DOM layer only reads inputs and renders results.

```text
index.html            markup + landmarks + theme bootstrap
src/
  app.js              DOM orchestration (the only module that touches the DOM)
  state.js            workload schema, normalization, presets
  validation.js       numeric coercion / clamping primitives
  pricing.js          region-aware sample pricing catalogue
  calculator.js       estimateWorkload() + formatting + budget classification
  forecast.js         bounded monthly compounding + shared-horizon comparisons
  budget-milestones.js forecast warning-threshold timing
  commitments.js      stated coverage/discount policy + blended savings
  risk.js             low/base/high rate-sensitivity and forecast stress cases
  rate-audit.js       entered-rate versus bundled-sample review
  readiness.js        explicit review checks (never a composite score)
  allocation.js       ranked service cost shares + cumulative allocation
  savings.js          measured budget-gap and reduction-target planning
  recommendations.js  deterministic, estimate-driven advice
  charts.js           accessible SVG donut + legend
  scenarios.js        versioned local-storage scenario store
  compare.js          pure scenario diff
  export.js           JSON/CSV serialization + import validation
  share.js            URL-safe workload encode/decode
  estimate-name.js    local-only display/download name normalization
  undo.js             one-step normalized workload snapshot
  theme.js            light/dark/system preference
  styles.css          token-based design system (light + dark)
```

More detail in [docs/architecture.md](docs/architecture.md).

## Calculation methodology

Every service turns its slice of the workload into one or more line items; the
engine sums the enabled services into a monthly total.

```text
gross modeled cost    = sum of enabled service subtotals
commitment saving     = eligible gross cost x coverage x covered-cost discount
net modeled cost      = gross modeled cost - commitment saving
contingency           = net modeled cost x contingency percentage
monthly total         = net modeled cost + contingency
annual total          = monthly total x 12
budget used %         = monthly total / budget x 100   (null when no budget)
remaining             = budget - monthly total
overage               = max(0, monthly total - budget)
month n forecast      = monthly total x (1 + monthly cost change)^(n - 1)
low/high rate case    = monthly total x (1 -/+ rate variance)
```

Budget health thresholds (percent of budget used): `healthy < 75 <= watch < 90
<= risk <= 100 < over`.

Example (defaults, EC2 + EBS, us-east-1):

```text
EC2:     730 × 0.0104 = 7.592
EBS:      30 × 0.08   = 2.400
Total:   9.992 ≈ $9.99 / month  (healthy against a $15 budget)
```

## Local setup

No dependencies are required to run the app. Open `index.html`, or serve the
folder statically:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Validation

```bash
npm install      # no runtime dependencies; sets up the dev environment
npm run validate # syntax check + static quality gate + Node test suite
npm test         # tests only
```

`npm run validate` runs `scripts/check-syntax.mjs`, `scripts/check-quality.mjs`
(no debug statements/TODOs in `src`, no broken local references in
`index.html`), and the Node test suite. CI runs the same validation across Node
20, 22, and 24.

## Deployment

The project is static, so GitHub Pages works with no build step:

1. Push the repository to GitHub.
2. Open **Settings -> Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. The included **Deploy GitHub Pages** workflow publishes the static site on
   each push to `main` (or can be run manually from the Actions tab).

The workflow follows GitHub's current static Pages artifact flow and requires
the repository's Pages source to be set to GitHub Actions. It has a dedicated
`github-pages` environment and the minimum Pages/OIDC permissions.

See [docs/deployment-notes.md](docs/deployment-notes.md).

## Accessibility

Semantic landmarks, a skip link, labelled controls, a keyboard-operable theme
toggle, a progress bar with `aria-valuenow`/`aria-valuetext`, text status labels
(so budget state is never colour-only), visible focus rings, and
`prefers-reduced-motion` support. See [docs/accessibility.md](docs/accessibility.md).

## Limitations and exclusions

- Sample rates only; not live and not an official AWS quote.
- Simplified models: RDS excludes backups, snapshots, Multi-AZ, provisioned
  I/O, and commercial-engine licensing; data transfer is a flat per-GB sample
  rather than tiered; free tier and taxes are not modelled. Commitment inputs are
  user-entered blended what-ifs, not AWS eligibility checks, recommendations, or quotes.
- Per-region rates are the us-east-1 reference scaled by a transparent factor,
  not independently sourced per region.
- The optional other-services allowance is a manual planning placeholder, not a
  rate catalogue or a quote for unmodelled AWS products.
- Forecasts and low/high sensitivity cases compound user-supplied planning
  assumptions; they are not AWS price predictions. A contingency reserve is an
  explicit planning buffer, not a quoted service charge.

## Project structure

```text
cloud-cost-calculator/
├── .github/workflows/ci.yml
├── index.html
├── package.json
├── scripts/
│   ├── check-syntax.mjs
│   └── check-quality.mjs
├── src/                     # see Architecture above
├── test/                    # Node test suite (one file per module)
├── docs/                    # assumptions, architecture, a11y, checklist, notes
└── examples/scenarios.json  # example workloads (mirror the built-in presets)
```

## Portfolio talking points

- **Architecture:** a pure, testable calculation core cleanly separated from a 
  single DOM-orchestration module, with one service registry that feeds totals,
  charts, exports, and comparison.
- **Defensive input handling:** every numeric input, local-storage payload,
  imported file, and shared URL is normalized to a documented finite planning
  range; unsupported region and service identifiers safely fall back to known
  form options.
- **Accessibility:** WCAG-minded landmarks, focus states, non-colour status
  signalling, and reduced-motion support.
- **Testing:** 190+ Node tests covering calculations, edge cases, planning
  profiles, forecasts, contingency buffers, storage, scenario branching,
  allocation, savings planning, serialization, sharing, and end-to-end flows.
- **FinOps awareness:** budget health, cost-driver analysis, and scenario
  comparison framed the way a cloud engineer reasons about spend.

## License

MIT. See [LICENSE](LICENSE).
