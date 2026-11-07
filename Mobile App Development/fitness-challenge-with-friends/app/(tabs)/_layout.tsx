import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { prefetch } from '../../src/api';
import { alpha, usePalette } from '../../src/appearance';
import { Glass, useReduceTransparency } from '../../src/glass';
import { spring, springs, useReducedMotion } from '../../src/motion';
import { TAB_BAR_HEIGHT, TAB_BAR_INSET, colors, radius } from '../../src/theme';
import { Icon, T, type IconName } from '../../src/ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  'check-in': { label: 'Check-in', icon: 'check-circle' },
  me: { label: 'Me', icon: 'user' },
};

// Inner padding of the bar, and how far the lens is inset from the bar's top and bottom edge.
const PAD = 6;
const LENS_INSET = 6;

export default function TabsLayout() {
  // Tabs mount the first time they are opened, so without this the first tap on Me starts its
  // request from zero. Ask for the views behind the tabs now, while the person is still on Home.
  useEffect(() => {
    prefetch(['/me/summary']);
  }, []);
  return (
    <Tabs
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        transitionSpec: { animation: 'timing', config: { duration: 220 } },
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="check-in" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

/**
 * A floating glass capsule with a selection lens that slides between tabs on a spring. Press a tab
 * and the lens squashes and follows; or put a finger on the bar and slide it across, and the lens
 * tracks the finger, ticks a haptic as it crosses each tab, and settles on the nearest one when you
 * let go. The glass itself is the real system material, so the lens is a flat tint on top of it
 * rather than a second glass layer (Apple's guidance: glass on glass just gets muddy).
 */
function PillTabBar({ state, navigation }: TabBarProps) {
  const bottom = Math.max(useSafeAreaInsets().bottom, TAB_BAR_INSET);
  const reduce = useReducedMotion();
  const solid = useReduceTransparency();
  const pal = usePalette();
  const routes = state.routes.filter((r) => TABS[r.name]);
  const count = routes.length;

  const [barWidth, setBarWidth] = useState(0);
  const tabW = barWidth > 0 ? (barWidth - PAD * 2) / count : 0;
  const tabWRef = useRef(0);
  tabWRef.current = tabW;

  // Lens position in tab units (0 to count - 1), so it is independent of the bar's pixel width.
  const pos = useRef(new Animated.Value(state.index)).current;
  const squash = useRef(new Animated.Value(1)).current;
  const livePos = useRef(state.index);
  const dragging = useRef(false);
  const startIndex = useRef(state.index);
  const lastPreview = useRef(state.index);
  const [preview, setPreview] = useState<number | null>(null);

  const indexRef = useRef(state.index);
  indexRef.current = state.index;
  const navRef = useRef({ navigation, routes });
  navRef.current = { navigation, routes };

  // Follow the real selection whenever it changes from outside a drag (a tap, or a screen jumping tabs).
  useEffect(() => {
    if (dragging.current) return;
    livePos.current = state.index;
    if (reduce) pos.setValue(state.index);
    else spring(pos, state.index, springs.bouncy).start();
  }, [state.index, reduce, pos]);

  const select = (i: number) => {
    const { navigation: nav, routes: rs } = navRef.current;
    const route = rs[i];
    if (!route || i === indexRef.current) return;
    const event = nav.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) nav.navigate(route.name);
  };

  const press = (to: number) => {
    if (!reduce) spring(squash, to, to === 1 ? springs.bouncy : springs.press).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        dragging.current = true;
        startIndex.current = indexRef.current;
        lastPreview.current = indexRef.current;
        pos.stopAnimation();
        press(1.1);
      },
      onPanResponderMove: (_, g) => {
        const w = tabWRef.current || 1;
        const p = Math.min(count - 1, Math.max(0, startIndex.current + g.dx / w));
        livePos.current = p;
        pos.setValue(p);
        const idx = Math.round(p);
        if (idx !== lastPreview.current) {
          lastPreview.current = idx;
          setPreview(idx);
          if (Platform.OS === 'ios') Haptics.selectionAsync();
        }
      },
      onPanResponderRelease: (_, g) => {
        dragging.current = false;
        press(1);
        const idx = Math.round(livePos.current);
        setPreview(null);
        spring(pos, idx, springs.bouncy, { velocity: g.vx / (tabWRef.current || 1) }).start();
        select(idx);
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        press(1);
        setPreview(null);
        spring(pos, indexRef.current, springs.bouncy).start();
      },
    }),
  ).current;

  const active = preview ?? state.index;

  return (
    <>
      {/* Apple's scroll edge effect: content that scrolls beneath a floating control is softened
          so the control stays legible. A soft fade of the page colour under the bar does that. */}
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(pal.paper, 0), alpha(pal.paper, 0.94)]}
        locations={[0, 0.6]}
        style={[styles.edge, { height: TAB_BAR_HEIGHT + bottom + 36 }]}
      />
    <Glass radius={radius.pill} style={[styles.bar, { bottom }]}>
      <View style={styles.row} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}>
        {tabW > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lens,
              {
                width: tabW,
                backgroundColor: solid ? colors.signalTint : alpha(pal.accent, 0.14),
                borderColor: alpha(pal.accent, 0.3),
                transform: [
                  { translateX: pos.interpolate({ inputRange: [0, Math.max(1, count - 1)], outputRange: [0, Math.max(1, count - 1) * tabW] }) },
                  { scaleX: squash },
                  { scaleY: squash },
                ],
              },
            ]}
          />
        ) : null}
        {routes.map((route, i) => (
          <TabButton
            key={route.key}
            tab={TABS[route.name]}
            focused={active === i}
            onPressIn={() => press(1.08)}
            onPressOut={() => !dragging.current && press(1)}
            onPress={() => {
              if (Platform.OS === 'ios' && i !== state.index) Haptics.selectionAsync();
              select(i);
            }}
          />
        ))}
      </View>
    </Glass>
    </>
  );
}

function TabButton({ tab, focused, onPress, onPressIn, onPressOut }: {
  tab: { label: string; icon: IconName }; focused: boolean; onPress: () => void; onPressIn: () => void; onPressOut: () => void;
}) {
  const reduce = useReducedMotion();
  const bounce = useRef(new Animated.Value(1)).current;
  const wasFocused = useRef(focused);
  // On iOS the SF Symbol plays its own bounce; elsewhere a spring on the icon does the same job.
  const nativeEffect = Platform.OS === 'ios';
  useEffect(() => {
    if (focused && !wasFocused.current && !reduce && !nativeEffect) {
      bounce.setValue(0.78);
      spring(bounce, 1, springs.bouncy).start();
    }
    wasFocused.current = focused;
  }, [focused, reduce, bounce, nativeEffect]);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tab.label}
      style={styles.tab}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={{ transform: [{ scale: bounce }] }}>
        <Icon name={tab.icon} size={24} color={focused ? colors.accent : colors.stone} filled={focused} effect={focused && !reduce ? 'bounce' : null} />
      </Animated.View>
      {/* The bar is a fixed height, so its labels stop growing earlier than body text does. */}
      <T variant="small" maxFontSizeMultiplier={1.2} color={focused ? colors.ink : colors.stone}>{tab.label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    position: 'absolute',
    left: TAB_BAR_INSET,
    right: TAB_BAR_INSET,
    height: TAB_BAR_HEIGHT,
  },
  row: { flex: 1, flexDirection: 'row', paddingHorizontal: PAD },
  lens: {
    position: 'absolute',
    left: PAD,
    top: LENS_INSET,
    bottom: LENS_INSET,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
