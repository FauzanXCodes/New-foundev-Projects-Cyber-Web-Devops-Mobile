import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  SCENARIO_STORE_VERSION,
  SCENARIO_DESCRIPTION_MAX_LENGTH,
  SCENARIO_NAME_MAX_LENGTH,
  SCENARIO_STORE_MAX,
  SCENARIO_TAGS,
  clearScenarios,
  deleteScenario,
  duplicateScenario,
  filterScenarios,
  getBaseline,
  getScenario,
  loadScenarios,
  readStore,
  renameScenario,
  restoreScenario,
  saveScenario,
  setBaseline,
} from '../src/scenarios.js';
import { createDefaultWorkload } from '../src/state.js';

function memoryStorage(seed) {
  const map = new Map();
  if (seed !== undefined) {
    map.set('cloud-cost-calculator-scenarios', seed);
  }
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

describe('scenario storage', () => {
  let storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('starts empty', () => {
    assert.deepEqual(loadScenarios(storage), []);
  });

  it('exposes a bounded set of decision-ready scenario tags', () => {
    assert.deepEqual(SCENARIO_TAGS, ['untagged', 'baseline', 'proposed', 'experiment', 'approved']);
  });

  it('filters scenario collections by decision status without hiding unknown views', () => {
    saveScenario(storage, 'Baseline', createDefaultWorkload(), { tag: 'baseline' });
    saveScenario(storage, 'Proposal', createDefaultWorkload(), { tag: 'proposed' });
    saveScenario(storage, 'Untitled', createDefaultWorkload());
    const scenarios = loadScenarios(storage);

    assert.deepEqual(filterScenarios(scenarios, 'baseline').map((scenario) => scenario.name), ['Baseline']);
    assert.deepEqual(filterScenarios(scenarios, 'all').map((scenario) => scenario.name), ['Untitled', 'Proposal', 'Baseline']);
    assert.deepEqual(filterScenarios(scenarios, 'stale-filter').map((scenario) => scenario.name), ['Untitled', 'Proposal', 'Baseline']);
  });

  it('saves and reloads a scenario', () => {
    saveScenario(storage, 'Baseline', createDefaultWorkload(), {
      tag: 'baseline',
      description: 'Current production assumptions.',
    });
    const scenarios = loadScenarios(storage);
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].name, 'Baseline');
    assert.equal(scenarios[0].tag, 'baseline');
    assert.equal(scenarios[0].description, 'Current production assumptions.');
    assert.equal(scenarios[0].workload.services.ec2.enabled, true);
  });

  it('persists a versioned envelope', () => {
    saveScenario(storage, 'Baseline', createDefaultWorkload());
    assert.equal(readStore(storage).version, SCENARIO_STORE_VERSION);
  });

  it('upserts by name instead of duplicating', () => {
    saveScenario(storage, 'Prod', createDefaultWorkload());
    const workload = createDefaultWorkload();
    workload.budget = 999;
    saveScenario(storage, 'prod', workload); // case-insensitive match
    const scenarios = loadScenarios(storage);
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].workload.budget, 999);
  });

  it('duplicates a scenario with an independent workload and a unique name', () => {
    saveScenario(storage, 'Production', createDefaultWorkload(), {
      tag: 'proposed',
      description: 'Add a read replica after launch.',
    });
    const [source] = loadScenarios(storage);
    duplicateScenario(storage, source.id);
    duplicateScenario(storage, source.id);
    const scenarios = loadScenarios(storage);

    assert.deepEqual(
      scenarios.map((scenario) => scenario.name),
      ['Production copy 2', 'Production copy', 'Production'],
    );
    assert.notEqual(scenarios[0].id, source.id);
    assert.notStrictEqual(scenarios[0].workload, source.workload);
    assert.equal(scenarios[0].tag, 'proposed');
    assert.equal(scenarios[0].description, 'Add a read replica after launch.');
  });

  it('ignores empty names', () => {
    saveScenario(storage, '   ', createDefaultWorkload());
    assert.equal(loadScenarios(storage).length, 0);
  });

  it('deletes by id', () => {
    saveScenario(storage, 'A', createDefaultWorkload());
    saveScenario(storage, 'B', createDefaultWorkload());
    const [first] = loadScenarios(storage);
    deleteScenario(storage, first.id);
    const remaining = loadScenarios(storage).map((scenario) => scenario.name);
    assert.equal(remaining.includes(first.name), false);
  });

  it('keeps one explicit baseline and clears it when that scenario is deleted', () => {
    saveScenario(storage, 'Current', createDefaultWorkload());
    saveScenario(storage, 'Option', createDefaultWorkload());
    const [option, current] = loadScenarios(storage);

    assert.equal(setBaseline(storage, current.id).name, 'Current');
    assert.equal(getBaseline(storage).id, current.id);
    assert.equal(setBaseline(storage, option.id).id, option.id);
    assert.equal(getBaseline(storage).id, option.id);
    deleteScenario(storage, option.id);
    assert.equal(getBaseline(storage), null);
  });

  it('clears saved scenarios without touching unrelated storage keys', () => {
    storage.setItem('cloud-cost-calculator-workload', '{"budget":50}');
    saveScenario(storage, 'A', createDefaultWorkload());
    saveScenario(storage, 'B', createDefaultWorkload());

    assert.deepEqual(clearScenarios(storage), []);
    assert.deepEqual(loadScenarios(storage), []);
    assert.equal(storage.getItem('cloud-cost-calculator-workload'), '{"budget":50}');
  });

  it('restores a deleted scenario without clobbering a conflicting save', () => {
    saveScenario(storage, 'Baseline', createDefaultWorkload());
    const [deleted] = loadScenarios(storage);
    deleteScenario(storage, deleted.id);
    restoreScenario(storage, deleted);

    assert.deepEqual(loadScenarios(storage).map((scenario) => scenario.name), ['Baseline']);

    saveScenario(storage, 'Baseline', createDefaultWorkload());
    assert.equal(restoreScenario(storage, deleted).length, 1);
  });

  it('does not evict an existing scenario when the storage limit was refilled', () => {
    for (let index = 0; index < SCENARIO_STORE_MAX; index += 1) {
      saveScenario(storage, `Scenario ${index}`, createDefaultWorkload());
    }
    const [deleted] = loadScenarios(storage);
    deleteScenario(storage, deleted.id);
    saveScenario(storage, 'Replacement', createDefaultWorkload());

    const scenarios = restoreScenario(storage, deleted);
    assert.equal(scenarios.length, SCENARIO_STORE_MAX);
    assert.equal(scenarios.some((scenario) => scenario.id === deleted.id), false);
    assert.equal(scenarios.some((scenario) => scenario.name === 'Replacement'), true);
  });

  it('renames by id and ignores empty names', () => {
    saveScenario(storage, 'Old', createDefaultWorkload());
    const [scenario] = loadScenarios(storage);
    renameScenario(storage, scenario.id, 'New');
    assert.equal(loadScenarios(storage)[0].name, 'New');
    renameScenario(storage, scenario.id, '  ');
    assert.equal(loadScenarios(storage)[0].name, 'New');
  });

  it('normalizes names, promotes upserts, and preserves unique names on rename', () => {
    saveScenario(storage, 'First', createDefaultWorkload());
    saveScenario(storage, 'Second', createDefaultWorkload());
    saveScenario(storage, '  first  ', createDefaultWorkload());
    assert.deepEqual(loadScenarios(storage).map((scenario) => scenario.name), ['first', 'Second']);

    const [first, second] = loadScenarios(storage);
    renameScenario(storage, second.id, first.name);
    assert.equal(getScenario(storage, second.id).name, 'Second');
  });

  it('sanitizes scenario decision context and preserves it on an ordinary upsert', () => {
    saveScenario(storage, 'Baseline', createDefaultWorkload(), {
      tag: 'approved',
      description: `  ${'A'.repeat(SCENARIO_DESCRIPTION_MAX_LENGTH + 20)}  `,
    });
    saveScenario(storage, 'baseline', createDefaultWorkload());
    const [scenario] = loadScenarios(storage);

    assert.equal(scenario.tag, 'approved');
    assert.equal(scenario.description.length, SCENARIO_DESCRIPTION_MAX_LENGTH);

    saveScenario(storage, 'Baseline', createDefaultWorkload(), {
      tag: 'not-a-tag',
      description: 42,
    });
    const [normalized] = loadScenarios(storage);
    assert.equal(normalized.tag, 'untagged');
    assert.equal(normalized.description, '');
  });

  it('keeps only the newest bounded number of scenarios', () => {
    for (let index = 0; index <= SCENARIO_STORE_MAX; index += 1) {
      saveScenario(storage, `Scenario ${index}`, createDefaultWorkload());
    }
    const scenarios = loadScenarios(storage);

    assert.equal(scenarios.length, SCENARIO_STORE_MAX);
    assert.equal(scenarios[0].name, `Scenario ${SCENARIO_STORE_MAX}`);
    assert.equal(scenarios.some((scenario) => scenario.name === 'Scenario 0'), false);
  });
});

