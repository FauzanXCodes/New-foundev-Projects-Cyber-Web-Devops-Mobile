/**
 * Theme preference management.
 *
 * Preferences: 'system' (follow the OS), 'light', or 'dark'. The resolved theme
 * is written to `data-theme` on the document root (driving CSS custom
 * properties) and to `color-scheme` so native controls match. The pure
 * `resolveTheme` is unit-testable; storage functions are storage-injectable.
 */

export const THEME_KEY = 'cloud-cost-calculator-theme';
export const THEMES = Object.freeze(['system', 'light', 'dark']);

/** Resolve a preference to a concrete theme given the OS dark-mode flag. */
export function resolveTheme(preference, prefersDark) {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return prefersDark ? 'dark' : 'light';
}

/** Read a saved preference, defaulting to 'system'. Never throws. */
export function loadThemePreference(storage) {
  try {
    const value = storage.getItem(THEME_KEY);
    return THEMES.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Persist a preference (validated). Returns the stored value. */
export function saveThemePreference(storage, preference) {
  const value = THEMES.includes(preference) ? preference : 'system';
  try {
    storage.setItem(THEME_KEY, value);
  } catch {
    /* storage unavailable - theme still applies for this session */
  }
  return value;
}

/** Apply a preference to the document root; returns the resolved theme. */
export function applyTheme(preference, prefersDark, root) {
  const resolved = resolveTheme(preference, prefersDark);
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-pref', preference);
  root.style.colorScheme = resolved;
  return resolved;
}
