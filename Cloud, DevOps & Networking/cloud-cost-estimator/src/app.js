import {
  budgetStateLabel,
  estimateWorkload,
  formatPercent,
  formatRate,
  formatUsd,
  getBudgetMessage,
} from './calculator.js';
import { buildRecommendations } from './recommendations.js';
import { buildAnnualRollups, buildForecast, compareForecasts } from './forecast.js';
import { createDonutSvg, createLegendItems } from './charts.js';
import {
  LIMITS,
  createDefaultWorkload,
  listPresets,
  normalizeWorkload,
  presetWorkload,
} from './state.js';
import {
  clearScenarios,
  deleteScenario,
  duplicateScenario,
  filterScenarios,
  getBaseline,
  getScenario,
  loadScenarios,
  renameScenario,
  resolveStorage,
  restoreScenario,
  saveScenario,
  setBaseline,
  SCENARIO_TAGS,
} from './scenarios.js';
import { compareEstimates, comparePlanningPolicies } from './compare.js';
import { buildFilename, parseImport, toCsv, toForecastCsv, toJson, toSensitivityCsv, validateImportFile } from './export.js';
import { buildShareUrl, canUseWebShare, hasShareParam, parseShareParam } from './share.js';
import { applyTheme, loadThemePreference, saveThemePreference } from './theme.js';
import { normalizeEstimateName } from './estimate-name.js';
import { allocateSavingsTarget, buildForecastSavingsPlan, buildSavingsPlan } from './savings.js';
import { allocationSummary, buildAllocationRows, commitmentAllocationSummary } from './allocation.js';
import { summarizeCommitmentPolicy } from './commitments.js';
import { buildRateSensitivity, buildRateSensitivityForecast } from './risk.js';
import { buildDecisionReadiness } from './readiness.js';
import { captureWorkloadSnapshot } from './undo.js';
import { buildReviewBrief } from './review-brief.js';
import { buildRateAudit } from './rate-audit.js';
import { buildBudgetMilestones } from './budget-milestones.js';
import {
  DEFAULT_REGION,
  PRICING_NOTES,
  getRate,
  getRegion,
  getScalarRate,
  getServiceOptions,
  listRegions,
} from './pricing.js';

const form = document.querySelector('[data-calculator-form]');
const estimateNameInput = document.querySelector('#estimate-name');
const regionSelect = document.querySelector('#region');
const instanceSelect = document.querySelector('#ec2-instance');
const storageSelect = document.querySelector('#storage-type');
const ec2QuantityInput = document.querySelector('#ec2-quantity');
const ec2HoursInput = document.querySelector('#ec2-hours');
const ec2RateInput = document.querySelector('#ec2-rate');
const ebsEnabledInput = document.querySelector('#ebs-enabled');
const ebsVolumesInput = document.querySelector('#ebs-volumes');
const storageGbInput = document.querySelector('#storage-gb');
const storageRateInput = document.querySelector('#storage-rate');
const s3EnabledInput = document.querySelector('#s3-enabled');
const s3ClassSelect = document.querySelector('#s3-class');
const s3StorageInput = document.querySelector('#s3-storage');
const s3RateInput = document.querySelector('#s3-rate');
const s3RequestsInput = document.querySelector('#s3-requests');
const s3RequestRateInput = document.querySelector('#s3-request-rate');
const rdsEnabledInput = document.querySelector('#rds-enabled');
const rdsEngineSelect = document.querySelector('#rds-engine');
const rdsClassSelect = document.querySelector('#rds-class');
const rdsQuantityInput = document.querySelector('#rds-quantity');
const rdsHoursInput = document.querySelector('#rds-hours');
const rdsRateInput = document.querySelector('#rds-rate');
const rdsStorageInput = document.querySelector('#rds-storage');
const rdsStorageRateInput = document.querySelector('#rds-storage-rate');
const dtEnabledInput = document.querySelector('#dataTransfer-enabled');
const dtGbInput = document.querySelector('#dt-gb');
const dtRateInput = document.querySelector('#dt-rate');
const additionalEnabledInput = document.querySelector('#additional-enabled');
const additionalLabelInput = document.querySelector('#additional-label');
const additionalCostInput = document.querySelector('#additional-cost');
const budgetInput = document.querySelector('#budget');
const planningHorizonInput = document.querySelector('#planning-horizon');
const monthlyGrowthInput = document.querySelector('#monthly-growth');
const contingencyInput = document.querySelector('#contingency-percent');
const rateVarianceInput = document.querySelector('#rate-variance-percent');
const ec2CoverageInput = document.querySelector('#ec2-coverage-percent');
const ec2DiscountInput = document.querySelector('#ec2-discount-percent');
const rdsCoverageInput = document.querySelector('#rds-coverage-percent');
const rdsDiscountInput = document.querySelector('#rds-discount-percent');
const ownerInput = document.querySelector('#estimate-owner');
const costCenterInput = document.querySelector('#cost-center');
const notesInput = document.querySelector('#estimate-notes');
const budgetMessage = document.querySelector('[data-budget-message]');
const resultCard = document.querySelector('[data-result-card]');
const lineItems = document.querySelector('[data-line-items]');
const totalOutput = document.querySelector('[data-total]');
const annualOutput = document.querySelector('[data-annual]');
const contingencySummary = document.querySelector('[data-contingency-summary]');
const commitmentImpact = document.querySelector('[data-commitment-impact]');
const commitmentGrossOutput = document.querySelector('[data-commitment-gross]');
const commitmentSavingsOutput = document.querySelector('[data-commitment-savings]');
const commitmentNetOutput = document.querySelector('[data-commitment-net]');
const commitmentSummaryOutput = document.querySelector('[data-commitment-summary]');
const reportContext = document.querySelector('[data-report-context]');
const estimateUpdate = document.querySelector('[data-estimate-update]');
const statusBadge = document.querySelector('[data-status-badge]');
const budgetPercentOutput = document.querySelector('[data-budget-percent]');
const progressEl = document.querySelector('[data-progress]');
const progressFill = document.querySelector('[data-progress-fill]');
const budgetAmountOutput = document.querySelector('[data-budget-amount]');
const remainingLabel = document.querySelector('[data-remaining-label]');
const remainingOutput = document.querySelector('[data-remaining]');
const recommendationList = document.querySelector('[data-recommendations]');
const savingsSummary = document.querySelector('[data-savings-summary]');
const savingsTargets = document.querySelector('[data-savings-targets]');
const allocationSummaryOutput = document.querySelector('[data-allocation-summary]');
const allocationEmpty = document.querySelector('[data-allocation-empty]');
const allocationBody = document.querySelector('[data-allocation-body]');
const allocationRows = document.querySelector('[data-allocation-rows]');
const forecastSummaryOutput = document.querySelector('[data-forecast-summary]');
const forecastHorizonOutput = document.querySelector('[data-forecast-horizon]');
const forecastGrowthOutput = document.querySelector('[data-forecast-growth]');
const forecastFinalOutput = document.querySelector('[data-forecast-final]');
const forecastAverageOutput = document.querySelector('[data-forecast-average]');
const forecastTotalOutput = document.querySelector('[data-forecast-total]');
const forecastBudgetMonthsOutput = document.querySelector('[data-forecast-budget-months]');
const forecastCommitmentSavingsOutput = document.querySelector('[data-forecast-commitment-savings]');
const forecastRows = document.querySelector('[data-forecast-rows]');
const forecastAnnualRows = document.querySelector('[data-forecast-annual-rows]');
const budgetMilestoneSummary = document.querySelector('[data-budget-milestone-summary]');
const budgetMilestoneRows = document.querySelector('[data-budget-milestone-rows]');
const riskSummaryOutput = document.querySelector('[data-risk-summary]');
const riskLowOutput = document.querySelector('[data-risk-low]');
const riskBaseOutput = document.querySelector('[data-risk-base]');
const riskHighOutput = document.querySelector('[data-risk-high]');
const riskRows = document.querySelector('[data-risk-rows]');
const readinessSummaryOutput = document.querySelector('[data-readiness-summary]');
const readinessChecks = document.querySelector('[data-readiness-checks]');
const rateAuditSummary = document.querySelector('[data-rate-audit-summary]');
const rateAuditRows = document.querySelector('[data-rate-audit-rows]');
const breakdownBody = document.querySelector('[data-breakdown-body]');
const breakdownEmpty = document.querySelector('[data-breakdown-empty]');
const breakdownChart = document.querySelector('[data-breakdown-chart]');
const breakdownLegend = document.querySelector('[data-breakdown-legend]');
const noteOutput = document.querySelector('[data-pricing-note]');
const regionTag = document.querySelector('[data-region-tag]');
const presetButtons = document.querySelectorAll('[data-hours-preset]');
const presetBar = document.querySelector('[data-preset-buttons]');
const resetButton = document.querySelector('[data-reset]');
const undoResetButton = document.querySelector('[data-undo-reset]');
const scenarioForm = document.querySelector('[data-scenario-form]');
const scenarioNameInput = document.querySelector('#scenario-name');
const scenarioTagInput = document.querySelector('#scenario-tag');
const scenarioDescriptionInput = document.querySelector('#scenario-description');
const scenarioFilterInput = document.querySelector('#scenario-filter');
const scenarioList = document.querySelector('[data-scenario-list]');
const scenarioEmpty = document.querySelector('[data-scenario-empty]');
const scenarioFilterEmpty = document.querySelector('[data-scenario-filter-empty]');
const scenarioUndoButton = document.querySelector('[data-scenario-undo]');
const clearScenariosButton = document.querySelector('[data-scenarios-clear]');
const scenarioFeedback = document.querySelector('[data-scenario-feedback]');
const compareTarget = document.querySelector('[data-compare-target]');
const compareEmpty = document.querySelector('[data-compare-empty]');
const compareBody = document.querySelector('[data-compare-body]');
const compareSummary = document.querySelector('[data-compare-summary]');
const forecastCompareSummary = document.querySelector('[data-forecast-compare-summary]');
const policyCompareSummary = document.querySelector('[data-policy-compare-summary]');
const compareRows = document.querySelector('[data-compare-rows]');
const compareFoot = document.querySelector('[data-compare-foot]');
const compareOtherLabel = document.querySelector('[data-compare-other-label]');
const exportJsonButton = document.querySelector('[data-export-json]');
const exportCsvButton = document.querySelector('[data-export-csv]');
const exportForecastCsvButton = document.querySelector('[data-export-forecast-csv]');
const exportSensitivityCsvButton = document.querySelector('[data-export-sensitivity-csv]');
const printReportButton = document.querySelector('[data-print-report]');
const copyReviewBriefButton = document.querySelector('[data-copy-review-brief]');
const copyLinkButton = document.querySelector('[data-copy-link]');
const nativeShareButton = document.querySelector('[data-share-native]');
const importInput = document.querySelector('[data-import]');
const shareFeedback = document.querySelector('[data-share-feedback]');
const themeButtons = document.querySelectorAll('[data-theme-choice]');
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

