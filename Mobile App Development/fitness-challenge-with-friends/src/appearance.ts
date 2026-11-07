// The current appearance, for the few places that need a concrete color string instead of a
// DynamicColorIOS token: SVG, gradients and rgba tints. Everything else just uses `colors`.
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { PALETTE, type Ramp } from './theme';

export type Scheme = 'light' | 'dark';

/** Follows the system live, including Auto switching at sunset while the app is open. */
export function useScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

// Settings > Accessibility > Display & Text Size > Increase Contrast. iOS calls it "darker system
// colors". Apple asks apps to offer a higher-contrast scheme, and to keep decoration out of the way.
let increaseContrast = false;
const listeners = new Set<() => void>();
if (Platform.OS === 'ios') {
  AccessibilityInfo.isDarkerSystemColorsEnabled()
    .then((v) => {
      increaseContrast = v;
      listeners.forEach((l) => l());
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener('darkerSystemColorsChanged', (v) => {
    increaseContrast = v;
    listeners.forEach((l) => l());
  });
}

export function useIncreaseContrast(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => increaseContrast,
  );
}

/**
 * True once Dynamic Type is large enough that three items side by side would clip their text
 * (from roughly the "Large" accessibility size). Rows of pills use it to stack instead of squeeze.
 */
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale > 1.3;
}

/** '#RRGGBB' plus an alpha, as an rgba() string. For the places that need a translucent tint. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

const pick = (r: Ramp, scheme: Scheme, contrast: boolean) =>
  scheme === 'dark' ? (contrast ? r.hcDark : r.dark) : contrast ? r.hcLight : r.light;

/** Every token resolved to a string for the current appearance and contrast setting. */
export function usePalette() {
  const scheme = useScheme();
  const contrast = useIncreaseContrast();
  const resolved = {} as Record<keyof typeof PALETTE, string>;
  for (const key of Object.keys(PALETTE) as (keyof typeof PALETTE)[]) resolved[key] = pick(PALETTE[key], scheme, contrast);
  return { scheme, contrast, ...resolved };
}
