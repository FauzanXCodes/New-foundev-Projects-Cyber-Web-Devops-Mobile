/**
 * Cost breakdown visualization (dependency-free SVG).
 *
 * The pure helpers (breakdownData, donutSegments) are unit-testable in Node;
 * the DOM helpers build an accessible SVG donut with a text legend that acts as
 * the non-visual equivalent. A `<title>`/`role="img"` label summarizes the
 * chart for assistive technology.
 */

import { formatPercent, formatUsd } from './calculator.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Stable colour per service so the chart and legend stay consistent. */
export const SERVICE_COLORS = Object.freeze({
  ec2: '#38bdf8',
  ebs: '#34d399',
  s3: '#a78bfa',
  rds: '#fbbf24',
  dataTransfer: '#fb7185',
  contingency: '#f97316',
});

const FALLBACK_COLOR = '#94a3b8';

/** Enabled, non-zero services with their share of the total, largest first. */
export function breakdownData(estimate) {
  const services = estimate.services.filter((service) => service.enabled && service.amount > 0);
  const total = services.reduce((sum, service) => sum + service.amount, 0);
  return services
    .map((service) => ({
      id: service.id,
      label: service.label,
      amount: service.amount,
      share: total > 0 ? service.amount / total : 0,
      color: SERVICE_COLORS[service.id] ?? FALLBACK_COLOR,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Turn breakdown data into donut segments using a path length of 100, so
 * dash/offset values are direct percentages. Offsets accumulate clockwise.
 */
export function donutSegments(data) {
  let cumulative = 0;
  return data.map((slice) => {
    const dash = slice.share * 100;
    // `|| 0` collapses the -0 produced when cumulative is 0.
    const segment = { ...slice, dash, gap: 100 - dash, offset: -cumulative * 100 || 0 };
    cumulative += slice.share;
    return segment;
  });
}

function svgEl(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

/** Build an accessible SVG donut element for the given estimate. */
export function createDonutSvg(estimate) {
  const data = breakdownData(estimate);
  const segments = donutSegments(data);

  const svg = svgEl('svg', {
    viewBox: '0 0 36 36',
    class: 'donut',
    role: 'img',
    'aria-label': donutLabel(data, estimate.total),
  });

  const title = svgEl('title');
  title.textContent = donutLabel(data, estimate.total);
  svg.append(title);

  const group = svgEl('g', { transform: 'rotate(-90 18 18)' });
  // Background track keeps the ring visible even with a single segment.
  group.append(
    svgEl('circle', {
      cx: 18,
      cy: 18,
      r: 15.915,
      fill: 'none',
      stroke: 'rgba(148,163,184,0.18)',
      'stroke-width': 4,
    }),
  );

  segments.forEach((segment) => {
    group.append(
      svgEl('circle', {
        class: 'donut-segment',
        cx: 18,
        cy: 18,
        r: 15.915,
        fill: 'none',
        stroke: segment.color,
        'stroke-width': 4,
        'stroke-dasharray': `${segment.dash} ${segment.gap}`,
        'stroke-dashoffset': segment.offset,
        pathLength: 100,
      }),
    );
  });
  svg.append(group);

  const centerValue = svgEl('text', {
    x: 18,
    y: 17.4,
    class: 'donut-total',
    'text-anchor': 'middle',
  });
  centerValue.textContent = formatUsd(estimate.total);
  const centerLabel = svgEl('text', {
    x: 18,
    y: 21.6,
    class: 'donut-caption',
    'text-anchor': 'middle',
  });
  centerLabel.textContent = 'per month';
  svg.append(centerValue, centerLabel);

  return svg;
}

function donutLabel(data, total) {
  if (data.length === 0) {
    return 'Cost breakdown: no billable services.';
  }
  const parts = data.map((slice) => `${slice.label} ${formatPercent(slice.share * 100)}`);
  return `Cost breakdown of ${formatUsd(total)} per month: ${parts.join(', ')}.`;
}

/** Build legend list items (color swatch, label, amount, and percentage). */
export function createLegendItems(estimate) {
  return breakdownData(estimate).map((slice) => {
    const li = document.createElement('li');
    li.className = 'legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = slice.color;
    swatch.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = slice.label;

    const value = document.createElement('span');
    value.className = 'legend-value';
    value.textContent = `${formatUsd(slice.amount)} · ${formatPercent(slice.share * 100)}`;

    li.append(swatch, label, value);
    return li;
  });
}
