import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDefaultWorkload } from '../src/state.js';
import { captureWorkloadSnapshot } from '../src/undo.js';

describe('captureWorkloadSnapshot', () => {
  it('captures a normalized independent workload for one-step undo', () => {
    const workload = createDefaultWorkload();
    const snapshot = captureWorkloadSnapshot(workload);
    workload.services.ec2.hours = 40;

    assert.equal(snapshot.services.ec2.hours, 730);
    assert.notStrictEqual(snapshot.services.ec2, workload.services.ec2);
  });
});
