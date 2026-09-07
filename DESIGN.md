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

Colour strategy: **the accent lives in the letterforms.** The ground stays a
near-white carrying only a faint wash of the accent hue, and the accent itself
is a text colour almost everywhere it appears. One rule decides which type gets
it: *the accent marks the page's skeleton and its identity; ink carries every
statement Ahmed makes.*

Accent: the Arabic name, every section heading, the hero pills, the skill-group
and block labels, the date badges and their rings, links, bullet glyphs, and
the benchmark's own-result row.

Ink: the Latin name, the tagline, the availability line, every entry and project
title, employers, dates, metric values, project tags, contact labels, the nav
wordmark and the Download CV button.

An underline is what separates a link from accent type — `css/base.css` never
removes it — so blue-and-underlined is clickable and blue-and-not is a label.
That is why the pills can take the full accent without reading as buttons.

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

Body background is a near-white carrying a small amount of chroma **toward the
accent's own hue and no other**. `--ground` stays at near-zero chroma but was rotated
from a warm hsl 60 to a cool hsl 220 at the same lightness, because a warm
off-white next to a cool wash reads as cream; every published contrast figure
below is unchanged to three decimals by that move. `--ground-tint` is that same
near-white pulled 6.1 dE toward hsl 218.8, the accent's own hue, and
`css/base.css` paints it as a wash over the first 46rem of the document, fading
into `--ground` below. The introduction sits on tinted air; the document
under it is plain paper. Cream, sand, and parchment remain banned, and so does
any tint that is not the accent's hue — `test/tokens-contrast.test.js` checks
the hue of every tinted ground and hairline against `--accent` and fails at more
than 15 degrees off, or anywhere near the anti-reference teal at hue 191.

The tint is checked for contrast as a ground in its own right, because the whole
hero sits on it: ink 14.21:1, ink-muted 5.88:1, accent 5.86:1, accent-strong
7.74:1 in light; 13.25:1, 5.88:1, 7.50:1 and 9.05:1 in dark.

`--rule` was `#e2e2df`, a warm grey at hue 60. It drew every hairline on the
page — section dividers, the timeline rail, pill and figure and table borders —
in the one colour family the palette bans elsewhere. It is now the same
lightness (L* 89.80 against 89.81) rotated onto the accent's hue, so no hairline
changed weight and the page's whole structure stopped being beige.

### Light

| Token | Value | Role | Contrast on `--ground` |
|---|---|---|---|
| `--ground` | `#f9fafc` | page | — |
| `--ground-tint` | `#eaf0fb` | top of the wash | — |
| `--ground-raised` | `#ffffff` | callouts, chips | — |
| `--ink` | `#1c1f32` | body and headings | 15.57:1 |
| `--ink-muted` | `#585b6b` | metadata, captions | 6.44:1 |
| `--accent` | `#2959ae` | Arabic name, section headings, pills, links, bullet glyphs, year badges, skill labels | 6.41:1 |
| `--accent-strong` | `#21488c` | link hover, benchmark row | 8.48:1 |
| `--rule` | `#dee2ea` | hairlines only, never text | — |
| `--rule-accent` | `#c4d1e8` | pill, plate and date-badge hairlines only | — |
| `--accent-plate` | `#dce7f9` | the availability line's plate, never text | — |

### Dark

| Token | Value | Contrast on `--ground` |
|---|---|---|
| `--ground` | `#15171f` | — |
| `--ground-tint` | `#1a1f30` | — |
| `--ground-raised` | `#1c1f2a` | — |
| `--ink` | `#e9e7e2` | 14.47:1 |
| `--ink-muted` | `#9a9aa6` | 6.43:1 |
| `--accent` | `#90b2df` | 8.19:1 |
| `--accent-strong` | `#a8c3e6` | 9.89:1 |
| `--rule` | `#2b3040` | — |
| `--rule-accent` | `#374561` | — |
| `--accent-plate` | `#232b42` | — |

`--print-*` tokens live in a second `:root` block and are reassigned onto the
same names inside `css/print.css`. Print is ink on white regardless of theme.

