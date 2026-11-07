/**
 * Shared numeric coercion and validation helpers.
 *
 * Every value that reaches the estimation engine originates from a text input,
 * a URL parameter, or persisted JSON, so it may be a string, `null`, `NaN`,
 * `Infinity`, or missing entirely. These helpers keep the calculator pure and
 * defensive without scattering `Number()` guards across the codebase.
 */

/**
 * Coerce a value to a finite number, falling back when it cannot be parsed.
 * Rejects `NaN`, `Infinity`, and `-Infinity`.
 */
export function toNumber(value, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return fallback;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

/** Coerce to a finite number that is never below zero. */
export function clampZero(value, fallback = 0) {
  return Math.max(0, toNumber(value, fallback));
}

/** Coerce to a finite number constrained to an inclusive [min, max] range. */
export function clampRange(value, min, max, fallback = min) {
  const number = toNumber(value, fallback);
  return Math.min(max, Math.max(min, number));
}

/** Coerce to a non-negative integer (rounded), useful for counts and quantities. */
export function clampCount(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = min } = {}) {
  const number = Math.round(toNumber(value, fallback));
  return Math.min(max, Math.max(min, number));
}

/** Treat only an explicit boolean `false` as disabled; everything else defaults to enabled. */
export function isEnabled(value) {
  return value !== false;
}

/** A finite, non-negative number check used by import/schema validation. */
export function isValidAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
