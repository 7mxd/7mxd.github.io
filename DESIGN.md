# Design

The visual system of www.7mxd.me. Every value here is live in `css/tokens.css`
and enforced by `test/tokens-contrast.test.js` and `test/css-contract.test.js`.
Change a colour here and run those tests; they parse the stylesheet.

## Theme

Light-first. A plain, photo-led page on a near-white ground, read mostly on a
phone in daylight, one-handed, from a link someone sent. That scene forces
light: a dark ground would be a style choice fighting the context.

Dark mode is a properly derived second palette, not an inversion, and is the
theme where the accent can sit at its lightest without losing the ground.

Colour strategy: **restrained**. Tinted neutrals plus one accent under ten
percent of the surface. The page is carried by photographs and typography; the
accent marks links, bullet glyphs, and the one highlighted row in the benchmark
table.

## Color

The palette is derived from the owner's own logo artwork, not invented: ink navy
`#1c1f32` and warm tan `#e7ad87` sampled directly from the drawing. The accent is
blue at hue 218-224, the family the ink navy (hue 232) already sits in, so it is
still the artwork's own colour rather than a generic tech blue, and it is well
clear of the banned teals at hue 191. The warm tan now reads as deliberate
contrast in the logo rather than as a palette match.

Light mode uses the deeper end of the blue and dark mode the lighter end, both
chosen for legibility on their own ground rather than by lightening the same
hex. The figures below are recomputed from `css/tokens.css` by
`test/design-doc.test.js`, so this table cannot silently go stale the way it
did when the accent changed.

Body background is a true off-white at near-zero chroma. Deliberately not a
cream, sand, or parchment; warmth comes from the logo, the accent, and the
photographs.

### Light

| Token | Value | Role | Contrast on `--ground` |
|---|---|---|---|
| `--ground` | `#fafaf9` | page | — |
| `--ground-raised` | `#ffffff` | callouts, chips | — |
| `--ink` | `#1c1f32` | body and headings | 15.57:1 |
| `--ink-muted` | `#585b6b` | metadata, captions | 6.44:1 |
| `--accent` | `#2959ae` | links, bullet glyphs, year badges | 6.41:1 |
| `--accent-strong` | `#21488c` | link hover, benchmark row | 8.48:1 |
| `--rule` | `#e2e2df` | hairlines only, never text | — |

### Dark

| Token | Value | Contrast on `--ground` |
|---|---|---|
| `--ground` | `#15171f` | — |
| `--ground-raised` | `#1c1f2a` | — |
| `--ink` | `#e9e7e2` | 14.47:1 |
| `--ink-muted` | `#9a9aa6` | 6.43:1 |
| `--accent` | `#90b2df` | 8.19:1 |
| `--accent-strong` | `#a8c3e6` | 9.89:1 |
| `--rule` | `#2a2d3a` | — |

`--print-*` tokens live in a second `:root` block and are reassigned onto the
same names inside `css/print.css`. Print is ink on white regardless of theme.

`@media (prefers-contrast: more)` darkens `--ink-muted` and strengthens `--rule`
in both themes.

## Typography

Three families, one of which sets a single line.

| Role | Family | Fallbacks |
|---|---|---|
| Prose, headings | Source Serif 4 | Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif |
| Nav, metadata, labels, years | Public Sans | system UI stack |
| The Arabic name only | Amiri | Noto Naskh Arabic, Segoe UI, serif |

Amiri is subsetted with Google Fonts' `&text=` parameter to the ten glyphs of
`أحمد علوي رضي`, which reduces it to a negligible download.

Loading is `font-display: swap` with hand-picked fallbacks and **no metric
matching**. There are no `@font-face` overrides, so some reflow remains on slow
connections. Adding `size-adjust` and `ascent-override` would need real measured
metrics for both faces against their fallbacks.

Scale: fluid `clamp()` for headings, fixed rem for body. `--text-2xl` tops out at
3.25rem, well under the 6rem ceiling. Prose measure stays inside 65-75ch.

The pairing is serif prose against a plain institutional sans for structure. Both
families are deliberately unfashionable; neither appears on the reflex-reject
list.

