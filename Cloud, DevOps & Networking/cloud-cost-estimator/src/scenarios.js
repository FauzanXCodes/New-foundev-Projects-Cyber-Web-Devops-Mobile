/**
 * Named scenario storage (versioned, defensive).
 *
 * Scenarios are persisted in Web Storage under a single versioned envelope.
 * Every read is defensive: corrupt JSON, wrong shapes, or a future/older
 * version can never crash the app - the worst case is an empty list. All
 * functions take a Web Storage-like object so they can be unit tested with an
 * in-memory stub.
 */

import { normalizeWorkload } from './state.js';

export const SCENARIO_STORE_VERSION = 3;
export const SCENARIO_NAME_MAX_LENGTH = 60;
export const SCENARIO_DESCRIPTION_MAX_LENGTH = 240;
export const SCENARIO_STORE_MAX = 50;
export const SCENARIO_TAGS = Object.freeze(['untagged', 'baseline', 'proposed', 'experiment', 'approved']);
const STORAGE_KEY = 'cloud-cost-calculator-scenarios';
const SCENARIO_TAG_SET = new Set(SCENARIO_TAGS);

function emptyStore() {
  return { version: SCENARIO_STORE_VERSION, baselineId: null, scenarios: [] };
}

function makeId() {
  return `scn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeScenarioName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, SCENARIO_NAME_MAX_LENGTH);
}

function normalizeScenarioAttributes(value) {
  const source = value && typeof value === 'object' ? value : {};
  const tag = typeof source.tag === 'string' && SCENARIO_TAG_SET.has(source.tag)
    ? source.tag
    : 'untagged';
  const description = typeof source.description === 'string'
    ? source.description.trim().replace(/\s+/g, ' ').slice(0, SCENARIO_DESCRIPTION_MAX_LENGTH)
    : '';
  return { tag, description };
}

/** Validate and repair a single stored entry; returns null if unusable. */
function sanitizeScenario(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const name = normalizeScenarioName(entry.name);
  if (!name) {
    return null;
  }
  if (!entry.workload || typeof entry.workload !== 'object') {
    return null;
  }
  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : makeId(),
    name,
    savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : new Date(0).toISOString(),
    ...normalizeScenarioAttributes(entry),
    workload: normalizeWorkload(entry.workload),
  };
}

/**
 * Migrate/repair a parsed envelope into the current shape. Unknown or older
 * versions still have their scenario array salvaged where possible.
 */
function migrate(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return emptyStore();
  }
  const list = Array.isArray(parsed.scenarios)
    ? parsed.scenarios
    : Array.isArray(parsed)
      ? parsed
      : [];
  const scenarioIds = new Set();
  const scenarioNames = new Set();
  const scenarios = [];
  for (const entry of list) {
    const scenario = sanitizeScenario(entry);
    if (!scenario) {
      continue;
    }
    const nameKey = scenario.name.toLowerCase();
    if (scenarioIds.has(scenario.id) || scenarioNames.has(nameKey)) {
      continue;
    }
    scenarioIds.add(scenario.id);
    scenarioNames.add(nameKey);
    scenarios.push(scenario);
    if (scenarios.length === SCENARIO_STORE_MAX) {
      break;
    }
  }
  const baselineId = typeof parsed.baselineId === 'string'
    && scenarios.some((scenario) => scenario.id === parsed.baselineId)
    ? parsed.baselineId
    : null;
  return { version: SCENARIO_STORE_VERSION, baselineId, scenarios };
}

/** Read the full, sanitized store. Never throws. */
export function readStore(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyStore();
    }
    return migrate(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

function writeStore(storage, store) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage full or unavailable - keep working in-memory */
  }
}

/** List saved scenarios, newest first. Never throws. */
export function loadScenarios(storage) {
  return readStore(storage).scenarios;
}

/**
 * Return scenarios matching a decision tag. The "all" view and an unknown
 * filter intentionally fall back to the complete list, so a stale UI value
 * cannot make saved work appear to vanish.
 */
export function filterScenarios(scenarios, tag = 'all') {
  const list = Array.isArray(scenarios) ? scenarios : [];
  if (tag === 'all' || !SCENARIO_TAG_SET.has(tag)) {
    return list;
  }
  return list.filter((scenario) => scenario.tag === tag);
}

/**
 * Upsert a scenario by name (case-insensitive). An optional tag and short
 * description document the decision behind the saved workload. Returns the
 * updated list; an empty name is ignored.
 */
export function saveScenario(storage, name, workload, attributes) {
  const cleanName = normalizeScenarioName(name);
  if (!cleanName) {
    return loadScenarios(storage);
  }
  const store = readStore(storage);
  const existingIndex = store.scenarios.findIndex(
    (scenario) => scenario.name.toLowerCase() === cleanName.toLowerCase(),
  );
  const existing = existingIndex >= 0 ? store.scenarios[existingIndex] : null;
  const details = attributes === undefined
    ? normalizeScenarioAttributes(existing)
    : normalizeScenarioAttributes(attributes);
  const entry = {
    id: makeId(),
    name: cleanName,
    savedAt: new Date().toISOString(),
    ...details,
    workload: normalizeWorkload(workload),
  };
  if (existingIndex >= 0) {
    entry.id = store.scenarios[existingIndex].id;
    store.scenarios.splice(existingIndex, 1);
    store.scenarios.unshift(entry);
  } else {
    store.scenarios.unshift(entry);
  }
  store.scenarios = store.scenarios.slice(0, SCENARIO_STORE_MAX);
  if (!store.scenarios.some((scenario) => scenario.id === store.baselineId)) {
    store.baselineId = null;
  }
  writeStore(storage, store);
  return store.scenarios;
}

/** Duplicate a scenario with a unique, readable copy name for what-if work. */
export function duplicateScenario(storage, id) {
  const store = readStore(storage);
  const source = store.scenarios.find((scenario) => scenario.id === id);
  if (!source) {
    return store.scenarios;
  }

  const names = new Set(store.scenarios.map((scenario) => scenario.name.toLowerCase()));
  const sourceName = normalizeScenarioName(source.name);
  let suffix = 1;
  const nextName = () => {
    const copySuffix = suffix === 1 ? ' copy' : ` copy ${suffix}`;
    return `${sourceName.slice(0, SCENARIO_NAME_MAX_LENGTH - copySuffix.length).trim()}${copySuffix}`;
  };
  let name = nextName();
  while (names.has(name.toLowerCase())) {
    suffix += 1;
    name = nextName();
  }

  store.scenarios.unshift({
    id: makeId(),
    name,
    savedAt: new Date().toISOString(),
    tag: source.tag,
    description: source.description,
    workload: normalizeWorkload(source.workload),
  });
  store.scenarios = store.scenarios.slice(0, SCENARIO_STORE_MAX);
  writeStore(storage, store);
  return store.scenarios;
}

/** Delete a scenario by id. Returns the updated list. */
export function deleteScenario(storage, id) {
  const store = readStore(storage);
  store.scenarios = store.scenarios.filter((scenario) => scenario.id !== id);
  if (store.baselineId === id) {
    store.baselineId = null;
  }
  writeStore(storage, store);
  return store.scenarios;
}

/** Return the one saved scenario chosen as the comparison baseline, if any. */
export function getBaseline(storage) {
  const store = readStore(storage);
  return store.scenarios.find((scenario) => scenario.id === store.baselineId) ?? null;
}

/** Set or clear the saved comparison baseline. Invalid ids leave it unchanged. */
export function setBaseline(storage, id) {
  const store = readStore(storage);
  if (id === null) {
    store.baselineId = null;
    writeStore(storage, store);
    return null;
  }
  const scenario = store.scenarios.find((entry) => entry.id === id);
  if (!scenario) {
    return getBaseline(storage);
  }
  store.baselineId = scenario.id;
  writeStore(storage, store);
  return scenario;
}

/** Remove every saved scenario while leaving unrelated local estimate state intact. */
export function clearScenarios(storage) {
  const store = emptyStore();
  writeStore(storage, store);
  return store.scenarios;
}

/** Restore one previously deleted scenario without overwriting a newer conflict. */
export function restoreScenario(storage, candidate) {
  const scenario = sanitizeScenario(candidate);
  if (!scenario) {
    return loadScenarios(storage);
  }
  const store = readStore(storage);
  const hasConflict = store.scenarios.some(
    (entry) => entry.id === scenario.id || entry.name.toLowerCase() === scenario.name.toLowerCase(),
  );
  if (hasConflict || store.scenarios.length >= SCENARIO_STORE_MAX) {
    return store.scenarios;
  }
  store.scenarios.unshift(scenario);
  store.scenarios = store.scenarios.slice(0, SCENARIO_STORE_MAX);
  writeStore(storage, store);
  return store.scenarios;
}

/** Rename a scenario by id. Empty names are ignored. Returns the updated list. */
export function renameScenario(storage, id, name) {
  const cleanName = normalizeScenarioName(name);
  if (!cleanName) {
    return loadScenarios(storage);
  }
  const store = readStore(storage);
  const scenario = store.scenarios.find((entry) => entry.id === id);
  const conflicts = store.scenarios.some(
    (entry) => entry.id !== id && entry.name.toLowerCase() === cleanName.toLowerCase(),
  );
  if (scenario && !conflicts) {
    scenario.name = cleanName;
    writeStore(storage, store);
  }
  return store.scenarios;
}

/** Look up a single scenario by id, or null. */
export function getScenario(storage, id) {
  return readStore(storage).scenarios.find((scenario) => scenario.id === id) ?? null;
}

/** A Web Storage-like object that degrades to memory if localStorage is unavailable. */
export function resolveStorage() {
  try {
    const probe = '__ccc_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
    };
  }
}
