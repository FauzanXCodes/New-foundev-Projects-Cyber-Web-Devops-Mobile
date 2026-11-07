import { Appearance, DynamicColorIOS, Platform, StyleSheet, type ColorValue } from 'react-native';

// Every color is defined for the four contexts Apple asks for: light, dark, and an Increase Contrast
// variant of each. Values were chosen against measured contrast ratios rather than by eye (WCAG, with
// Apple's 4.5:1 floor and 7:1 aim for small text); see README "Color and contrast".
//
// The app follows the system appearance and never offers its own switch, which is Apple's guidance
// for Dark Mode. On iOS each token is a DynamicColorIOS, so the system resolves it natively and it
// changes instantly when the appearance flips, with no re-render. Elsewhere it is a fixed value for
// the appearance at launch.

export type Ramp = { light: string; dark: string; hcLight: string; hcDark: string };

const ramp = (light: string, dark: string, hcLight = light, hcDark = dark): Ramp => ({ light, dark, hcLight, hcDark });

export const PALETTE = {
  /** The page. The "base" background: it recedes. */
  paper: ramp('#F7F5F1', '#100F0E', '#FFFFFF', '#000000'),
  /** Modal cards and sheets. Apple's "elevated" background: brighter, so it advances over the base. */
  paperRaised: ramp('#FDFCFA', '#1C1A19', '#FFFFFF', '#161413'),
  /** Grouped content sitting on the page. */
  card: ramp('#FFFFFF', '#232120', '#FFFFFF', '#1F1D1C'),
  ink: ramp('#1B1A19', '#F5F2ED', '#000000', '#FFFFFF'),
  /** Secondary text. 7.2:1 on the page in light, 9:1 in dark, so 13pt text stays legible. */
  stone: ramp('#55514C', '#B7B1A9', '#3B3834', '#D6D1CA'),
  /** Hairlines and dividers. */
  line: ramp('#E4E0DA', '#363231', '#9B958E', '#6B6560'),
  /** The empty part of a progress bar. Its own token, so the fill keeps 3:1 against it in every context. */
  track: ramp('#E4E0DA', '#363231', '#D5CFC8', '#3B3735'),
  /** Fills that carry a white label, such as the primary button. 4.97:1 with white. */
  signal: ramp('#D62B23', '#D62B23', '#B3211A', '#B3211A'),
  /** Red for icons and graphics drawn straight onto a background. Brighter in dark so it keeps 3:1 or more. */
  accent: ramp('#D62B23', '#F0564B', '#B3211A', '#FF7A70'),
  signalTint: ramp('#FBE4E2', '#3A1F1D', '#F6CFCB', '#4A2320'),
  /** Behind a sheet. Heavier in dark, where a light scrim would barely register. */
  scrim: ramp('rgba(27,26,25,0.18)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.6)'),
  /** The drag handle on a sheet. */
  grabber: ramp('rgba(27,26,25,0.22)', 'rgba(245,242,237,0.32)', 'rgba(0,0,0,0.5)', 'rgba(255,255,255,0.6)'),
} as const;

function dyn(r: Ramp): ColorValue {
  if (Platform.OS === 'ios') {
    return DynamicColorIOS({ light: r.light, dark: r.dark, highContrastLight: r.hcLight, highContrastDark: r.hcDark });
  }
  return Appearance.getColorScheme() === 'dark' ? r.dark : r.light;
}

export const colors = {
  paper: dyn(PALETTE.paper),
  paperRaised: dyn(PALETTE.paperRaised),
  card: dyn(PALETTE.card),
  ink: dyn(PALETTE.ink),
  stone: dyn(PALETTE.stone),
  line: dyn(PALETTE.line),
  track: dyn(PALETTE.track),
  signal: dyn(PALETTE.signal),
  accent: dyn(PALETTE.accent),
  signalTint: dyn(PALETTE.signalTint),
  scrim: dyn(PALETTE.scrim),
  grabber: dyn(PALETTE.grabber),
  /** Text and glyphs on a `signal` fill. Constant: the fill is always dark enough for white. */
  white: '#FFFFFF',
};

export const fonts = {
  regular: 'Lexend_400Regular',
  medium: 'Lexend_500Medium',
  semibold: 'Lexend_600SemiBold',
};

export const type = StyleSheet.create({
  display: { fontFamily: fonts.semibold, fontSize: 32, lineHeight: 40, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 30, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.ink },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.stone },
});

/** Text scales with Dynamic Type up to 200%, which is what Apple asks apps to support. */
export const MAX_FONT_SCALE = 2;

export const space = { screen: 20, gap: 12, card: 20, touch: 48 };
export const radius = { card: 24, pill: 999 };

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_INSET = 8;

const tone = (bgL: string, fgL: string, bgD: string, fgD: string) => ({
  bg: dyn(ramp(bgL, bgD)),
  fg: dyn(ramp(fgL, fgD)),
});

// Avatars stay neutral so red keeps its meaning.
export const AVATAR_TONES = [
  tone('#E6E2DC', '#1B1A19', '#3A3633', '#F5F2ED'),
  tone('#1B1A19', '#FFFFFF', '#F5F2ED', '#100F0E'),
  tone('#D3CCC3', '#1B1A19', '#4A4542', '#F5F2ED'),
  tone('#5E5A55', '#FFFFFF', '#B7B1A9', '#100F0E'),
  tone('#EFEBE5', '#1B1A19', '#2B2826', '#F5F2ED'),
  tone('#3A3836', '#FFFFFF', '#D6D1CA', '#100F0E'),
];
