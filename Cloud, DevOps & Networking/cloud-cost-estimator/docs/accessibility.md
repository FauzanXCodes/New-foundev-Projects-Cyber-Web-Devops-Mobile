# Accessibility Notes

The interface targets a strong WCAG 2.2 AA baseline. This documents what is
implemented and how to re-check it.

## Implemented

- **Landmarks:** a `banner` header, a `main` region, labelled `section`s, and a
  `contentinfo` footer.
- **Skip link:** a visible-on-focus "Skip to calculator" link is the first
  focusable element.
- **Headings:** a single `h1`, with section (`h2`), card (`h3`), and service
  (`h4`) headings in order.
- **Labels:** every input and select has an associated `<label>`; the region and
  S3 request inputs use `aria-describedby` for their helper text.
- **Status not by colour alone:** budget state shows a text badge (Healthy /
  Watch / At risk / Over budget) in addition to colour, and the comparison deltas
  carry a `+`/`-` sign as well as colour.
- **Progress semantics:** the budget bar is a `role="progressbar"` with
  `aria-valuemin`/`max`/`now` and a human-readable `aria-valuetext`.
- **Live regions:** the budget message, savings target, allocation summary, and
  comparison summary use `aria-live="polite"`; the share feedback uses
  `role="status"`.
- **Chart equivalent:** the SVG donut is `role="img"` with a summarizing label
  and `<title>`, and is paired with a text legend that lists each service, its
  amount, and its share.
- **Keyboard:** all controls are native buttons, inputs, and selects; the theme
  toggle uses `aria-pressed`; inline scenario rename commits on Enter and cancels
  on Escape; reset exposes an ordinary Undo button rather than a timing-only
  toast.
- **Focus:** a visible focus ring (via `:focus-visible`) on all interactive
  elements.
- **Reduced motion:** `prefers-reduced-motion: reduce` collapses transitions and
  smooth scrolling.
- **Colour scheme:** `color-scheme` and a `data-theme` attribute drive light,
  dark, and system themes, applied before first paint to avoid a flash.

## How to re-check

- **Keyboard only:** tab through the entire page; confirm the skip link appears
  first, focus is always visible, and every control is reachable and operable.
- **Zoom / reflow:** at 320px width and 200% zoom there is no horizontal
  scrolling and no clipped content.
- **Screen reader:** verify the budget progress bar announces its value text and
  the chart announces its summary.
- **Contrast:** check text and status colours against their backgrounds in both
  themes (AA: 4.5:1 body, 3:1 large text and UI components).

## Known gaps

- Automated accessibility testing (for example axe) is not wired into CI; checks
  above are performed manually and via browser inspection.