const scenarioStorage = resolveStorage();
let editingScenarioId = null;
let resetSnapshot = null;
let deletedScenario = null;

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const STORAGE_KEY = 'cloud-cost-calculator-workload';
const ESTIMATE_NAME_STORAGE_KEY = 'cloud-cost-calculator-estimate-name';

/** Keep the browser's native number constraints aligned with state.js. */
const NUMERIC_INPUT_LIMITS = new Map([
  [ec2QuantityInput, LIMITS.ec2Quantity],
  [ec2HoursInput, LIMITS.ec2Hours],
  [ec2RateInput, LIMITS.ec2Rate],
  [ebsVolumesInput, LIMITS.ebsVolumes],
  [storageGbInput, LIMITS.ebsSizeGb],
  [storageRateInput, LIMITS.ebsRate],
  [s3StorageInput, LIMITS.s3StorageGb],
  [s3RateInput, LIMITS.s3Rate],
  [s3RequestsInput, LIMITS.s3Requests],
  [s3RequestRateInput, LIMITS.s3RequestRate],
  [rdsQuantityInput, LIMITS.rdsQuantity],
  [rdsHoursInput, LIMITS.rdsHours],
  [rdsRateInput, LIMITS.rdsInstanceRate],
  [rdsStorageInput, LIMITS.rdsStorageGb],
  [rdsStorageRateInput, LIMITS.rdsStorageRate],
  [dtGbInput, LIMITS.dataTransferGb],
  [dtRateInput, LIMITS.dataTransferRate],
  [additionalCostInput, LIMITS.additionalMonthlyCost],
  [budgetInput, LIMITS.budget],
  [planningHorizonInput, LIMITS.planningHorizonMonths],
  [monthlyGrowthInput, LIMITS.monthlyGrowthPercent],
  [contingencyInput, LIMITS.contingencyPercent],
  [rateVarianceInput, LIMITS.rateVariancePercent],
  [ec2CoverageInput, LIMITS.commitmentCoveragePercent],
  [ec2DiscountInput, LIMITS.commitmentDiscountPercent],
  [rdsCoverageInput, LIMITS.commitmentCoveragePercent],
  [rdsDiscountInput, LIMITS.commitmentDiscountPercent],
]);

/** Optional services that can be toggled on/off from their section header. */
const OPTIONAL_SERVICES = ['ebs', 's3', 'rds', 'dataTransfer', 'additional'];

/** Visually and functionally disable a service section when it is switched off. */
function reflectServiceEnabled(serviceId, enabled) {
  const section = document.querySelector(`[data-service-section="${serviceId}"]`);
  if (!section) {
    return;
  }
  section.classList.toggle('is-disabled', !enabled);
  section
    .querySelectorAll('[data-service-fields] input, [data-service-fields] select')
    .forEach((element) => {
      element.disabled = !enabled;
    });
}

function applyNumericInputLimits() {
  NUMERIC_INPUT_LIMITS.forEach((limit, input) => {
    input.max = String(limit);
  });
}

function populateRegions(select) {
  select.replaceChildren();
  listRegions().forEach(({ id, label }) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label;
    select.append(option);
  });
}

/** Populate a service select from region option data, preserving selection. */
function populateServiceOptions(select, options, preferredValue) {
  const previous = preferredValue ?? select.value;
  select.replaceChildren();
  options.forEach(({ id, label, spec }) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = spec ? `${label} · ${spec}` : label;
    select.append(option);
  });
  if (options.some((option) => option.id === previous)) {
    select.value = previous;
  }
}

function currentRegion() {
  return regionSelect.value || DEFAULT_REGION;
}

function populatePresets() {
  presetBar.replaceChildren();
  listPresets().forEach((preset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-chip';
    button.dataset.preset = preset.id;
    button.setAttribute('aria-pressed', 'false');
    button.title = preset.description;
    button.textContent = preset.name;
    button.addEventListener('click', () => applyPreset(preset.id, button));
    presetBar.append(button);
  });
}

function applyPreset(presetId, button) {
  clearResetUndo();
  writeWorkload(presetWorkload(presetId, currentRegion()));
  render();
  button.setAttribute('aria-pressed', 'true');
}

/** Deselect any active preset chip (called whenever the config diverges). */
function clearPresetSelection() {
  presetBar
    .querySelectorAll('[data-preset]')
    .forEach((button) => button.setAttribute('aria-pressed', 'false'));
}

function loadWorkload() {
  try {
    const raw = scenarioStorage.getItem(STORAGE_KEY);
    return raw ? normalizeWorkload(JSON.parse(raw)) : createDefaultWorkload();
  } catch {
    return createDefaultWorkload();
  }
}

function saveWorkload(workload) {
  try {
    scenarioStorage.setItem(STORAGE_KEY, JSON.stringify(workload));
  } catch {
    /* storage may be unavailable (private mode); estimates still work in-memory */
  }
}

