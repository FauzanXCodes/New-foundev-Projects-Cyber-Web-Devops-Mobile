import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from './theme';

// ---------- what this device can actually do ----------

/** The real Liquid Glass material (UIGlassEffect) needs iOS 26 and an app built against its SDK.
 * Expo Go on an iOS 26 device qualifies; everything else falls back to a frosted blur. */
export const NATIVE_GLASS = (() => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

// Settings > Accessibility > Display & Text Size > Reduce Transparency. Apple's own glass gets
// frostier under it; ours goes fully solid, because legible beats pretty.
let reduceTransparency = false;
const listeners = new Set<() => void>();
if (Platform.OS === 'ios') {
  AccessibilityInfo.isReduceTransparencyEnabled()
    .then((v) => {
      reduceTransparency = v;
      listeners.forEach((l) => l());
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v) => {
    reduceTransparency = v;
    listeners.forEach((l) => l());
  });
}

export function useReduceTransparency(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => reduceTransparency,
  );
}

// The native glass effect does not survive its screen being detached. react-native-screens takes a
// screen's views off the window when another one is pushed on top, and on coming back the
// UIGlassEffect is simply gone (the text is there, the material is not). Remounting the native view
// when its screen regains focus brings it back.
function useRefocusKey(): number {
  const [key, setKey] = useState(0);
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) first.current = false;
      else setKey((k) => k + 1);
    }, []),
  );
  return key;
}

// ---------- surfaces ----------

type GlassProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Matches the corner radius of whatever's being wrapped, so the material clips cleanly. */
  radius?: number;
  /** `clear` lets more of what's behind show through; `regular` is the default, legible one. */
  effect?: 'regular' | 'clear';
  /** A wash of color through the glass. Apple's rule: tint only what matters, never everything. */
  tintColor?: string;
  /** Adds the native press shimmer and touch tracking. Only for things that are tappable. */
  interactive?: boolean;
};

/**
 * A Liquid Glass surface. Apple puts glass on the controls layer that floats above content
 * (tab bar, sheets, toolbar buttons, callouts) and keeps scrolling content solid, so that is how
 * this is used. Real `UIGlassEffect` where available, a frosted blur elsewhere, and a plain solid
 * surface when the user has Reduce Transparency on.
 */
export function Glass({ children, style, radius = 24, effect = 'regular', tintColor, interactive }: GlassProps) {
  const solid = useReduceTransparency();
  const refocus = useRefocusKey();

  if (solid || Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.solid,
          Platform.OS === 'web' ? styles.webBlur : null,
          { borderRadius: radius, backgroundColor: tintColor ?? (Platform.OS === 'web' ? 'rgba(255,255,255,0.72)' : colors.card) },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  if (NATIVE_GLASS) {
    return (
      <GlassView
        key={refocus}
        glassEffectStyle={effect}
        tintColor={tintColor}
        isInteractive={interactive}
        // Follows the system, so the material flips with Dark Mode along with everything else.
        colorScheme="auto"
        style={[{ borderRadius: radius }, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView intensity={50} tint="systemMaterial" style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      {tintColor ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tintColor, opacity: 0.55 }]} /> : null}
      <View pointerEvents="none" style={styles.sheen} />
      {children}
    </BlurView>
  );
}

/**
 * Glass that sits close together should blend and morph as one material instead of stacking, which
 * Apple's guidance warns against. Wrap neighbouring glass in this; `spacing` is how close two
 * pieces get before they start to merge.
 */
export function GlassGroup({ children, spacing = 12, style }: { children: ReactNode; spacing?: number; style?: StyleProp<ViewStyle> }) {
  const solid = useReduceTransparency();
  if (!NATIVE_GLASS || solid) return <View style={style}>{children}</View>;
  return (
    <GlassContainer spacing={spacing} style={style}>
      {children}
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  solid: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  // expo-blur's web blur is unreliable across browsers; a translucent tint plus backdrop-filter reads the same.
  // @ts-expect-error web-only style, harmless on native
  webBlur: { backdropFilter: 'blur(20px)' },
  // A faint top highlight, the way real glass catches light along its upper edge.
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: colors.white, opacity: 0.12 },
});
