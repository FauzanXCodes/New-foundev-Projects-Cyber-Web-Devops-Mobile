import * as Haptics from 'expo-haptics';
import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode,
} from 'react';
import {
  Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { nativeDriver, spring, springs } from './motion';
import { MAX_FONT_SCALE, colors, fonts, radius, space } from './theme';
import { Pressy, T } from './ui';

// ---------- chips ----------

export type Option<K extends string = string> = { key: K; label: string; disabled?: boolean };

export function Chip({ label, selected, disabled, onPress }: { label: string; selected?: boolean; disabled?: boolean; onPress?: () => void }) {
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS === 'ios') Haptics.selectionAsync();
        onPress?.();
      }}
      style={[s.chip, selected ? s.chipOn : null, disabled ? s.chipOff : null]}
    >
      <T variant="label" color={disabled ? colors.stone : colors.ink}>{label}</T>
    </Pressy>
  );
}

type ChipsProps<K extends string> = { options: Option<K>[]; wrap?: boolean } & (
  | { multi?: false; value: K | null; onChange: (v: K) => void }
  | { multi: true; value: K[]; onChange: (v: K[]) => void; max?: number }
);

/** Pick one (or several) from a few. A scrolling row by default, a wrapping grid with `wrap`. */
export function Chips<K extends string>(props: ChipsProps<K>) {
  const chips = props.options.map((o) => {
    const on = props.multi ? props.value.includes(o.key) : props.value === o.key;
    const press = () => {
      if (!props.multi) return props.onChange(o.key);
      if (on) return props.onChange(props.value.filter((v) => v !== o.key));
      if (props.max && props.value.length >= props.max) return;
      props.onChange([...props.value, o.key]);
    };
    return <Chip key={o.key} label={o.label} selected={on} disabled={o.disabled} onPress={press} />;
  });
  if (props.wrap) return <View style={s.wrap}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.rowScroll} contentContainerStyle={s.row}>
      {chips}
    </ScrollView>
  );
}

// ---------- pin pad ----------

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** A phone-style numeric keypad for a short PIN. Tap only — no keyboard, matches the app's
 * "never make the user type when they could tap" rule for anything shorter than a sentence. */
export function PinPad({ value, onChange, length = 4 }: { value: string; onChange: (v: string) => void; length?: number }) {
  const press = (d: string) => {
    if (!d) return;
    if (Platform.OS === 'ios') Haptics.selectionAsync();
    if (d === '⌫') return onChange(value.slice(0, -1));
    if (value.length < length) onChange(value + d);
  };
  return (
    <View style={{ alignItems: 'center', gap: space.gap * 1.5 }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[s.pinDot, i < value.length ? s.pinDotOn : null]} />
        ))}
      </View>
      <View style={s.pinGrid}>
        {PIN_KEYS.map((d, i) => (
          <Pressy
            key={i}
            accessibilityRole={d ? 'button' : undefined}
            accessibilityLabel={d === '⌫' ? 'Delete' : d}
            disabled={!d}
            onPress={() => press(d)}
            style={[s.pinKey, !d ? { opacity: 0 } : null]}
          >
            <T variant="title">{d}</T>
          </Pressy>
        ))}
      </View>
    </View>
  );
}

// ---------- text ----------

export function TextField(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.stone}
      returnKeyType="done"
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[s.field, focused ? { borderColor: colors.ink } : null, props.style]}
    />
  );
}

// ---------- wheel ----------

type WheelProps<V extends string | number> = {
  values: V[];
  value: V;
  onChange: (v: V) => void;
  format?: (v: V) => string;
  itemWidth?: number;
  label: string;
};