function populateScenarioTags() {
  scenarioTagInput.replaceChildren();
  scenarioFilterInput.replaceChildren();

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All statuses';
  scenarioFilterInput.append(allOption);

  SCENARIO_TAGS.forEach((tag) => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag === 'untagged' ? 'No tag' : `${tag[0].toUpperCase()}${tag.slice(1)}`;
    scenarioTagInput.append(option);

    const filterOption = option.cloneNode(true);
    scenarioFilterInput.append(filterOption);
  });
}

function clearResetUndo() {
  resetSnapshot = null;
  undoResetButton.hidden = true;
}

function loadEstimateName() {
  try {
    return normalizeEstimateName(scenarioStorage.getItem(ESTIMATE_NAME_STORAGE_KEY));
  } catch {
    return normalizeEstimateName();
  }
}

function saveEstimateName(value) {
  const name = normalizeEstimateName(value);
  try {
    scenarioStorage.setItem(ESTIMATE_NAME_STORAGE_KEY, name);
  } catch {
    /* storage may be unavailable (private mode); the current label still works */
  }
  return name;
}

/** Read the current form controls into a normalized workload. */
function readWorkload() {
  return normalizeWorkload({
    region: currentRegion(),
    budget: budgetInput.value,
    planning: {
      horizonMonths: planningHorizonInput.value,
      monthlyGrowthPercent: monthlyGrowthInput.value,
      contingencyPercent: contingencyInput.value,
      rateVariancePercent: rateVarianceInput.value,
    },
    optimization: {
      ec2CoveragePercent: ec2CoverageInput.value,
      ec2DiscountPercent: ec2DiscountInput.value,
      rdsCoveragePercent: rdsCoverageInput.value,
      rdsDiscountPercent: rdsDiscountInput.value,
    },
    metadata: {
      owner: ownerInput.value,
      costCenter: costCenterInput.value,
      notes: notesInput.value,
    },
    services: {
      ec2: {
        enabled: true,
        instanceType: instanceSelect.value,
        quantity: ec2QuantityInput.value,
        hours: ec2HoursInput.value,
        rate: ec2RateInput.value,
      },
      ebs: {
        enabled: ebsEnabledInput.checked,
        volumeType: storageSelect.value,
        volumes: ebsVolumesInput.value,
        sizeGb: storageGbInput.value,
        rate: storageRateInput.value,
      },
      s3: {
        enabled: s3EnabledInput.checked,
        storageClass: s3ClassSelect.value,
        storageGb: s3StorageInput.value,
        rate: s3RateInput.value,
        requests: s3RequestsInput.value,
        requestRate: s3RequestRateInput.value,
      },
      rds: {
        enabled: rdsEnabledInput.checked,
        engine: rdsEngineSelect.value,
        instanceClass: rdsClassSelect.value,
        quantity: rdsQuantityInput.value,
        hours: rdsHoursInput.value,
        instanceRate: rdsRateInput.value,
        storageGb: rdsStorageInput.value,
        storageRate: rdsStorageRateInput.value,
      },
      dataTransfer: {
        enabled: dtEnabledInput.checked,
        outboundGb: dtGbInput.value,
        rate: dtRateInput.value,
      },
      additional: {
        enabled: additionalEnabledInput.checked,
        label: additionalLabelInput.value,
        monthlyCost: additionalCostInput.value,
      },
    },
  });
}

/** Push a workload back into the form controls, syncing region option sets. */
function writeWorkload(workload) {
  const normalized = normalizeWorkload(workload);
  regionSelect.value = normalized.region;
  populateServiceOptions(instanceSelect, getServiceOptions(normalized.region, 'ec2'), normalized.services.ec2.instanceType);
  populateServiceOptions(storageSelect, getServiceOptions(normalized.region, 'ebs'), normalized.services.ebs.volumeType);
  ec2QuantityInput.value = normalized.services.ec2.quantity;
  ec2HoursInput.value = normalized.services.ec2.hours;
  ec2RateInput.value = normalized.services.ec2.rate;
  ebsEnabledInput.checked = normalized.services.ebs.enabled;
  ebsVolumesInput.value = normalized.services.ebs.volumes;
  storageGbInput.value = normalized.services.ebs.sizeGb;
  storageRateInput.value = normalized.services.ebs.rate;
  s3EnabledInput.checked = normalized.services.s3.enabled;
  populateServiceOptions(s3ClassSelect, getServiceOptions(normalized.region, 's3'), normalized.services.s3.storageClass);
  s3StorageInput.value = normalized.services.s3.storageGb;
  s3RateInput.value = normalized.services.s3.rate;
  s3RequestsInput.value = normalized.services.s3.requests;
  s3RequestRateInput.value = normalized.services.s3.requestRate;
  rdsEnabledInput.checked = normalized.services.rds.enabled;
  rdsEngineSelect.value = normalized.services.rds.engine;
  populateServiceOptions(rdsClassSelect, getServiceOptions(normalized.region, 'rds'), normalized.services.rds.instanceClass);
  rdsQuantityInput.value = normalized.services.rds.quantity;
  rdsHoursInput.value = normalized.services.rds.hours;
  rdsRateInput.value = normalized.services.rds.instanceRate;
  rdsStorageInput.value = normalized.services.rds.storageGb;
  rdsStorageRateInput.value = normalized.services.rds.storageRate;
  dtEnabledInput.checked = normalized.services.dataTransfer.enabled;
  dtGbInput.value = normalized.services.dataTransfer.outboundGb;
  dtRateInput.value = normalized.services.dataTransfer.rate;
  additionalEnabledInput.checked = normalized.services.additional.enabled;
  additionalLabelInput.value = normalized.services.additional.label;
  additionalCostInput.value = normalized.services.additional.monthlyCost;
  budgetInput.value = normalized.budget;
  planningHorizonInput.value = normalized.planning.horizonMonths;
  monthlyGrowthInput.value = normalized.planning.monthlyGrowthPercent;
  contingencyInput.value = normalized.planning.contingencyPercent;
  rateVarianceInput.value = normalized.planning.rateVariancePercent;
  ec2CoverageInput.value = normalized.optimization.ec2CoveragePercent;
  ec2DiscountInput.value = normalized.optimization.ec2DiscountPercent;
  rdsCoverageInput.value = normalized.optimization.rdsCoveragePercent;
  rdsDiscountInput.value = normalized.optimization.rdsDiscountPercent;
  ownerInput.value = normalized.metadata.owner;
  costCenterInput.value = normalized.metadata.costCenter;
  notesInput.value = normalized.metadata.notes;

  OPTIONAL_SERVICES.forEach((serviceId) => {
    reflectServiceEnabled(serviceId, normalized.services[serviceId].enabled);
  });
}

function buildLineItem(label, value) {
  const li = document.createElement('li');
  const name = document.createElement('span');
  name.textContent = label;
  const amount = document.createElement('strong');
  amount.textContent = value;
  li.append(name, amount);
  return li;
}

function renderLineItems(estimate) {
  lineItems.replaceChildren();
  if (estimate.lineItems.length === 0) {
    lineItems.append(buildLineItem('No services enabled', formatUsd(0)));
    return;
  }
  estimate.lineItems.forEach((item) => {
    lineItems.append(buildLineItem(item.label, formatUsd(item.amount)));
  });
}

function renderBudgetHealth(estimate) {
  annualOutput.textContent = formatUsd(estimate.annualTotal);
  statusBadge.textContent = budgetStateLabel(estimate.budgetStatus);
  budgetAmountOutput.textContent = formatUsd(estimate.budget);

  const hasBudget = estimate.budgetStatus !== 'no-budget';
  budgetPercentOutput.textContent = hasBudget ? formatPercent(estimate.budgetUsedPercent) : 'n/a';

  const percent = hasBudget ? Math.min(100, estimate.budgetUsedPercent) : 0;
  progressFill.style.width = `${percent}%`;
  progressEl.setAttribute('aria-valuenow', String(Math.round(percent)));
  progressEl.setAttribute(
    'aria-valuetext',
    hasBudget
      ? `${formatPercent(estimate.budgetUsedPercent)} of budget used`
      : 'No budget set',
  );

  if (estimate.overBudget) {
    remainingLabel.textContent = 'Over by';
    remainingOutput.textContent = formatUsd(estimate.overage);
  } else {
    remainingLabel.textContent = 'Remaining';
    remainingOutput.textContent = hasBudget ? formatUsd(estimate.remaining) : 'n/a';
  }

  budgetMessage.textContent = getBudgetMessage(estimate);
}

