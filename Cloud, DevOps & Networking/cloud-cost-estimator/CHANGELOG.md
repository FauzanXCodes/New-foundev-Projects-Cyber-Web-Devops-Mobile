# Changelog

All notable changes to this project are documented here. This project adheres to
semantic-versioning-style headings.

## 4.0.0 - Decision resilience

### Added

- Explicit EC2 and RDS commitment coverage/discount assumptions with gross,
  modeled-saving, and net-cost evidence across estimates, forecasts, exports,
  scenarios, and comparisons.
- A bounded low/base/high rate-sensitivity envelope, a forecast stress view, and
  a CSV export for review evidence.
- A non-scored decision-readiness checklist covering review context, budget,
  contingency, rate sensitivity, forecast budget behaviour, and commitment evidence.

### Changed

- Scenario cards and comparisons now make commitment-policy and rate-sensitivity
  differences visible instead of leaving them implicit in a total-cost delta.
- Forecast CSVs now keep gross, commitment-saving, and net-cost values distinct.

### Fixed

- The offline app shell caches the commitment, risk, and readiness modules and
  uses a new cache version so updated installs receive the complete V4 workspace.

## 3.0.0 - Planning forecasts

### Added

- A portable planning profile with bounded horizon, monthly growth, contingency
  reserve, and estimate owner/cost-centre/review context.
- Transparent monthly cash-flow forecasts, forecast CSV export, and an
  accessible shared-horizon summary in scenario comparisons.
- Forecast-aware recommendations and savings targets that distinguish current
  overages from a budget crossing later in the planning period.
- Scenario decision status, short notes, filtering, and more scannable cards.
- A print-ready estimate report that includes planning context and cash flow.

### Changed

- The estimate total, budget check, allocation, charts, and forecasts now make
  an explicit contingency reserve visible rather than silently blending it into
  modeled service cost.

### Fixed

- The offline app shell now caches the forecast module and uses a new cache
  version, so existing installs receive the planning experience after update.

## Unreleased

### Added

- Local estimate names for readable exports without exposing labels in share URLs.
- An optional labelled allowance for AWS services outside the bundled sample
  models, plus an accessible cost allocation report.
- Transparent savings targets that quantify the monthly, annual, and daily gap
  to a configured budget without pretending to predict discounts.
- Scenario duplication, native sharing with clipboard fallback, and one-step
  reset undo.
- GitHub Pages deployment workflow and social/search metadata for the live app.

### Changed

- Scenario storage now normalizes names, preserves uniqueness, and caps saved
  entries at 50 to remain resilient in browser storage.

### Security

- JSON imports validate file metadata and enforce a 1 MB size limit before
  reading untrusted content.

### Fixed

- Centralized finite planning limits for every numeric workload input, including
  editable rates, storage, requests, data transfer, and budget values.
- Canonicalized imported, persisted, and shared region/service identifiers so
  malformed state always remains representable by the form.
- Synced browser number constraints with the calculation model and reconciled
  pasted out-of-range values immediately.

## 2.0.0 - FinOps workbench

A major expansion from a simple EC2/EBS estimator into a multi-service planning
workbench.

### Added

- Normalized, DOM-independent workload/estimate model with a service registry.
- Region-aware sample pricing for US East (N. Virginia), US West (Oregon),
  Asia Pacific (Sydney), and Europe (Ireland).
- Expanded EC2 (quantity, runtime, presets) and EBS (volume count, per-volume
  size, enable/disable) estimation.
- New optional service models: S3 object storage, RDS database, and outbound
  data transfer.
- Budget intelligence: annualized total, budget-used percent, remaining/overage,
  healthy/watch/risk/over classification, an accessible progress bar, and
  deterministic recommendations from the largest cost drivers.
- Complete multi-service workload presets.
- Named scenario management (save, load, rename, delete) with versioned,
  defensive local storage.
- Scenario comparison with per-service and total monthly/annual deltas.
- Accessible SVG cost breakdown chart with a text legend equivalent.
- JSON export/import (with schema validation), CSV export, and shareable URLs.
- Light, dark, and system themes with a persisted preference.
- Static quality gate and a CI matrix across Node 20, 22, and 24.

### Changed

- Rebuilt the interface as a coherent, token-based FinOps dashboard with a
  single accent, one radius scale, and full light/dark support.
- Removed the oversized marketing hero and decorative panels; the calculator is
  now the visual centre.
- Replaced `innerHTML` rendering with safe DOM construction throughout.
- Rewrote and corrected all project documentation.

### Fixed

- Corrupted documentation (encoding artefacts and escaped markdown).
- Colour-only budget signalling; state now has a text label.

## 1.0.0 - Initial release

### Added

- EC2 monthly compute estimate and EBS storage estimate.
- Monthly total and a budget warning system.
- Usage presets for common monthly-hour patterns and editable sample rates.
- Local browser state saving and a reset-to-defaults action.
- Node test suite and a GitHub Actions validation workflow.
- GitHub Pages-compatible static frontend and supporting documentation.