describe('scenario resilience', () => {
  it('recovers from corrupt JSON', () => {
    const storage = memoryStorage('{ this is not json');
    assert.deepEqual(loadScenarios(storage), []);
  });

  it('drops invalid entries but keeps valid ones', () => {
    const payload = JSON.stringify({
      version: 1,
      scenarios: [
        { name: 'Good', workload: createDefaultWorkload() },
        { name: '', workload: {} },
        { workload: createDefaultWorkload() },
        'garbage',
        42,
      ],
    });
    const storage = memoryStorage(payload);
    const scenarios = loadScenarios(storage);
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].name, 'Good');
  });

  it('salvages a legacy bare-array payload', () => {
    const payload = JSON.stringify([{ name: 'Legacy', workload: createDefaultWorkload() }]);
    const storage = memoryStorage(payload);
    const scenarios = loadScenarios(storage);
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].name, 'Legacy');
  });

  it('repairs duplicate stored identities and trims oversized names', () => {
    const payload = JSON.stringify({
      scenarios: [
        {
          id: 'same',
          name: `  ${'x'.repeat(SCENARIO_NAME_MAX_LENGTH + 5)}  `,
          workload: createDefaultWorkload(),
        },
        { id: 'same', name: 'Different name', workload: createDefaultWorkload() },
        { id: 'other', name: 'different name', workload: createDefaultWorkload() },
      ],
    });
    const scenarios = loadScenarios(memoryStorage(payload));

    assert.equal(scenarios.length, 2);
    assert.equal(scenarios[0].name.length, SCENARIO_NAME_MAX_LENGTH);
  });
});