function renderCommitmentImpact(estimate) {
  const summary = commitmentAllocationSummary(estimate);
  commitmentImpact.hidden = summary.savings <= 0;
  if (summary.savings <= 0) {
    return;
  }

  commitmentGrossOutput.textContent = formatUsd(summary.grossTotal);
  commitmentSavingsOutput.textContent = `-${formatUsd(summary.savings)}`;
  commitmentNetOutput.textContent = formatUsd(summary.netTotal);
  commitmentSummaryOutput.textContent = summary.largest
    ? `${summary.largest.label} accounts for ${formatUsd(summary.largest.savings)}/mo of the modeled saving.`
    : 'The adjusted total reflects the current commitment coverage and discount assumptions.';
}

function renderReportContext(metadata) {
  const context = [
    ['Owner', metadata.owner],
    ['Cost center', metadata.costCenter],
    ['Review note', metadata.notes],
  ].filter(([, value]) => value);

  reportContext.hidden = context.length === 0;
  reportContext.replaceChildren();
  context.forEach(([label, value]) => {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    item.append(term, detail);
    reportContext.append(item);
  });
}

function announceEstimateUpdate() {
  const estimate = estimateWorkload(readWorkload());
  const budgetStatus =
    estimate.budgetStatus === 'no-budget'
      ? 'No monthly budget set.'
      : `${budgetStateLabel(estimate.budgetStatus)} budget status.`;
  estimateUpdate.textContent = `Updated monthly estimate: ${formatUsd(estimate.total)}. ${budgetStatus}`;
}

function renderRecommendations(estimate, forecast) {
  recommendationList.replaceChildren();
  buildRecommendations(estimate, forecast).forEach((recommendation) => {
    const item = document.createElement('li');
    item.className = 'recommendation';
    item.dataset.severity = recommendation.severity;
    const title = document.createElement('strong');
    title.textContent = recommendation.title;
    const detail = document.createElement('span');
    detail.textContent = recommendation.detail;
    item.append(title, detail);
    recommendationList.append(item);
  });
}

function renderForecast(forecast) {
  forecastHorizonOutput.textContent = `${forecast.horizonMonths} months`;
  forecastGrowthOutput.textContent = formatPercent(forecast.monthlyGrowthPercent);
  forecastFinalOutput.textContent = formatUsd(forecast.finalMonthTotal);
  forecastAverageOutput.textContent = formatUsd(forecast.averageMonthlyTotal);
  forecastTotalOutput.textContent = formatUsd(forecast.horizonTotal);
  forecastBudgetMonthsOutput.textContent = forecast.budget > 0
    ? `${forecast.monthsOverBudget} of ${forecast.horizonMonths}`
    : 'No budget';
  forecastCommitmentSavingsOutput.textContent = formatUsd(forecast.horizonCommitmentSavings);
  const growthDetail = forecast.monthlyTrend === 'growth'
    ? `grows from ${formatUsd(forecast.baseMonthlyTotal)}/mo to ${formatUsd(forecast.finalMonthTotal)}/mo`
    : forecast.monthlyTrend === 'decline'
      ? `declines from ${formatUsd(forecast.baseMonthlyTotal)}/mo to ${formatUsd(forecast.finalMonthTotal)}/mo`
      : `holds at ${formatUsd(forecast.baseMonthlyTotal)}/mo`;
  const budgetDetail = forecast.firstOverBudgetMonth
    ? ` It first exceeds the budget in month ${forecast.firstOverBudgetMonth}.`
    : forecast.budget > 0
      ? ' It remains within the monthly budget across this horizon.'
      : '';
  const commitmentDetail = forecast.horizonCommitmentSavings > 0
    ? ` Modeled commitment assumptions reduce the horizon by ${formatUsd(forecast.horizonCommitmentSavings)}.`
    : '';
  forecastSummaryOutput.textContent = `Over ${forecast.horizonMonths} months, this plan ${growthDetail} for ${formatUsd(forecast.horizonTotal)} in projected spend.${budgetDetail}${commitmentDetail}`;

  forecastRows.replaceChildren();
  forecast.months.forEach((month) => {
    const tr = document.createElement('tr');
    const budgetDifference = month.budgetDelta === null
      ? 'No budget'
      : month.overBudget
        ? `Over ${formatUsd(Math.abs(month.budgetDelta))}`
        : `${formatUsd(month.budgetDelta)} remaining`;
    tr.append(
      cell(month.label, 'forecast-month'),
      cell(formatUsd(month.amount), 'num', 'Projected cost'),
      cell(formatUsd(month.commitmentSavings), 'num', 'Commitment saving'),
      cell(budgetDifference, 'num', 'Budget difference'),
      cell(month.budgetDelta === null ? 'No budget set' : month.overBudget ? 'Over budget' : 'Within budget', 'num', 'Status'),
    );
    forecastRows.append(tr);
  });
}

function renderRateSensitivity(sensitivity, sensitivityForecast) {
  riskLowOutput.textContent = formatUsd(sensitivity.low.total);
  riskBaseOutput.textContent = formatUsd(sensitivity.base.total);
  riskHighOutput.textContent = formatUsd(sensitivity.high.total);

  const highForecast = sensitivityForecast.high;
  const forecastDetail = highForecast.firstOverBudgetMonth
    ? ` In the higher-rate case, the forecast first exceeds the budget in month ${highForecast.firstOverBudgetMonth}.`
    : sensitivity.budget > 0
      ? ' The higher-rate case remains within budget across the forecast horizon.'
      : '';
  riskSummaryOutput.textContent = sensitivity.rateVariancePercent > 0
    ? `A +/-${formatPercent(sensitivity.rateVariancePercent)} rate change puts this monthly plan between ${formatUsd(sensitivity.low.total)} and ${formatUsd(sensitivity.high.total)}.${forecastDetail}`
    : 'No rate variance is applied. Add a percentage in the planning profile to inspect a low, base, and high cost envelope.';

  riskRows.replaceChildren();
  sensitivity.cases.forEach((caseData) => {
    const budgetDifference = caseData.budgetDelta === null
      ? 'No budget'
      : caseData.overBudget
        ? `Over ${formatUsd(Math.abs(caseData.budgetDelta))}`
        : `${formatUsd(caseData.budgetDelta)} remaining`;
    riskRows.append(
      (() => {
        const tr = document.createElement('tr');
        tr.append(
          cell(caseData.label, 'forecast-month'),
          cell(formatUsd(caseData.total), 'num', 'Monthly cost'),
          cell(budgetDifference, 'num', 'Budget difference'),
          cell(caseData.budgetDelta === null ? 'No budget set' : caseData.overBudget ? 'Over budget' : 'Within budget', 'num', 'Status'),
        );
        return tr;
      })(),
    );
  });
}

function renderDecisionReadiness(workload) {
  const readiness = buildDecisionReadiness(workload);
  readinessSummaryOutput.textContent = readiness.attentionCount > 0
    ? `${readiness.attentionCount} review ${readiness.attentionCount === 1 ? 'item needs' : 'items need'} attention. These are explicit checks, not a composite score.`
    : 'All decision checks are stated. Keep the assumptions and evidence current as the plan changes.';

  readinessChecks.replaceChildren();
  readiness.checks.forEach((item) => {
    const row = document.createElement('li');
    row.dataset.status = item.status;
    const status = document.createElement('span');
    status.className = 'readiness-status';
    status.textContent = item.status === 'ready' ? 'Ready' : item.status === 'attention' ? 'Attention' : 'Info';
    const content = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.label;
    const detail = document.createElement('p');
    detail.textContent = item.detail;
    content.append(title, detail);
    row.append(status, content);
    readinessChecks.append(row);
  });

  forecastAnnualRows.replaceChildren();
  buildAnnualRollups(forecast).forEach((year) => {
    const tr = document.createElement('tr');
    const range = year.months === 12
      ? `Year ${year.year} · months ${year.startMonth}–${year.endMonth}`
      : `Year ${year.year} · months ${year.startMonth}–${year.endMonth} (${year.months} months)`;
    const budgetStatus = forecast.budget > 0
      ? `${year.overBudgetMonths} ${year.overBudgetMonths === 1 ? 'month' : 'months'} over budget`
      : 'No budget set';
    tr.append(
      cell(range, 'forecast-month'),
      cell(formatUsd(year.amount), 'num', 'Projected total'),
      cell(formatUsd(year.averageMonthlyTotal), 'num', 'Average monthly'),
      cell(formatUsd(year.commitmentSavings), 'num', 'Commitment saving'),
      cell(budgetStatus, 'num', 'Budget status'),
    );
    forecastAnnualRows.append(tr);
  });
}

