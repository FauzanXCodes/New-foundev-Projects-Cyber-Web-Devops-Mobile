import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useIncreaseContrast, useScheme, type Scheme } from './appearance';
import { nativeDriver, useReducedMotion } from './motion';

// The background behind a screen. Apple's guidance is that app backgrounds belong to the content
// layer, which stays quiet so the glass controls above it stand out, so this is deliberately a
// whisper: a soft warm wash and a few hairline rings that echo the ripples in the app icon. It is
// drawn with radial gradients that fade to fully transparent, so there is no shape edge to see, and
// the glows are placed away from the tab bar so controls never sit on top of colour. Peak alpha was
// chosen so text on the strongest spot still measures 6:1 or better (see README).

export type BackdropScene = 'home' | 'me' | 'checkin' | 'challenge' | 'welcome';

/** [x as a fraction of width, y as a fraction of height, radius as a multiple of width]. */
type Glow = readonly [number, number, number];
const SCENES: Record<BackdropScene, { accent: Glow; warm?: Glow; rings: readonly [number, number] }> = {
  home: { accent: [0.95, 0, 1.0], warm: [0, 0.44, 0.6], rings: [1, 0] },
  me: { accent: [0.05, 0, 1.0], warm: [1, 0.5, 0.55], rings: [0, 0] },
  checkin: { accent: [0.5, 0, 1.05], rings: [0.5, 0.02] },
  challenge: { accent: [0.95, 0, 0.9], rings: [1, 0] },
  welcome: { accent: [0.5, 0.3, 0.95], warm: [0, 1, 0.5], rings: [0.5, 0.3] },
};

const GLOWS: Record<Scheme, { accent: string; warm: string; ring: string; accentA: number; warmA: number; ringA: number }> = {
  light: { accent: '#D62B23', warm: '#FFB98F', ring: '#1B1A19', accentA: 0.09, warmA: 0.14, ringA: 0.06 },
  dark: { accent: '#FF5A46', warm: '#FF9A6B', ring: '#FFFFFF', accentA: 0.14, warmA: 0.06, ringA: 0.07 },
};

// The layer is larger than the screen so the slow drift never exposes an edge.
const BLEED = 40;
const RINGS = 6;

export const Backdrop = memo(function Backdrop({ scene }: { scene: BackdropScene }) {
  const { width, height } = useWindowDimensions();
  const scheme = useScheme();
  const contrast = useIncreaseContrast();
  const reduce = useReducedMotion();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce || contrast) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
        Animated.timing(drift, { toValue: 0, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, contrast, drift]);

  // Under Increase Contrast the decoration goes away entirely and the page is a plain solid.
  if (contrast) return null;

  const s = SCENES[scene];
  const g = GLOWS[scheme];
  const W = width + BLEED * 2;
  const H = height + BLEED * 2;
  const at = (glow: Glow) => ({ cx: BLEED + glow[0] * width, cy: BLEED + glow[1] * height, r: glow[2] * width });
  const accent = at(s.accent);
  const warm = s.warm ? at(s.warm) : null;
  const ringCx = BLEED + s.rings[0] * width;
  const ringCy = BLEED + s.rings[1] * height;
  const unit = width / 402;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={{
          position: 'absolute',
          left: -BLEED,
          top: -BLEED,
          width: W,
          height: H,
          transform: [
            { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] }) },
            { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [10, -10] }) },
          ],
        }}
      >
        <Svg width={W} height={H}>
          <Defs>
            {/* Four stops, not two, so the falloff is smooth rather than a visible linear ramp. */}
            <RadialGradient id="accent" cx={accent.cx} cy={accent.cy} r={accent.r} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={g.accent} stopOpacity={g.accentA} />
              <Stop offset="0.35" stopColor={g.accent} stopOpacity={g.accentA * 0.62} />
              <Stop offset="0.7" stopColor={g.accent} stopOpacity={g.accentA * 0.18} />
              <Stop offset="1" stopColor={g.accent} stopOpacity={0} />
            </RadialGradient>
            {warm ? (
              <RadialGradient id="warm" cx={warm.cx} cy={warm.cy} r={warm.r} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={g.warm} stopOpacity={g.warmA} />
                <Stop offset="0.4" stopColor={g.warm} stopOpacity={g.warmA * 0.55} />
                <Stop offset="0.75" stopColor={g.warm} stopOpacity={g.warmA * 0.15} />
                <Stop offset="1" stopColor={g.warm} stopOpacity={0} />
              </RadialGradient>
            ) : null}
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill="url(#accent)" />
          {warm ? <Rect x={0} y={0} width={W} height={H} fill="url(#warm)" /> : null}
          {Array.from({ length: RINGS }, (_, i) => (
            <Circle
              key={i}
              cx={ringCx}
              cy={ringCy}
              r={(78 + i * 46) * unit}
              fill="none"
              stroke={g.ring}
              strokeWidth={1.25}
              // Each ring is fainter than the one inside it, so the motif dissolves outward.
              strokeOpacity={g.ringA * (1 - i / (RINGS + 1))}
            />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
});
