import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, View, useWindowDimensions,
  type ColorValue, type GestureResponderEvent, type PressableProps, type StyleProp, type TextProps, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScheme } from './appearance';
import { type BackdropScene, Backdrop } from './backdrop';
import { Glass } from './glass';
import { nativeDriver, spring, springs, useReducedMotion, type SpringConfig } from './motion';
import { AVATAR_TONES, MAX_FONT_SCALE, TAB_BAR_HEIGHT, TAB_BAR_INSET, colors, radius, space, type } from './theme';
import type { Person } from '../shared/api';

export type IconName = ComponentProps<typeof Feather>['name'];

// The app's icons are Feather names. On iOS each one maps to the matching SF Symbol, so the
// glyphs are the system's own: they match the weight of the surrounding text, pick up Dynamic
// Type, and can play native symbol effects. `filled` is the selected-state variant Apple uses in
// tab bars. Anything without a mapping, and every other platform, falls back to Feather.
const SF: Partial<Record<IconName, { base: string; filled?: string }>> = {
  home: { base: 'house', filled: 'house.fill' },
  'check-circle': { base: 'checkmark.circle', filled: 'checkmark.circle.fill' },
  user: { base: 'person', filled: 'person.fill' },
  settings: { base: 'gearshape', filled: 'gearshape.fill' },
  'arrow-left': { base: 'chevron.left' },
  x: { base: 'xmark' },
  plus: { base: 'plus' },
  check: { base: 'checkmark' },
  bell: { base: 'bell', filled: 'bell.fill' },
  award: { base: 'trophy', filled: 'trophy.fill' },
  flag: { base: 'flag', filled: 'flag.fill' },
  activity: { base: 'waveform.path.ecg' },
  // Feather has no sparkles; its star stands in on web, where Apple Intelligence never shows anyway.
  star: { base: 'sparkles' },
};

type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  /** Selected-state glyph, where the symbol has one. */
  filled?: boolean;
  /** A native symbol effect, played when this turns on (for example when a tab becomes selected). */
  effect?: 'bounce' | 'pulse' | 'scale' | null;
};

export function Icon({ name, size = 24, color = colors.ink, filled, effect }: IconProps) {
  const sf = Platform.OS === 'ios' ? SF[name] : undefined;
  if (!sf) return <Feather name={name} size={size} color={color} />;
  return (
    <SymbolView
      name={(filled && sf.filled ? sf.filled : sf.base) as SymbolViewProps['name']}
      size={size}
      tintColor={color}
      weight="medium"
      type="monochrome"
      animationSpec={effect ? { effect: { type: effect } } : undefined}
      style={{ width: size, height: size }}
    />
  );
}

// ---------- text ----------

type TProps = TextProps & { variant?: keyof typeof type; color?: ColorValue; center?: boolean };

export function T({ variant = 'body', color, center, style, ...rest }: TProps) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[type[variant], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
    />
  );
}

// ---------- press ----------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Every tappable button and card gives under the finger and springs back with a touch of life.
 * Being a spring, a quick tap that lets go mid-press just reverses from where it is. */
export function Pressy({ style, onPressIn, onPressOut, ...rest }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (toValue: number, config: SpringConfig) => {
    if (!reduce) spring(scale, toValue, config).start();
  };
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        to(0.96, springs.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1, springs.bouncy);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    />
  );
}

// ---------- buttons ----------

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', disabled, busy, icon, style }: ButtonProps) {
  const primary = variant === 'primary';
  const off = disabled || busy;
  const fg = off && primary ? colors.stone : primary ? colors.white : colors.ink;
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      onPress={() => {
        if (Platform.OS === 'ios') Haptics.impactAsync(primary ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[
        styles.button,
        primary ? { backgroundColor: off ? colors.line : colors.signal } : styles.outline,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : null}
      {!busy && icon ? <Icon name={icon} size={20} color={fg} /> : null}
      {!busy ? <T variant="label" color={fg}>{title}</T> : null}
    </Pressy>
  );
}

export function TextLink({ title, onPress, style }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={[styles.textLink, style]}>
      <T variant="label" color={colors.stone}>{title}</T>
    </Pressable>
  );
}