## Layout

Single column throughout. Two measures: `--measure-prose` at 34rem for reading,
`--measure-wide` at 46rem for the page shell. The navigation has its own
`--measure-nav` at 58rem, because a bar carrying a wordmark, five links, a
toggle and a button is chrome, not prose, and does not belong inside the reading
measure.

Gutter is `clamp(1.25rem, 0.5rem + 3vw, 4rem)`.

Spacing scale runs `--space-1` through `--space-16`, the last fluid. Section
boundaries use `--space-section` instead, a separate token capped at 4rem:
`--space-16` pins to 96px top *and* bottom above 1280px, which made every
boundary 192px of empty page with a hairline floating at its exact midpoint,
belonging to neither section. `--space-16` keeps its larger ceiling where it is
wanted — the hero top pad, the footer bottom pad. Rhythm is
varied deliberately: generous separation between sections, tight grouping within
an entry.

No card grids. Sections are separated by a single hairline rule, not by boxes.

## Components

- **Nav.** Sticky, translucent with a backdrop blur, hairline bottom rule. Logo
  mark sized by height with width following, since the artwork is a half-face
  and forcing it into a square box pays for empty columns. Collapses to a
  hamburger below 46rem.
- **Hero.** Portrait beside the text, tops aligned. The portrait is a circle,
  `object-fit: cover` at `object-position: 50% 18%` because the source is a
  tall portrait and a centred square crop cuts the chin. One ring, drawn as a
  two-stop `box-shadow`: a band of the page ground, then a hairline in
  `--portrait-ring`. It was a band of `--ground-raised`, which is `#ffffff` in
  light and therefore byte-identical to the photograph's own studio backdrop —
  the band merged into the picture and the shirt dissolved into the page. The
  component only ever read as two rings in dark, by accident. Below it: name,
  Arabic name at `dir="rtl"`, role line, tagline, pills, contact links.
- **Pills.** Outlined, fully rounded, metadata face at `--text-xs`. They state
  facts without tense, which is why the degree lives here rather than in the
  tagline. The Arabic pill switches family and direction. Outlined rather than
  filled so they read as labels, not buttons.
- **Timeline.** A real `<ol>` grouped into year `<section>`s, drawn against one
  continuous rail. The rail is a single pseudo-element on the `.timeline`
  wrapper, not per group, because a line that restarts at each boundary reads as
  a stack of lists rather than one chronology. Year labels are circular badges
  sitting on the rail with the page ground behind them, so they occlude the line
  rather than float beside it; the year is the one place `--accent` appears
  outside a link. The rail narrows on a phone but never collapses: stacking the
  year above its entries was what made mobile read as an undifferentiated list,
  and mobile is the real surface. Bullets carry a small accent dot.
  Organisation marks render as a small inline chip.
- **Galleries.** One image runs the full measure; two or more sit at most two per
  row with an odd trailing image spanning. Work galleries are a constrained row,
  because the app captures are tall portraits.
- **Numbers strip.** `repeat(auto-fit, minmax(8rem, 1fr))`, four across on
  desktop, two by two on a phone.
- **Benchmark table.** Tabular numerals, one accent-coloured row for the
  author's own result.
- **Skills.** Grouped lists, no bars, no percentages.

## Motion

Almost none, by intent. No scroll-triggered reveals; content is visible by
default so it cannot ship blank in a headless renderer. `prefers-reduced-motion`
is honoured throughout.

## Constraints

- No build step, no bundler, no runtime dependencies. Plain ES modules.
- CSS plus JS under 80 KB uncompressed, enforced by `test/budget.test.js`.
- Banned and asserted against: `border-left`/`border-right` accent stripes over
  1px, `background-clip: text`, any teal (`#1d9bb8`, `#1a8fa8`, `#36b6d6`), and
  the token names `--paper`, `--cream`, `--sand`, `--bone`, `--linen`,
  `--parchment`.
- Every class emitted by `js/render.js` and `js/blocks.js` must have a rule in
  `css/`, enforced by `test/css-contract.test.js`.