function renderBudgetMilestones(forecast) {
  const trajectory = buildBudgetMilestones(forecast);
  budgetMilestoneRows.replaceChildren();
  if (trajectory.status === 'no-budget') {
    budgetMilestoneSummary.textContent = 'Set a monthly budget to map forecast warning thresholds.';
    return;
  }
  const first = trajectory.milestones.find((milestone) => milestone.firstMonth !== null);
  budgetMilestoneSummary.textContent = first
    ? `At the entered monthly growth assumption, the forecast first reaches the ${first.label.toLowerCase()} in month ${first.firstMonth}.`
    : `The forecast remains below the watch threshold for all ${forecast.horizonMonths} months.`;
  trajectory.milestones.forEach((milestone) => {
    const tr = document.createElement('tr');
    const timing = milestone.firstMonth === null ? 'Not reached in horizon' : `Month ${milestone.firstMonth}`;
    tr.append(
      cell(milestone.label, 'forecast-month'),
      cell(formatPercent(milestone.thresholdPercent), 'num', 'Budget used'),
      cell(timing, 'num', 'First reached'),
      cell(milestone.amount === null ? '—' : formatUsd(milestone.amount), 'num', 'Projected cost'),
    );
    budgetMilestoneRows.append(tr);
  });
}

function renderRateAudit(workload) {
  const audit = buildRateAudit(workload);
  rateAuditSummary.textContent = audit.overrideCount === 0
    ? 'Every enabled rate matches the selected region’s bundled sample catalogue.'
    : `${audit.overrideCount} enabled ${audit.overrideCount === 1 ? 'rate differs' : 'rates differ'} from the bundled sample catalogue. Review the entered assumptions before sharing.`;
  rateAuditRows.replaceChildren();
  audit.entries.forEach((entry) => {
    const tr = document.createElement('tr');
    const difference = entry.overridden
      ? `${entry.difference > 0 ? '+' : '-'}${formatRate(Math.abs(entry.difference))}${entry.differencePercent === null ? '' : ` (${entry.differencePercent > 0 ? '+' : ''}${formatPercent(entry.differencePercent)})`}`
      : 'Matches sample';
    tr.append(
      cell(entry.label, 'forecast-month'),
      cell(formatRate(entry.sampleRate), 'num', 'Bundled sample rate'),
      cell(formatRate(entry.enteredRate), 'num', 'Entered rate'),
      cell(difference, 'num', 'Difference'),
    );
    rateAuditRows.append(tr);
  });
}

function renderSavingsPlan(estimate, forecast) {
  const plan = buildSavingsPlan(estimate);
  const forecastPlan = buildForecastSavingsPlan(forecast);
  savingsTargets.replaceChildren();

  if (plan.status === 'no-budget') {
    savingsSummary.textContent = 'Set a monthly budget to create a concrete savings target.';
    return;
  }

  if (plan.status === 'within') {
    if (forecastPlan.status === 'crosses-budget') {
      savingsSummary.textContent = `Today has ${formatUsd(plan.headroom)} of monthly headroom, but the forecast first exceeds budget in month ${forecastPlan.firstOverBudgetMonth}.`;
      const finalTarget = document.createElement('li');
      finalTarget.className = 'savings-target';
      finalTarget.textContent = `By the final month, close a ${formatUsd(forecastPlan.finalMonthGap)}/mo gap.`;
      const horizonTarget = document.createElement('li');
      horizonTarget.className = 'savings-target';
      horizonTarget.textContent = `${formatUsd(forecastPlan.horizonOverage)} of cumulative pressure appears across the forecast.`;
      savingsTargets.append(finalTarget, horizonTarget);
      return;
    }
    savingsSummary.textContent = `No reduction needed. This estimate has ${formatUsd(plan.headroom)} of monthly headroom.`;
    return;
  }

  savingsSummary.textContent = `Reduce ${formatUsd(plan.monthlyGap)}/mo (${formatUsd(plan.annualGap)}/yr), about ${formatUsd(plan.dailyReductionTarget)} per day, to meet the budget.`;
  allocateSavingsTarget(estimate)
    .filter((target) => target.targetReduction > 0)
    .forEach((target) => {
      const item = document.createElement('li');
      item.className = 'savings-target';
      const label = document.createElement('span');
      label.textContent = target.label;
      const amount = document.createElement('strong');
      amount.textContent = `Plan ${formatUsd(target.targetReduction)}/mo`;
      item.append(label, amount);
      savingsTargets.append(item);
    });
}

function renderBreakdown(estimate) {
  const hasData = estimate.total > 0 && estimate.lineItems.length > 0;
  breakdownEmpty.hidden = hasData;
  breakdownBody.hidden = !hasData;

  breakdownChart.replaceChildren();
  breakdownLegend.replaceChildren();
  if (!hasData) {
    return;
  }
  breakdownChart.append(createDonutSvg(estimate));
  createLegendItems(estimate).forEach((item) => breakdownLegend.append(item));
}

function renderAllocation(estimate) {
  const rows = buildAllocationRows(estimate);
  const summary = allocationSummary(estimate);
  allocationRows.replaceChildren();
  allocationEmpty.hidden = rows.length > 0;
  allocationBody.hidden = rows.length === 0;

  if (summary.largest) {
    allocationSummaryOutput.textContent = `${summary.largest.label} is the largest driver at ${formatUsd(summary.largest.amount)}/mo (${formatPercent(summary.largest.share * 100)} of the estimate).`;
  } else {
    allocationSummaryOutput.textContent = 'Enable a service with usage to allocate monthly cost.';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.append(
      cell(row.label, 'allocation-service'),
      cell(formatUsd(row.amount), 'num', 'Monthly'),
      cell(formatPercent(row.share * 100), 'num', 'Share'),
      cell(formatPercent(row.cumulativeShare * 100), 'num', 'Cumulative'),
    );
    allocationRows.append(tr);
  });
}

function render() {
  clearPresetSelection();
  const workload = readWorkload();
  const estimate = estimateWorkload(workload);
  const forecast = buildForecast(workload);
  const sensitivity = buildRateSensitivity(workload);
  const sensitivityForecast = buildRateSensitivityForecast(workload);
  const region = getRegion(estimate.region);

  renderLineItems(estimate);
  totalOutput.textContent = formatUsd(estimate.total);
  contingencySummary.hidden = estimate.contingencyAmount <= 0;
  contingencySummary.textContent = estimate.contingencyAmount > 0
    ? `Includes a ${formatPercent(estimate.contingencyPercent)} contingency reserve (${formatUsd(estimate.contingencyAmount)}/mo) on top of ${formatUsd(estimate.baseTotal)} in modeled costs.`
    : '';
  renderReportContext(workload.metadata);
  resultCard.dataset.status = estimate.budgetStatus;
  renderCommitmentImpact(estimate);
  renderBreakdown(estimate);
  renderBudgetHealth(estimate);
  renderRecommendations(estimate, forecast);
  renderSavingsPlan(estimate, forecast);
  renderAllocation(estimate);
  renderForecast(forecast);
  renderBudgetMilestones(forecast);
  renderRateSensitivity(sensitivity, sensitivityForecast);
  renderRateAudit(workload);
  renderDecisionReadiness(workload);
  regionTag.textContent = region.id;
  noteOutput.textContent = `${region.label} · ${PRICING_NOTES.operatingSystem} · ${PRICING_NOTES.currency}. ${PRICING_NOTES.disclaimer}`;

  saveWorkload(workload);
  renderComparison();
}