/** A toolbar button. Round glass floating over the page, the way iOS 26 draws them; the outer
 * 48pt is the touch target, the glass inside is 44. */
export function IconButton({ name, onPress, label }: { name: IconName; onPress: () => void; label: string }) {
  return (
    <Pressy accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      <Glass radius={radius.pill} interactive style={styles.iconGlass}>
        <Icon name={name} size={22} color={colors.ink} />
      </Glass>
    </Pressy>
  );
}

// ---------- surfaces ----------

type CardProps = { children: ReactNode; onPress?: () => void; tint?: boolean; style?: StyleProp<ViewStyle>; label?: string };

export function Card({ children, onPress, tint, style, label }: CardProps) {
  const s = [styles.card, tint ? { backgroundColor: colors.signalTint } : null, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressy accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s}>
      {children}
    </Pressy>
  );
}

/**
 * A quiet placeholder for something that is on its way. It breathes slowly instead of spinning, holds
 * still under Reduce Motion, and is hidden from VoiceOver (the screen announces itself once loaded).
 */
export function Skeleton({ width, height = 16, round = 8, style }: { width?: number | `${number}%`; height?: number; round?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 900, useNativeDriver: nativeDriver }),
        Animated.timing(breathe, { toValue: 0, duration: 900, useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduce]);
  const opacity = reduce ? 0.7 : breathe.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: width ?? '100%', height, borderRadius: round, backgroundColor: colors.track, opacity }, style]}
    />
  );
}

/** What a screen shows until its data arrives: placeholders, or a plain message and a way to retry. */
export function Waiting({ error, onRetry, blocks = [34, 110, 110] }: { error?: string | null; onRetry: () => void; blocks?: number[] }) {
  if (error) {
    return (
      <Card style={{ gap: space.gap }}>
        <T>{error}</T>
        <Button variant="outline" title="Try again" onPress={onRetry} />
      </Card>
    );
  }
  return (
    <View accessible accessibilityLabel="Loading" style={{ gap: space.gap }}>
      {blocks.map((h, i) => (
        <Skeleton key={i} height={h} round={i === 0 ? 10 : radius.card} width={i === 0 ? '60%' : undefined} />
      ))}
    </View>
  );
}

export function CheckCircle({ size = 24, effect }: { size?: number; effect?: 'bounce' | 'pulse' | null }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="check" size={size * 0.6} color={colors.white} effect={effect} />
    </View>
  );
}

// ---------- people ----------

export function Avatar({ person, size = 48, dot }: { person: Pick<Person, 'name' | 'avatar'>; size?: number; dot?: boolean }) {
  const tone = AVATAR_TONES[person.avatar % AVATAR_TONES.length];
  const dotSize = Math.max(10, size * 0.28);
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
        <T variant={size >= 48 ? 'title' : 'label'} color={tone.fg} style={size < 36 ? { fontSize: size * 0.42, lineHeight: size * 0.5 } : null}>
          {person.name.trim().charAt(0).toUpperCase()}
        </T>
      </View>
      {dot ? (
        <View
          accessibilityLabel="Logged today"
          style={{ position: 'absolute', right: 0, bottom: 0, width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.paper }}
        />
      ) : null}
    </View>
  );
}

export function AvatarStack({ people, total, size = 28 }: { people: Person[]; total?: number; size?: number }) {
  const extra = (total ?? people.length) - people.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {people.map((p, i) => (
        <View key={p.id} style={{ marginLeft: i ? -8 : 0, borderRadius: size, borderWidth: 2, borderColor: colors.card }}>
          <Avatar person={p} size={size} />
        </View>
      ))}
      {extra > 0 ? <T variant="small" style={{ marginLeft: 6 }}>+{extra}</T> : null}
    </View>
  );
}

// ---------- progress ----------

const lastShown = new Map<string, number>();

/** Springs from the value it last showed (anywhere in the app) to the new one. The fill is a full
 * pill that slides into place, so it runs on the native thread and the round end stays round. */