`@media (prefers-contrast: more)` darkens `--ink-muted` and strengthens `--rule`
and `--portrait-ring` in both themes. Any new hairline token belongs in that
block too: the portrait's ring was strengthened for free while it was still
`var(--rule)`, and giving it a name silently dropped it out.

`--logo-ground` is the plate behind a third-party mark that ships in one
colourway, drawn only in dark mode. It answers to three constraints at once —
below `--ink` so a decorative chip is never the brightest thing on the page,
near-zero chroma like every other surface, and light enough that all three
marks read on it.

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
- **Availability.** The one statement on a plate: `--accent-plate` with a
  `--rule-accent` hairline and a 0.375rem radius, no motion. It was deliberately
  unmarked, on the reasoning that a chip reads as a fourth pill and a dot is
  LinkedIn's open-to-work grammar. Unmarked, it did not stop anyone, so it took
  a surface rather than a badge. The text stays `--ink`: the sentence is a
  statement Ahmed makes, and the accent is reserved for structure.
- **Pills.** Outlined, fully rounded, metadata face at `--text-xs`. They state
  facts without tense, which is why the degree lives here rather than in the
  tagline. The Arabic pill switches family and direction. Outlined rather than
  filled so they read as labels, not buttons.
- **Timeline.** One flat `<ol>` drawn against a continuous rail. The rail is a
  single pseudo-element on the `.timeline` wrapper, not per entry, because a
  line that restarts at each boundary reads as a stack of lists rather than one
  chronology. Every entry carries its own circular badge on the rail, month over
  year, with the page ground behind it so it occludes the line rather than
  floating beside it. It was one badge per year until four 2024 entries sat
  under a single label in December, September, April and March order with
  nothing on the rail saying so. The rail narrows on a phone but never
  collapses: stacking the badge above its entry was what made mobile read as an
  undifferentiated list, and mobile is the real surface. Bullets carry a small
  accent dot. Organisation marks render as a small inline chip.
- **Galleries.** One image runs the full measure; two or more sit at most two per
  row with an odd trailing image spanning. Work galleries are a constrained row,
  because the app captures are tall portraits.
- **Numbers strip.** `repeat(auto-fit, minmax(8rem, 1fr))`, four across on
  desktop, two by two on a phone.
- **Benchmark table.** Tabular numerals, one accent-coloured row for the
  author's own result.
- **Skills.** Labelled rows, not a card grid: the category in the accent label
  face on the left, its items on the right, a hairline between each. Items are
  set in the metadata sans and separated by a middle dot, because in the prose
  serif with only a gap between them they read as a sentence missing its
  punctuation. The handful flagged `primary` in `data/skills.json` are set in
  semibold — thirty-three items at identical weight is a keyword dump with
  nowhere for the eye to land, and those are the ones his own summary names. No
  bars, no percentages. The label column collapses below 40rem.

## Motion

Almost none, by intent. No scroll-triggered reveals; content is visible by
default so it cannot ship blank in a headless renderer. `prefers-reduced-motion`
is honoured throughout.

## Constraints

- No build step, no bundler, no runtime dependencies. Plain ES modules.
- CSS plus JS under **36 KB gzipped**, which is what a reader downloads, with a
  100 KB uncompressed parse ceiling behind it. Both enforced by
  `test/budget.test.js`. It was one 80 KB uncompressed number until that became
  the binding constraint on the project and three pieces of work ended with
  comments being deleted to fit — a comment gzips to roughly a quarter of
  itself, so it costs a reader almost nothing and the old count everything.
- Banned and asserted against: `border-left`/`border-right` accent stripes over
  1px, `background-clip: text`, any teal (`#1d9bb8`, `#1a8fa8`, `#36b6d6`), and
  the token names `--paper`, `--cream`, `--sand`, `--bone`, `--linen`,
  `--parchment`.
- Every class emitted by `js/render.js` and `js/blocks.js` must have a rule in
  `css/`, enforced by `test/css-contract.test.js`.
