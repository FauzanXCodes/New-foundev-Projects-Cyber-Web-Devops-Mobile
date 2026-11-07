import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from './theme';

export const nativeDriver = Platform.OS !== 'web';
export const easeOut = Easing.out(Easing.cubic);

// ---------- springs ----------
// Everything that moves in response to a person uses a spring, not a fixed-duration curve. A
// spring has no end time to fight: start a new one mid-flight and it carries on from wherever the
// value is right now, which is what makes a press, a sheet or a card feel like it's really
// attached to the finger and reversible at any moment.

export const springs = {
  /** Quick, no overshoot. Press feedback. */
  press: { stiffness: 520, damping: 34, mass: 0.8 },
  /** The everyday one: settles in a few hundred ms with the barest overshoot. */
  ui: { stiffness: 260, damping: 26, mass: 1 },
  /** Sheets and large surfaces. Heavier, so they feel like they have weight. */
  sheet: { stiffness: 320, damping: 32, mass: 1 },
  /** A little playful overshoot, for arrivals and selection. */
  bouncy: { stiffness: 340, damping: 18, mass: 1 },
} as const;

export type SpringConfig = { stiffness: number; damping: number; mass: number };

export function spring(
  value: Animated.Value,
  toValue: number,
  config: SpringConfig = springs.ui,
  opts: { velocity?: number; native?: boolean } = {},
) {
  return Animated.spring(value, {
    toValue,
    ...config,
    velocity: opts.velocity,
    useNativeDriver: opts.native ?? nativeDriver,
  });
}

// ---------- reduced motion ----------

let reduced = false;
const listeners = new Set<() => void>();
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduced = v;
    listeners.forEach((l) => l());
  })
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
  reduced = v;
  listeners.forEach((l) => l());
});

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => reduced,
  );
}

// ---------- entrance ----------

/** Rises and fades in on a spring the first time it mounts, staggered by `index` so a screen
 * assembles itself instead of appearing all at once. Sits still under Reduce Motion.
 *
 * `fade={false}` for anything that contains Liquid Glass: Expo's docs warn that opacity on a glass
 * view or any parent of one switches the effect off, and it does not come back afterwards. Those
 * just rise into place without fading. */
export function Enter({ children, index = 0, distance = 18, fade = true, style }: {
  children: ReactNode; index?: number; distance?: number; fade?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const t = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      t.setValue(1);
      return;
    }
    const run = Animated.sequence([Animated.delay(Math.min(index, 7) * 55), spring(t, 1, springs.ui)]);
    run.start();
    return () => run.stop();
    // Mount only: a re-render must never replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          ...(fade ? { opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) } : null),
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ---------- confetti, once per challenge ----------

const SEEN_KEY = 'confetti-seen';
let seen: Set<string> | null = null;

async function claimConfetti(key: string): Promise<boolean> {
  if (!seen) {
    const raw = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
    seen = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  }
  if (seen.has(key)) return false;
  seen.add(key);
  AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen])).catch(() => {});
  return true;
}

const PIECES = Array.from({ length: 28 }, (_, i) => ({
  x: (Math.random() - 0.5) * 320,
  y: 160 + Math.random() * 160,
  lift: 60 + Math.random() * 80,
  spin: (Math.random() - 0.5) * 720,
  size: 6 + Math.random() * 6,
  color: [colors.accent, colors.ink, colors.accent, colors.stone][i % 4],
}));

/** A single burst the first time `key` is seen with `active` true. Never again after that. */
export function ConfettiOnce({ id, active }: { id: string; active: boolean }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    claimConfetti(id).then((fresh) => {
      if (cancelled || !fresh || reduce) return;
      setShow(true);
      Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start(() =>
        setShow(false),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [active, id, reduce, t]);

  if (!show) return null;
  return (
    <View pointerEvents="none" style={styles.layer}>
      {PIECES.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size * 0.6,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) },
              { translateY: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, -p.lift, p.y] }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});

// ---------- pulse ring ----------

/** A soft ring that breathes outward from `children` and fades — the "you did it" moment
 * behind the big check circle. Loops gently; sits still under reduced motion. */
export function PulseRing({ size, children }: { size: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, t]);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: size, minHeight: size }}>
      {!reduce ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            alignSelf: 'center',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.accent,
            opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
          }}
        />
      ) : null}
      {children}
    </View>
  );
}
