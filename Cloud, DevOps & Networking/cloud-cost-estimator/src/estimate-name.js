/**
 * Presentation-only estimate naming helpers.
 *
 * Estimate names identify local saves and downloaded files. They deliberately
 * stay outside the shared workload payload so a copied link carries only cost
 * configuration, not a potentially personal label.
 */

export const ESTIMATE_NAME_MAX_LENGTH = 60;
export const DEFAULT_ESTIMATE_NAME = 'Estimate';

/** Return a compact, human-readable estimate name with a stable fallback. */
export function normalizeEstimateName(value, fallback = DEFAULT_ESTIMATE_NAME) {
  const compact = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, ESTIMATE_NAME_MAX_LENGTH);
  return compact || fallback;
}