/** A horizontal scroll wheel. The selected value sits large in the center. Tap any value to jump to it. */
export function Wheel<V extends string | number>({ values, value, onChange, format = String, itemWidth = 80, label }: WheelProps<V>) {
  const ref = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const index = Math.max(0, values.indexOf(value));
  const shown = useRef(-1);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!width || shown.current === index) return;
    ref.current?.scrollTo({ x: index * itemWidth, animated: shown.current !== -1 });
    shown.current = index;
  }, [index, width, itemWidth]);

  const select = (i: number) => {
    const clamped = Math.min(values.length - 1, Math.max(0, i));
    if (clamped !== shown.current) {
      shown.current = clamped;
      // The same detent tick a native picker gives as each value passes under the marker.
      if (Platform.OS === 'ios') Haptics.selectionAsync();
      onChange(values[clamped]);
    }
    return clamped;
  };

  const pad = Math.max(0, (width - itemWidth) / 2);
  return (
    <View
      style={s.wheel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const i = select(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1));
        ref.current?.scrollTo({ x: i * itemWidth, animated: true });
      }}
    >
      <View pointerEvents="none" style={[s.wheelMark, { width: itemWidth, left: pad }]} />
      {width > 0 ? (
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={itemWidth}
          decelerationRate="fast"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: pad }}
          onScroll={(e) => {
            const i = select(Math.round(e.nativeEvent.contentOffset.x / itemWidth));
            if (Platform.OS !== 'web') return;
            // The web has no native snapping, so settle on the nearest value once scrolling stops.
            if (settleTimer.current) clearTimeout(settleTimer.current);
            settleTimer.current = setTimeout(() => ref.current?.scrollTo({ x: i * itemWidth, animated: true }), 160);
          }}
        >
          {values.map((v, i) => (
            <Pressable
              key={String(v)}
              accessibilityElementsHidden
              importantForAccessibility="no"
              onPress={() => ref.current?.scrollTo({ x: select(i) * itemWidth, animated: true })}
              style={[s.wheelItem, { width: itemWidth }]}
            >
              <T variant={i === index ? 'display' : 'body'} color={i === index ? colors.ink : colors.stone} numberOfLines={1}>
                {format(v)}
              </T>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

// ---------- swipe card ----------

export type Decision = 'yes' | 'no';
export type SwipeCardHandle = { decide: (d: Decision) => void };

const SWIPE_COMMIT = 110;

/** Follows the finger. Past the threshold it snaps off screen, then reports the decision. */
export const SwipeCard = forwardRef<SwipeCardHandle, { onDecide: (d: Decision) => void; children: ReactNode }>(
  function SwipeCard({ onDecide, children }, ref) {
    const { width } = useWindowDimensions();
    const x = useRef(new Animated.Value(0)).current;
    const busy = useRef(false);

    // A flick carries its own speed through, so a hard swipe leaves fast and a gentle push
    // drifts off. Clamped so it never bounces back at the far end.
    const decide = (d: Decision, velocity = 0) => {
      if (busy.current) return;
      busy.current = true;
      Animated.spring(x, {
        toValue: (d === 'yes' ? 1 : -1) * width * 1.3,
        velocity,
        stiffness: 240,
        damping: 26,
        mass: 1,
        overshootClamping: true,
        useNativeDriver: nativeDriver,
      }).start(() => {
        onDecide(d);
        x.setValue(0);
        busy.current = false;
      });
    };
    const latest = useRef(decide);
    latest.current = decide;
    useImperativeHandle(ref, () => ({ decide: (d) => latest.current(d) }));
    const armed = useRef(false);

    const pan = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          armed.current = false;
        },
        onPanResponderMove: (_, g) => {
          x.setValue(g.dx);
          // A light tap the moment the card passes the point of no return, and again if you
          // pull it back, so you can feel the decision line without looking for it.
          const past = Math.abs(g.dx) > SWIPE_COMMIT;
          if (past !== armed.current) {
            armed.current = past;
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_COMMIT || (g.dx > 40 && g.vx > 0.6)) latest.current('yes', g.vx);
          else if (g.dx < -SWIPE_COMMIT || (g.dx < -40 && g.vx < -0.6)) latest.current('no', g.vx);
          else spring(x, 0, springs.bouncy, { velocity: g.vx }).start();
        },
        onPanResponderTerminate: () => spring(x, 0, springs.bouncy).start(),
      }),
    ).current;

    return (
      <Animated.View
        {...pan.panHandlers}
        style={[
          s.swipe,
          {
            transform: [
              { translateX: x },
              { rotate: x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-10deg', '0deg', '10deg'] }) },
            ],
          },
        ]}
      >
        {children}
        <Animated.View pointerEvents="none" style={[s.stamp, { left: 20, opacity: x.interpolate({ inputRange: [0, 90], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
          <T variant="label">Yes</T>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[s.stamp, { right: 20, opacity: x.interpolate({ inputRange: [-90, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
          <T variant="label">Not today</T>
        </Animated.View>
      </Animated.View>
    );
  },
);

const webField = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;
const noSelect = Platform.OS === 'web' ? ({ userSelect: 'none', cursor: 'grab' } as object) : null;

const s = StyleSheet.create({
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  pinDotOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pinGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 84, justifyContent: 'center' },
  pinKey: { width: 84, height: 64, alignItems: 'center', justifyContent: 'center' },
  chip: {
    minHeight: space.touch,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.signalTint, borderColor: colors.ink },
  chipOff: { backgroundColor: colors.paper },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowScroll: { marginHorizontal: -space.screen, flexGrow: 0 },
  row: { paddingHorizontal: space.screen, gap: 8 },
  field: {
    minHeight: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 24,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.ink,
    ...webField,
  },
  wheel: { height: 88, justifyContent: 'center', borderRadius: radius.card, backgroundColor: colors.card, overflow: 'hidden' },
  wheelMark: { position: 'absolute', top: 12, bottom: 12, borderRadius: radius.pill, backgroundColor: colors.signalTint },
  wheelItem: { height: 88, alignItems: 'center', justifyContent: 'center' },
  swipe: {
    minHeight: 280,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    padding: space.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...noSelect,
  },
  stamp: {
    position: 'absolute',
    top: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.card,
  },
});