export function ProgressBar({ fraction, tone = 'signal', height = 10, animKey, from }: {
  fraction: number; tone?: 'signal' | 'ink'; height?: number; animKey?: string; from?: number;
}) {
  const target = Math.max(0, Math.min(1, fraction || 0));
  const start = from ?? (animKey !== undefined ? lastShown.get(animKey) : undefined) ?? target;
  const value = useRef(new Animated.Value(start)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (animKey !== undefined) lastShown.set(animKey, target);
    spring(value, target, springs.ui).start();
  }, [animKey, target, value]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.track, overflow: 'hidden' }}
    >
      {width > 0 ? (
        <Animated.View
          style={{
            width,
            height,
            borderRadius: height / 2,
            backgroundColor: tone === 'ink' ? colors.ink : colors.accent,
            transform: [{ translateX: value.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }],
          }}
        />
      ) : null}
    </View>
  );
}

// ---------- layout ----------

export function useTabBarSpace(): number {
  return TAB_BAR_HEIGHT + TAB_BAR_INSET + Math.max(useSafeAreaInsets().bottom, TAB_BAR_INSET);
}

export function Header({ onBack, right, close }: { onBack?: () => void; right?: ReactNode; close?: () => void }) {
  const top = useSafeAreaInsets().top;
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={[styles.header, { paddingTop: top + 4 }]}>
      {close ? <View style={styles.iconButton} /> : <IconButton name="arrow-left" label="Back" onPress={back} />}
      <View style={{ flex: 1 }} />
      {right}
      {close ? <IconButton name="x" label="Close" onPress={close} /> : null}
    </View>
  );
}