/** Sync an editable rate input to the sample rate for the current selection. */
function syncRate(rateInput, serviceKey, optionId) {
  const rate = getRate(currentRegion(), serviceKey, optionId);
  if (rate !== undefined) {
    rateInput.value = rate;
  }
}

/* --- Scenario management --- */

function scenarioMeta(scenario) {
  const total = estimateWorkload(scenario.workload).total;
  const savedAt = new Date(scenario.savedAt);
  const when = Number.isNaN(savedAt.getTime()) ? '' : ` · saved ${DATE_FORMATTER.format(savedAt)}`;
  return `${formatUsd(total)}/mo${when}`;
}

function actionButton(label, dataAttr, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  button.setAttribute(dataAttr, '');
  return button;
}

function scenarioTagLabel(tag) {
  return tag === 'untagged' ? 'No tag' : `${tag[0].toUpperCase()}${tag.slice(1)}`;
}

function scenarioPolicyDescription(workload) {
  const policy = summarizeCommitmentPolicy(workload);
  const commitments = policy.commitments
    .filter((commitment) => commitment.configured)
    .map((commitment) => `${commitment.label}: ${formatPercent(commitment.coveragePercent)} coverage at ${formatPercent(commitment.discountPercent)} on covered cost`);
  if (policy.rateVariancePercent > 0) {
    commitments.push(`rate sensitivity: +/-${formatPercent(policy.rateVariancePercent)}`);
  }
  return commitments.length > 0
    ? commitments.join(' · ')
    : 'No commitment or rate-sensitivity assumptions.';
}

function setScenarioFeedback(message) {
  scenarioFeedback.textContent = message;
}

function markScenarioDeleted(scenario) {
  deletedScenario = scenario;
  scenarioUndoButton.hidden = false;
  setScenarioFeedback(`Deleted “${scenario.name}”.`);
}

function undoScenarioDelete() {
  if (!deletedScenario) {
    return;
  }
  const deleted = deletedScenario;
  const scenarios = restoreScenario(scenarioStorage, deleted);
  const restored = scenarios.some((scenario) => scenario.id === deleted.id);
  deletedScenario = null;
  scenarioUndoButton.hidden = true;
  setScenarioFeedback(
    restored
      ? `Restored “${deleted.name}”.`
      : `Could not restore “${deleted.name}” because saved scenarios changed.`,
  );
  renderScenarios();
}

function clearSavedScenarios() {
  const scenarios = loadScenarios(scenarioStorage);
  if (scenarios.length === 0) {
    setScenarioFeedback('There are no saved scenarios to clear.');
    return;
  }
  if (!window.confirm(`Clear all ${scenarios.length} saved scenarios? This cannot be undone.`)) {
    return;
  }
  clearScenarios(scenarioStorage);
  deletedScenario = null;
  scenarioUndoButton.hidden = true;
  setScenarioFeedback(`Cleared ${scenarios.length} saved scenarios.`);
  renderScenarios();
}

function buildScenarioRow(scenario) {
  const li = document.createElement('li');
  li.className = 'scenario';
  li.dataset.id = scenario.id;

  if (editingScenarioId === scenario.id) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = scenario.name;
    input.maxLength = 60;
    input.className = 'scenario-rename-input';
    input.setAttribute('aria-label', 'New scenario name');

    const save = actionButton('Save', 'data-rename-save');
    const cancel = actionButton('Cancel', 'data-rename-cancel');

    const commit = () => {
      renameScenario(scenarioStorage, scenario.id, input.value);
      editingScenarioId = null;
      renderScenarios();
    };
    save.addEventListener('click', commit);
    cancel.addEventListener('click', () => {
      editingScenarioId = null;
      renderScenarios();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      } else if (event.key === 'Escape') {
        editingScenarioId = null;
        renderScenarios();
      }
    });

    const actions = document.createElement('div');
    actions.className = 'scenario-actions';
    actions.append(save, cancel);
    li.append(input, actions);
    // focus the field after it is in the DOM
    queueMicrotask(() => input.focus());
    return li;
  }

  const main = document.createElement('div');
  main.className = 'scenario-main';
  const heading = document.createElement('div');
  heading.className = 'scenario-heading';
  const name = document.createElement('strong');
  name.className = 'scenario-name';
  name.textContent = scenario.name;
  const tag = document.createElement('span');
  tag.className = 'scenario-tag';
  tag.textContent = scenarioTagLabel(scenario.tag);
  heading.append(name, tag);
  const isBaseline = getBaseline(scenarioStorage)?.id === scenario.id;
  if (isBaseline) {
    const baseline = document.createElement('span');
    baseline.className = 'scenario-tag';
    baseline.textContent = 'Comparison baseline';
    heading.append(baseline);
  }
  const meta = document.createElement('span');
  meta.className = 'scenario-meta';
  meta.textContent = scenarioMeta(scenario);
  main.append(heading, meta);
  if (scenario.description) {
    const description = document.createElement('p');
    description.className = 'scenario-description';
    description.textContent = scenario.description;
    main.append(description);
  }
  const policy = document.createElement('p');
  policy.className = 'scenario-policy';
  policy.textContent = scenarioPolicyDescription(scenario.workload);
  main.append(policy);

  const actions = document.createElement('div');
  actions.className = 'scenario-actions';
  const load = actionButton('Load', 'data-load');
  const duplicate = actionButton('Duplicate', 'data-duplicate');
  const baseline = actionButton(isBaseline ? 'Clear baseline' : 'Set baseline', 'data-baseline');
  const rename = actionButton('Rename', 'data-rename');
  const remove = actionButton('Delete', 'data-delete', 'danger');
  load.addEventListener('click', () => {
    clearResetUndo();
    writeWorkload(scenario.workload);
    render();
  });
  duplicate.addEventListener('click', () => {
    duplicateScenario(scenarioStorage, scenario.id);
    renderScenarios();
  });
  baseline.addEventListener('click', () => {
    const selected = setBaseline(scenarioStorage, isBaseline ? null : scenario.id);
    if (selected) {
      compareTarget.value = selected.id;
      setScenarioFeedback(`“${selected.name}” is now the comparison baseline.`);
    } else {
      setScenarioFeedback('Cleared the comparison baseline.');
    }
    renderScenarios();
  });
  rename.addEventListener('click', () => {
    editingScenarioId = scenario.id;
    renderScenarios();
  });
  remove.addEventListener('click', () => {
    markScenarioDeleted(scenario);
    deleteScenario(scenarioStorage, scenario.id);
    if (editingScenarioId === scenario.id) {
      editingScenarioId = null;
    }
    renderScenarios();
  });
  actions.append(load, duplicate, baseline, rename, remove);

  li.append(main, actions);
  return li;
}

function renderScenarios() {
  const allScenarios = loadScenarios(scenarioStorage);
  const scenarios = filterScenarios(allScenarios, scenarioFilterInput.value);
  scenarioEmpty.hidden = allScenarios.length > 0;
  scenarioFilterEmpty.hidden = allScenarios.length === 0 || scenarios.length > 0;
  scenarioList.hidden = scenarios.length === 0;
  scenarioList.replaceChildren();
  scenarios.forEach((scenario) => scenarioList.append(buildScenarioRow(scenario)));
  populateCompareTargets(allScenarios);
  renderComparison();
}

/* --- Scenario comparison --- */

