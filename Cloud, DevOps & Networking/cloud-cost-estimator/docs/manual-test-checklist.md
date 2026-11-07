# Manual Test Checklist

Run through this before publishing changes. Pair it with `npm run validate`.

## Load and defaults

- [ ] The page loads with no console errors and no failed local assets.
- [ ] The default estimate shows `$9.99/month` and a "Healthy" budget status.
- [ ] Region, instance, volume, and S3/RDS class selects are populated.
- [ ] Estimate name persists locally, creates readable export names, and does
  not appear in the copied share URL.

## Services

- [ ] Changing EC2 instances, hours, or rate updates the estimate.
- [ ] Pasting a value above a numeric field's maximum corrects it immediately,
  and the displayed value matches the capped estimate.
- [ ] Changing EBS volumes, size, or rate updates the estimate.
- [ ] Enabling S3 adds storage and request line items.
- [ ] Enabling RDS adds instance and storage line items.
- [ ] Enabling data transfer adds an outbound line item.
- [ ] Enabling Other AWS services adds the labelled monthly allowance, and its
  label is shown in the forecast.
- [ ] Disabling a service dims it, disables its inputs, and removes it from the total.

## Region and presets

- [ ] Switching region re-syncs rates (Sydney is pricier than N. Virginia).
- [ ] Each workload preset updates the whole configuration and marks the chip pressed.
- [ ] Editing any field clears the pressed preset chip.
- [ ] Runtime presets set EC2 monthly hours.

## Budget health

- [ ] A budget above the estimate shows healthy/watch and the progress bar fills.
- [ ] A budget below the estimate shows "Over budget" and an overage amount.
- [ ] A zero budget shows "No budget set" and `n/a` for percent/remaining.
- [ ] Recommendations name the largest cost driver and read sensibly.
- [ ] An over-budget estimate shows exact monthly, annual, and daily savings
  targets; an under-budget estimate reports headroom instead.

## Planning profile and forecast

- [ ] Changing horizon, monthly growth, or contingency immediately changes the
  forecast and persists after reload.
- [ ] A contingency reserve is shown separately from modeled service costs and
  is included in the total, budget check, allocation, export, and forecast.
- [ ] EC2/RDS commitment coverage and covered-cost discounts show gross, modeled
  saving, and commitment-adjusted totals without changing non-eligible services.
- [ ] Rate sensitivity shows low/base/high monthly cases and names the high-case
  forecast budget crossing when one exists.
- [ ] The decision-readiness panel has explicit Ready, Attention, and Info rows;
  it never presents a composite readiness score.
- [ ] With growth that crosses a budget later, recommendations and savings
  planning name the first crossing month and the final-month/cumulative gap.
- [ ] Forecast CSV has a row for each month, separate gross/net commitment values,
  signed budget differences, and a horizon-total row; a zero budget leaves the
  difference blank rather than inventing one.
- [ ] Owner, cost centre, and review note appear in the result context only
  when supplied and round-trip through JSON, local storage, and shared links.
- [ ] A negative monthly cost change produces a declining forecast with an
  accurate final-month amount and no misleading growth copy.
- [ ] The forecast summary includes average monthly spend and the count of
  over-budget months (or clearly says when no budget is set).

## Cost breakdown

- [ ] The donut and legend show each enabled service's share and amount.
- [ ] Zeroing all services shows the breakdown empty state.
- [ ] The allocation report ranks active services, calculates shares correctly,
  and stacks into readable rows on a narrow screen.

## Scenarios

- [ ] Saving names the scenario, shows its monthly total, and hides the empty state.
- [ ] Decision status and note save with the scenario, appear on its card, and
  survive duplicate, reload, and JSON-safe workload changes.
- [ ] Filtering by decision status changes only the visible cards; comparison
  targets still include all saved scenarios.
- [ ] Load restores a saved workload; Duplicate creates a separately named copy;
  Rename and Delete work.
- [ ] Reset defaults restores only the working estimate; saved scenarios remain
  available until the explicit **Clear saved scenarios** action is confirmed.
- [ ] Clearing saved scenarios removes every scenario without changing the active
  estimate, and a cancelled confirmation leaves the list intact.
- [ ] Reloading the page does not break the calculator with saved state present.
- [ ] More than 50 saved scenarios keeps the newest 50; duplicate/invalid stored
  names do not break scenario controls.

## Comparison

- [ ] Selecting a saved scenario shows per-service and total monthly/annual deltas.
- [ ] The summary states which side is cheaper; equal totals are handled.
- [ ] The forecast summary uses the shared planning horizon and explicitly
  warns when the two scenarios use different horizons.
- [ ] The comparison names any difference in commitment policy or rate sensitivity
  separately from workload cost differences.
- [ ] The comparison table stacks into cards on a narrow screen.

## Export, import, share

- [ ] Export JSON and Export CSV download files with readable names.
- [ ] Export forecast CSV downloads the projected monthly cash flow.
- [ ] Export sensitivity CSV downloads the low/base/high cases with honest budget states.
- [ ] Copy review brief includes the sample-pricing disclaimer, current estimate,
  forecast assumptions, readiness evidence, and any supplied review context.
- [ ] Importing an exported JSON file restores the workload.
- [ ] Importing malformed JSON shows an error, not a crash.
- [ ] Importing a non-JSON or file larger than 1 MB shows a clear error before
  the file is read.
- [ ] Copy share link produces a URL; opening it loads that workload.
- [ ] Share estimate opens the native share sheet when supported and otherwise
  falls back to copying a link.
- [ ] A malformed `?s=` link falls back to the saved estimate with a notice.
- [ ] An imported or shared workload with unknown region/service option ids
  falls back to supported form selections without breaking the UI.
- [ ] Reset defaults exposes Undo reset and restores the exact prior workload.
- [ ] Print report uses a light, uncluttered page that includes estimate context,
  line items, allocation, and all forecast months without controls.

## Theme and reduced motion

- [ ] System, Light, and Dark toggle the theme and persist across reloads.
- [ ] Both themes are readable with no clipped or low-contrast text.
- [ ] With reduced motion enabled, transitions and smooth scrolling are disabled.

## Responsive

- [ ] No horizontal overflow at 1440, 1024, 768, 390, and 320 px.
- [ ] No overlapping controls or cut-off text at any width.
- [ ] Inputs remain usable and labels readable on small screens.

## Keyboard and focus

- [ ] The skip link is the first focusable element and works.
- [ ] Every control is reachable by keyboard with a visible focus ring.