export function Page({ children, footer, header, contentStyle, backdrop, raised }: {
  children: ReactNode; footer?: ReactNode; header?: ReactNode; contentStyle?: StyleProp<ViewStyle>; backdrop?: BackdropScene;
  /** For screens presented as a modal card: Apple's elevated background, so it advances over the page behind. */
  raised?: boolean;
}) {
  const bottom = useSafeAreaInsets().bottom;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.page, raised ? { backgroundColor: colors.paperRaised } : null]}>
      {backdrop ? <Backdrop scene={backdrop} /> : null}
      {header}
      <ScrollView
        contentContainerStyle={[styles.pageContent, contentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(bottom, space.screen) }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

/**
 * A bottom sheet that behaves like the real thing. It springs up, follows the finger while you drag
 * it, and either flings away or springs back depending on how you let go. Because it is all springs
 * you can grab it mid-animation, or tap the scrim while it is still opening, and it reverses from
 * exactly where it is. The surface is glass, floating with an inset like iOS 26's own sheets.
 */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const { height: screenH } = useWindowDimensions();
  const bottom = useSafeAreaInsets().bottom;
  const reduce = useReducedMotion();
  const scheme = useScheme();
  const [mounted, setMounted] = useState(visible);
  const y = useRef(new Animated.Value(screenH)).current;
  const current = useRef(screenH);
  const releaseVelocity = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = y.addListener(({ value }) => {
      current.current = value;
    });
    return () => y.removeListener(id);
  }, [y]);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  // Runs once the modal is actually on screen, and again whenever `visible` flips, so opening and
  // closing both continue from wherever the sheet currently is rather than jumping.
  useEffect(() => {
    if (!mounted) return;
    const velocity = releaseVelocity.current;
    releaseVelocity.current = 0;
    const move = reduce
      ? Animated.timing(y, { toValue: visible ? 0 : screenH, duration: 160, useNativeDriver: nativeDriver })
      : spring(y, visible ? 0 : screenH, springs.sheet, { velocity });
    move.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => move.stop();
  }, [visible, mounted, reduce, screenH, y]);

  // The drag runs off the raw touch stream rather than PanResponder. Inside a Modal on the new
  // architecture the responder negotiation never asks the sheet for a move, while the raw
  // start/move/end events arrive intact, so this reads those directly. Touches that begin on a
  // button still bubble here; the drag only takes over once the finger has clearly gone downward.
  const drag = useRef({ tracking: false, active: false, startX: 0, startY: 0, base: 0, lastY: 0, lastT: 0, vy: 0 });

  const onTouchStart = (e: GestureResponderEvent) => {
    const t = e.nativeEvent;
    drag.current = { tracking: t.touches.length === 1, active: false, startX: t.pageX, startY: t.pageY, base: 0, lastY: t.pageY, lastT: t.timestamp, vy: 0 };
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    const d = drag.current;
    const t = e.nativeEvent;
    if (!d.tracking) return;
    if (!d.active) {
      const dy = t.pageY - d.startY;
      const dx = t.pageX - d.startX;
      if (dy < 8 || dy < Math.abs(dx) * 1.4) return;
      // Take over: freeze whatever the sheet was doing and pick it up from where it is.
      d.active = true;
      y.stopAnimation();
      d.base = current.current;
      d.startY = t.pageY;
    }
    const dy = t.pageY - d.startY;
    // Upward pulls rubber-band instead of moving 1:1; downward ones follow the finger exactly.
    y.setValue(d.base + (dy < 0 ? dy / 6 : dy));
    const dt = t.timestamp - d.lastT;
    if (dt > 0) d.vy = (t.pageY - d.lastY) / dt;
    d.lastY = t.pageY;
    d.lastT = t.timestamp;
  };
  const release = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    d.tracking = false;
    if (current.current > 90 || d.vy > 0.9) {
      releaseVelocity.current = d.vy;
      closeRef.current();
    } else {
      spring(y, 0, springs.sheet, { velocity: d.vy }).start();
    }
  };

  const dim = y.interpolate({ inputRange: [0, screenH * 0.55], outputRange: [1, 0], extrapolate: 'clamp' });

  // At large text sizes a sheet's content can be taller than the screen. It is then capped and the
  // content scrolls, and dismissing by dragging moves to just the grabber and title so a scroll
  // and a dismiss can never be the same gesture.
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  // Derived from both measurements, because either can arrive first.
  const overflow = viewport > 0 && content > viewport + 1;
  const dragProps = { onTouchStart, onTouchMove, onTouchEnd: release, onTouchCancel: release };
  const maxHeight = screenH * 0.88 - Math.max(bottom, 8);

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetHost}>
        {/* Light on purpose. A heavy dark scrim would sit on top of the very thing the glass is meant to pick up. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: dim }]}>
          <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          // VoiceOver's two-finger scrub. The scrim is hidden from it by the modal flag above.
          onAccessibilityEscape={onClose}
          {...(overflow ? null : dragProps)}
          style={[styles.sheetWrap, { marginBottom: Math.max(bottom, 8), transform: [{ translateY: y }] }]}
        >
          <Glass radius={34} tintColor={scheme === 'dark' ? 'rgba(28,26,25,0.4)' : 'rgba(255,255,255,0.35)'} style={[styles.sheet, { maxHeight }]}>
            <View style={{ gap: space.gap }} {...(overflow ? dragProps : null)}>
              <View style={styles.grabber} />
              {title ? <T variant="title">{title}</T> : null}
            </View>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={{ gap: space.gap }}
              scrollEnabled={overflow}
              bounces={false}
              showsVerticalScrollIndicator={overflow}
              keyboardShouldPersistTaps="handled"
              onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
              onContentSizeChange={(_, h) => setContent(h)}
            >
              {children}
            </ScrollView>
          </Glass>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <T variant="small" color={colors.ink} style={{ marginTop: 8 }}>{children}</T> : null;
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outline: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ink },
  textLink: { minHeight: space.touch, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 12 },
  iconButton: { width: space.touch, height: space.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.card },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  page: { flex: 1, backgroundColor: colors.paper },
  pageContent: { padding: space.screen, gap: space.gap, paddingBottom: space.screen * 2 },
  footer: { paddingHorizontal: space.screen, paddingTop: space.gap, gap: space.gap },
  iconGlass: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: colors.scrim },
  sheetHost: { flex: 1, justifyContent: 'flex-end' },
  sheetWrap: { marginHorizontal: 8 },
  sheetScroll: { flexShrink: 1, flexGrow: 0 },
  sheet: { paddingHorizontal: space.screen, paddingTop: 12, paddingBottom: space.screen, gap: space.gap },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.grabber, marginBottom: 4 },
});
