// Checks the app's palette against WCAG contrast ratios in all four contexts (light, dark and an
// Increase Contrast variant of each). It reads the real values out of src/theme.ts and
// src/backdrop.tsx, so it cannot drift from what ships. Run it with `npm run contrast`.
//
// Apple's floor is 4.5:1 for text and 3:1 for icons and graphics, with 7:1 preferred for small text.
import { readFileSync } from 'node:fs';

const theme = readFileSync(new URL('../src/theme.ts', import.meta.url), 'utf8');
const backdrop = readFileSync(new URL('../src/backdrop.tsx', import.meta.url), 'utf8');

const HEX = "'(#[0-9A-Fa-f]{6})'";
const palette = {};
for (const m of theme.matchAll(new RegExp(`^\\s{2}(\\w+): ramp\\(${HEX}, ${HEX}, ${HEX}, ${HEX}\\),`, 'gm'))) {
  palette[m[1]] = { light: m[2], dark: m[3], 'hc-light': m[4], 'hc-dark': m[5] };
}
const need = ['paper', 'paperRaised', 'card', 'ink', 'stone', 'track', 'signal', 'accent', 'signalTint'];
for (const k of need) if (!palette[k]) throw new Error(`could not read "${k}" from src/theme.ts`);

const glows = {};
for (const m of backdrop.matchAll(
  /^\s{2}(light|dark): \{ accent: '(#\w{6})', warm: '(#\w{6})', ring: '(#\w{6})', accentA: ([\d.]+), warmA: ([\d.]+), ringA: ([\d.]+) \}/gm,
)) {
  glows[m[1]] = [[m[2], +m[5]], [m[3], +m[6]]];
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (bg, fg, a) => bg.map((v, i) => Math.round(v * (1 - a) + fg[i] * a));

let failures = 0;
for (const mode of ['light', 'dark', 'hc-light', 'hc-dark']) {
  const c = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, rgb(v[mode])]));
  const white = [255, 255, 255];
  const rows = [
    ['ink on page', c.ink, c.paper, 4.5, 7],
    ['ink on card', c.ink, c.card, 4.5, 7],
    ['ink on modal', c.ink, c.paperRaised, 4.5, 7],
    ['ink on tinted card', c.ink, c.signalTint, 4.5, 7],
    ['small text on page', c.stone, c.paper, 4.5, 7],
    ['small text on card', c.stone, c.card, 4.5, 7],
    ['small text on modal', c.stone, c.paperRaised, 4.5, 7],
    ['small text on tinted card', c.stone, c.signalTint, 4.5],
    ['white label on signal fill', white, c.signal, 4.5],
    ['accent icon on page', c.accent, c.paper, 3],
    ['accent icon on card', c.accent, c.card, 3],
    ['progress fill on track', c.accent, c.track, 3],
    ['time bar on track', c.ink, c.track, 3],
    ['signal button vs page', c.signal, c.paper, 3],
  ];
  // Text sitting directly on the background: test each glow at its peak, and both stacked.
  for (const [name, fg] of [['small text', c.stone], ['body text', c.ink]]) {
    const layers = glows[mode] ?? [];
    if (!layers.length) continue;
    const singles = layers.map(([hex, a]) => over(c.paper, rgb(hex), a));
    const stacked = layers.reduce((bg, [hex, a]) => over(bg, rgb(hex), a), c.paper);
    rows.push([`${name} on backdrop glow peak`, fg, [...singles, stacked].sort((p, q) => ratio(fg, p) - ratio(fg, q))[0], 4.5]);
  }
  console.log(`\n${mode}`);
  for (const [name, fg, bg, min, want] of rows) {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failures++;
    const note = ok && want && r < want ? `  (under the ${want}:1 aim)` : '';
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(32)} ${r.toFixed(2).padStart(6)}:1  needs ${min}${note}`);
  }
}
console.log(failures ? `\n${failures} required ratio(s) FAIL` : '\nAll required contrast ratios are met.');
process.exit(failures ? 1 : 0);
