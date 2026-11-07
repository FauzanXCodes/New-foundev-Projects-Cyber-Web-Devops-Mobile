/** One-step, in-memory undo helpers for reversible workload actions. */

import { normalizeWorkload } from './state.js';

/** Capture an independent, normalized workload snapshot safe to restore later. */
export function captureWorkloadSnapshot(workload) {
  return normalizeWorkload(workload);
}