function signedUsd(value) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatUsd(Math.abs(value))}`;
}

function diffDirection(value) {
  return value > 0 ? 'up' : value < 0 ? 'down' : 'zero';
}

function populateCompareTargets(scenarios) {
  const previous = compareTarget.value;
  compareTarget.replaceChildren();
  scenarios.forEach((scenario) => {
    const option = document.createElement('option');
    option.value = scenario.id;
    option.textContent = scenario.name;
    compareTarget.append(option);
  });
  if (scenarios.some((scenario) => scenario.id === previous)) {
    compareTarget.value = previous;
  } else {
    const baseline = getBaseline(scenarioStorage);
    if (baseline) {
      compareTarget.value = baseline.id;
    }
  }
}

function cell(text, className, label) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) {
    td.className = className;
  }
  if (label) {
    td.dataset.label = label;
  }
  return td;
}

function diffCell(diff, percent, label = 'Difference') {
  const td = document.createElement('td');
  td.className = 'compare-diff';
  td.dataset.dir = diffDirection(diff);
  td.dataset.label = label;
  const amount = document.createElement('span');
  amount.textContent = signedUsd(diff);
  td.append(amount);
  if (percent !== null && percent !== undefined && Number.isFinite(percent) && diff !== 0) {
    const pct = document.createElement('small');
    pct.textContent = `${percent > 0 ? '+' : ''}${formatPercent(percent)}`;
    td.append(pct);
  }
  return td;
}

function comparisonSummary(result, name) {
  const active = formatUsd(result.active.total);
  const other = formatUsd(result.other.total);
  if (result.cheaper === 'equal') {
    return `Current estimate matches “${name}” at ${active}/mo.`;
  }
  const magnitude = formatUsd(Math.abs(result.monthlyDiff));
  const annual = formatUsd(Math.abs(result.annualDiff));
  if (result.cheaper === 'active') {
    const pct = result.monthlyPercent !== null ? ` (${formatPercent(Math.abs(result.monthlyPercent))} less)` : '';
    return `Current estimate is ${magnitude}/mo cheaper than “${name}”${pct}: ${active} vs ${other}, about ${annual}/yr saved.`;
  }
  return `Current estimate is ${magnitude}/mo more than “${name}”: ${active} vs ${other}, about ${annual}/yr extra.`;
}

function forecastComparisonSummary(result, name) {
  const scope = result.horizonsMatch
    ? `their shared ${result.horizonMonths}-month horizon`
    : `the first ${result.horizonMonths} months (the plans use different horizons)`;
  const currentFinal = formatUsd(result.active.finalMonthTotal);
  const savedFinal = formatUsd(result.other.finalMonthTotal);

  if (result.horizonDifference === 0) {
    return `Across ${scope}, the plans have the same projected cash flow. They finish at ${currentFinal}/mo and ${savedFinal}/mo.`;
  }

  const magnitude = formatUsd(Math.abs(result.horizonDifference));
  const direction = result.horizonDifference > 0 ? 'lower' : 'higher';
  const percent = result.horizonPercent !== null
    ? ` (${formatPercent(Math.abs(result.horizonPercent))} ${direction})`
    : '';
  return `Across ${scope}, the current plan is ${magnitude} ${direction} than "${name}"${percent}. It finishes at ${currentFinal}/mo versus ${savedFinal}/mo.`;
}

function planningPolicyComparisonSummary(policyResult, estimateResult, name) {
  if (!policyResult.changed) {
    return `Commitment coverage, modeled discount, and rate sensitivity match "${name}".`;
  }

  const changes = policyResult.commitments
    .filter((commitment) => commitment.changed)
    .map((commitment) => `${commitment.label} blended discount: ${formatPercent(commitment.activeEffectiveDiscountPercent)} current vs ${formatPercent(commitment.otherEffectiveDiscountPercent)} saved`);
  if (policyResult.rateVarianceDiff !== 0) {
    changes.push(`rate sensitivity: +/-${formatPercent(policyResult.active.rateVariancePercent)} current vs +/-${formatPercent(policyResult.other.rateVariancePercent)} saved`);
  }

  const savingDifference = estimateResult.commitmentSavingsDiff;
  const savingDetail = savingDifference === 0
    ? 'Both plans model the same monthly commitment saving.'
    : savingDifference > 0
      ? `The saved plan models ${formatUsd(savingDifference)}/mo more in commitment savings.`
      : `The current plan models ${formatUsd(Math.abs(savingDifference))}/mo more in commitment savings.`;
  return `${changes.join(' · ')}. ${savingDetail}`;
}

function renderComparison() {
  const scenarios = loadScenarios(scenarioStorage);
  if (scenarios.length === 0) {
    compareEmpty.hidden = false;
    compareBody.hidden = true;
    return;
  }

  const scenario = getScenario(scenarioStorage, compareTarget.value) ?? scenarios[0];
  compareTarget.value = scenario.id;
  compareEmpty.hidden = true;
  compareBody.hidden = false;
  compareOtherLabel.textContent = scenario.name;

  const activeWorkload = readWorkload();
  const active = estimateWorkload(activeWorkload);
  const other = estimateWorkload(scenario.workload);
  const result = compareEstimates(active, other);
  const forecastResult = compareForecasts(activeWorkload, scenario.workload);
  const policyResult = comparePlanningPolicies(activeWorkload, scenario.workload);

  compareSummary.textContent = comparisonSummary(result, scenario.name);
  forecastCompareSummary.textContent = forecastComparisonSummary(forecastResult, scenario.name);
  policyCompareSummary.textContent = planningPolicyComparisonSummary(policyResult, result, scenario.name);

  compareRows.replaceChildren();
  result.services.forEach((row) => {
    const tr = document.createElement('tr');
    tr.append(
      cell(row.label, 'compare-service'),
      cell(formatUsd(row.active), 'num', 'Current'),
      cell(formatUsd(row.other), 'num', 'Saved'),
      diffCell(row.diff, row.percent),
    );
    compareRows.append(tr);
  });

  compareFoot.replaceChildren();
  compareFoot.append(
    footRow('Monthly total', formatUsd(result.active.total), formatUsd(result.other.total), result.monthlyDiff, result.monthlyPercent),
    footRow('Annual total', formatUsd(result.active.annual), formatUsd(result.other.annual), result.annualDiff, result.monthlyPercent),
  );
}

function footRow(label, activeText, otherText, diff, percent) {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = label;
  tr.append(th, cell(activeText, 'num', 'Current'), cell(otherText, 'num', 'Saved'), diffCell(diff, percent));
  return tr;
}

/* --- Export, import, and sharing --- */

function setShareFeedback(message, kind = 'info') {
  shareFeedback.textContent = message;
  shareFeedback.dataset.kind = kind;
}

function downloadBlob(contents, mimeType, filename) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Release the object URL on the next tick so the download can start first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportJson() {
  const name = saveEstimateName(estimateNameInput.value);
  const filename = buildFilename(name, 'json');
  downloadBlob(toJson(readWorkload(), name), 'application/json', filename);
  setShareFeedback(`Exported ${filename}.`, 'success');
}

function exportCsv() {
  const filename = buildFilename(saveEstimateName(estimateNameInput.value), 'csv');
  downloadBlob(toCsv(estimateWorkload(readWorkload())), 'text/csv', filename);
  setShareFeedback(`Exported ${filename}.`, 'success');
}

async function importJsonFile(file) {
  const validation = validateImportFile(file);
  if (!validation.ok) {
    setShareFeedback(validation.error, 'error');
    return;
  }
  try {
    const text = await file.text();
    const result = parseImport(text);
    if (!result.ok) {
      setShareFeedback(result.error, 'error');
      return;
    }
    writeWorkload(result.workload);
    const importedName = result.name ? saveEstimateName(result.name) : null;
    if (importedName) {
      estimateNameInput.value = importedName;
    }
    clearResetUndo();
    render();
    setShareFeedback(
      importedName ? `Imported “${importedName}”.` : 'Imported estimate.',
      'success',
    );
  } catch {
    setShareFeedback('Could not read that file.', 'error');
  }
}

async function copyShareLink() {
  const url = buildShareUrl(readWorkload(), window.location.origin + window.location.pathname);
  if (!url) {
    setShareFeedback('Could not create a share link for this location.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    setShareFeedback('Share link copied to clipboard.', 'success');
  } catch {
    // Clipboard may be blocked (insecure context); surface the link instead.
    setShareFeedback(`Copy this link: ${url}`, 'info');
  }
}

function printReport() {
  window.print();
}

async function copyReviewBrief() {
  const brief = buildReviewBrief(readWorkload(), saveEstimateName(estimateNameInput.value));
  try {
    await navigator.clipboard.writeText(brief);
    setShareFeedback('Review brief copied to clipboard.', 'success');
  } catch {
    setShareFeedback(`Copy this review brief:\n${brief}`, 'info');
  }
}

function exportForecastCsv() {
  const filename = buildFilename(`${saveEstimateName(estimateNameInput.value)}-forecast`, 'csv');
  downloadBlob(toForecastCsv(buildForecast(readWorkload())), 'text/csv', filename);
  setShareFeedback(`Exported ${filename}.`, 'success');
}

function exportSensitivityCsv() {
  const filename = buildFilename(`${saveEstimateName(estimateNameInput.value)}-rate-sensitivity`, 'csv');
  downloadBlob(toSensitivityCsv(buildRateSensitivity(readWorkload())), 'text/csv', filename);
  setShareFeedback(`Exported ${filename}.`, 'success');
}

async function shareEstimate() {
  if (!canUseWebShare(navigator)) {
    await copyShareLink();
    return;
  }

  const name = normalizeEstimateName(estimateNameInput.value);
  const url = buildShareUrl(readWorkload(), window.location.origin + window.location.pathname);
  if (!url) {
    setShareFeedback('Could not create a share link for this location.', 'error');
    return;
  }
  try {
    await navigator.share({
      title: name,
      text: `Cloud cost estimate: ${name}`,
      url,
    });
    setShareFeedback('Share sheet opened.', 'success');
  } catch (error) {
    if (error?.name !== 'AbortError') {
      await copyShareLink();
    }
  }
}

/* --- Theme --- */

function reflectThemeButtons(preference) {
  themeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference));
  });
}

function setTheme(preference) {
  const stored = saveThemePreference(scenarioStorage, preference);
  applyTheme(stored, darkModeQuery.matches, document.documentElement);
  reflectThemeButtons(stored);
}

function initTheme() {
  const preference = loadThemePreference(scenarioStorage);
  applyTheme(preference, darkModeQuery.matches, document.documentElement);
  reflectThemeButtons(preference);
  themeButtons.forEach((button) => {
    button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
  });
  // Re-resolve when the OS theme changes while following the system preference.
  darkModeQuery.addEventListener('change', () => {
    if (loadThemePreference(scenarioStorage) === 'system') {
      applyTheme('system', darkModeQuery.matches, document.documentElement);
    }
  });
}

/* --- Initialization --- */

initTheme();
applyNumericInputLimits();
populateRegions(regionSelect);
populatePresets();
populateScenarioTags();
estimateNameInput.value = loadEstimateName();
nativeShareButton.hidden = !canUseWebShare(navigator);

const sharedWorkload = parseShareParam(window.location.search);
writeWorkload(sharedWorkload ?? loadWorkload());
render();
renderScenarios();

if (sharedWorkload) {
  setShareFeedback('Loaded a shared estimate from the link.', 'success');
} else if (hasShareParam(window.location.search)) {
  setShareFeedback('That share link was invalid, so your saved estimate is shown.', 'error');
}

exportJsonButton.addEventListener('click', exportJson);
exportCsvButton.addEventListener('click', exportCsv);
exportForecastCsvButton.addEventListener('click', exportForecastCsv);
exportSensitivityCsvButton.addEventListener('click', exportSensitivityCsv);
printReportButton.addEventListener('click', printReport);
copyReviewBriefButton.addEventListener('click', copyReviewBrief);
copyLinkButton.addEventListener('click', copyShareLink);
nativeShareButton.addEventListener('click', shareEstimate);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {
      /* Offline support is optional when the app is opened directly from disk. */
    });
  });
}

importInput.addEventListener('change', () => {
  importJsonFile(importInput.files[0]);
  importInput.value = '';
});

scenarioForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = scenarioNameInput.value.trim();
  if (!name) {
    scenarioNameInput.focus();
    return;
  }
  saveScenario(scenarioStorage, name, readWorkload(), {
    tag: scenarioTagInput.value,
    description: scenarioDescriptionInput.value,
  });
  scenarioNameInput.value = '';
  scenarioTagInput.value = 'untagged';
  scenarioDescriptionInput.value = '';
  setScenarioFeedback(`Saved â€œ${name}â€.`);
  renderScenarios();
});

scenarioUndoButton.addEventListener('click', undoScenarioDelete);
clearScenariosButton.addEventListener('click', clearSavedScenarios);

scenarioFilterInput.addEventListener('change', renderScenarios);

compareTarget.addEventListener('change', renderComparison);

form.addEventListener('change', (event) => {
  if (event.target !== estimateNameInput) {
    announceEstimateUpdate();
  }
});

form.addEventListener('input', (event) => {
  if (event.target === estimateNameInput) {
    saveEstimateName(estimateNameInput.value);
    return;
  }
  clearResetUndo();
  render();

  if (
    event.target instanceof HTMLInputElement &&
    event.target.type === 'number' &&
    Number.isFinite(event.target.valueAsNumber) &&
    (event.target.valueAsNumber < Number(event.target.min) ||
      event.target.valueAsNumber > Number(event.target.max))
  ) {
    // Correct a pasted/out-of-range value immediately so the visible form,
    // persisted state, and estimate always agree without disrupting partial
    // decimal entry such as "0.".
    writeWorkload(readWorkload());
  }
});

regionSelect.addEventListener('change', () => {
  clearResetUndo();
  const region = currentRegion();
  populateServiceOptions(instanceSelect, getServiceOptions(region, 'ec2'));
  populateServiceOptions(storageSelect, getServiceOptions(region, 'ebs'));
  populateServiceOptions(s3ClassSelect, getServiceOptions(region, 's3'));
  populateServiceOptions(rdsClassSelect, getServiceOptions(region, 'rds'));
  syncRate(ec2RateInput, 'ec2', instanceSelect.value);
  syncRate(storageRateInput, 'ebs', storageSelect.value);
  syncRate(s3RateInput, 's3', s3ClassSelect.value);
  syncRate(rdsRateInput, 'rds', rdsClassSelect.value);
  s3RequestRateInput.value = getScalarRate(region, 's3RequestPer1k');
  rdsStorageRateInput.value = getScalarRate(region, 'rdsStorageGbMonth');
  dtRateInput.value = getScalarRate(region, 'dataTransferOutGb');
  render();
});

instanceSelect.addEventListener('change', () => {
  clearResetUndo();
  syncRate(ec2RateInput, 'ec2', instanceSelect.value);
  render();
});

storageSelect.addEventListener('change', () => {
  clearResetUndo();
  syncRate(storageRateInput, 'ebs', storageSelect.value);
  render();
});

s3ClassSelect.addEventListener('change', () => {
  clearResetUndo();
  syncRate(s3RateInput, 's3', s3ClassSelect.value);
  render();
});

rdsClassSelect.addEventListener('change', () => {
  clearResetUndo();
  syncRate(rdsRateInput, 'rds', rdsClassSelect.value);
  render();
});

OPTIONAL_SERVICES.forEach((serviceId) => {
  const toggle = document.querySelector(`#${serviceId}-enabled`);
  toggle?.addEventListener('change', () => {
    clearResetUndo();
    reflectServiceEnabled(serviceId, toggle.checked);
    render();
  });
});

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    clearResetUndo();
    ec2HoursInput.value = button.dataset.hoursPreset;
    render();
  });
});

resetButton.addEventListener('click', () => {
  resetSnapshot = captureWorkloadSnapshot(readWorkload());
  writeWorkload(createDefaultWorkload());
  render();
  undoResetButton.hidden = false;
});

undoResetButton.addEventListener('click', () => {
  if (!resetSnapshot) {
    return;
  }
  writeWorkload(resetSnapshot);
  clearResetUndo();
  render();
});
