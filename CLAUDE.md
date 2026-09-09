# Ahmed Alawi Radhi, Portfolio (7mxd-Portfolio)

Static personal portfolio hosted on Vercel. Pure HTML/CSS/JS, no framework, no build step. Content lives in `data/*.json` and is rendered client-side by the modules in `js/`.

## Stack

- HTML / CSS / Vanilla JS (ES2020+, loaded as ES modules from `js/main.js`)
- Data in `data/`: `profile.json`, `summary.json`, `education.json`, `experience.json`, `skills.json`, `projects.json`, `settings.json`, plus `milestones.json`, `metrics.json`, and `blocks-registry.json`
- Images and logos in `assets/`
- Hosted on Vercel at the custom domain www.7mxd.me. A lightweight admin UI lives under `admin/`.

## Running locally

Open `index.html` directly or serve the root with any static server:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Important conventions

- **Content is data, not code.** Copy, project lists, experience dates live in `data/*.json`. Do not hard-code strings in HTML or JS, extend the JSON schema instead. (See "Content vs. interface" under Design Context for exactly where that line falls.)
- **Section visibility** is controlled by `data/settings.json` (each section has an `enabled` flag).
- **Accessibility is non-negotiable.** Existing foundations include skip link, `prefers-reduced-motion`, `prefers-contrast: high`, keyboard-usage detection (`html.using-keyboard`), screen-reader announcements for theme/menu changes. Preserve all of these across any redesign.
- **Both themes must work.** Light is primary; dark mode is a derived palette, not an afterthought.
- **Print styles matter.** A recruiter printing the page should still get a clean one-page document.

---

## Design Context

Static site at [www.7mxd.me](https://www.7mxd.me). This section is the
source of truth for design decisions. The full rationale lives in
`docs/superpowers/specs/2026-09-06-editorial-revamp-design.md`.

### Users

Four overlapping audiences, so the page must work at every depth of attention:
a recruiter scanning for thirty seconds, a hiring manager reading for five
minutes, a peer curious about craft, and anyone looking Ahmed up over the next
two or three years. Information hierarchy legible in three seconds, rewarding
to whoever stays. No content is duplicated across depth levels.

### Aesthetic direction

**Plain, photo-led, document-like.** A single column, near-black on off-white, a
reverse-chronological timeline with photographs inline. It should read like a
well-kept personal homepage, not a magazine and not a product landing page.

The trap to avoid is the **editorial-typographic** lane, currently saturated:
display serif italic headline, small monospace labels, ruled column grids,
monochromatic restraint, no imagery. This site avoids it by being genuinely
plain and by letting photographs carry the page.

- Photographs are load-bearing. Zero images is a bug, not restraint.
- No display-serif affectation, no monospace metadata labels, no card grids.
- The background is a near-white that may carry chroma toward the accent's
  hue and no other. `--ground` stays at near-zero chroma; `--ground-tint`
  washes the top 46rem of the document. Never a cream, sand, or beige, never
  a hue more than 15 degrees off the accent, and never token names like
  `--paper` or `--cream`.
- Warmth comes from the logo, the accent, and the photography.

### Palette

Derived from Ahmed's own logo artwork. Every value is verified against both
grounds by `test/tokens-contrast.test.js`; do not change one without running it.

Light: ground `#f9fafc`, tint `#eaf0fb`, raised `#ffffff`, ink `#1c1f32`,
muted `#585b6b`, accent `#2959ae`, accent-strong `#21488c`, rule `#dee2ea`,
rule-accent `#c4d1e8`.

Dark: ground `#15171f`, tint `#1a1f30`, raised `#1c1f2a`, ink `#e9e7e2`,
muted `#9a9aa6`, accent `#90b2df`, accent-strong `#a8c3e6`, rule `#2b3040`,
rule-accent `#374561`.

The accent lives in the letterforms. One rule decides which type gets it: the
accent marks the page's skeleton and its identity, ink carries every statement
Ahmed makes. Accent: the Arabic name, section headings, hero pills, skill and
block labels, year badges, links, bullet glyphs. Ink: the Latin name, the
tagline, the status line, entry and project titles, employers, dates, metric
values, contact labels, the nav wordmark and the CV button. An underline is
what marks a link, which is why blue pills do not read as buttons.

### Typography

Source Serif 4 for prose. Public Sans for navigation, metadata, and labels.
Amiri for the Arabic name only, subsetted to its ten glyphs.

### Content vs. interface

"Content is data, not code" (above) has a precise boundary, ruled explicitly
because earlier work kept re-litigating it:

- **Author's content lives in `data/*.json`.** Anything Ahmed writes about
  himself — experience and education bullets, project descriptions, dates,
  the summary, milestone and metric copy. If it reads as something *he*
  said, it is data.
- **Structural interface labels live in HTML/JS.** Section headings ("Work",
  "Skills"), navigation labels, button and link affordances ("Download CV",
  "View on GitHub"), and anything else that names a piece of UI rather than
  describing Ahmed. These do not become a JSON field just because the
  content-is-data rule exists; a label is not content, it is chrome.

When in doubt: would this string still make sense on a completely different
person's site with the JSON swapped in? If yes, it is an interface label. If
it depends on who Ahmed is or what he did, it is content.

### Content rules

- Every word earns its place. No "highly motivated", no "strong passion".
- The site is not the CV. The CV holds everything; the site holds the best of it.
- Numbers must trace to the CV or to a verified repository.
- Test scores, phone number, and nationality stay off the public page.

### Constraints

- WCAG AA minimum. Keep the skip link, `prefers-reduced-motion`,
  `prefers-contrast`, keyboard-usage detection, and theme announcements.
- CSS plus JS under **40 KB gzipped**, which is what a reader downloads, with a
  100 KB uncompressed parse ceiling behind it. Both enforced by
  `test/budget.test.js`. It was one 80 KB uncompressed number until that became
  the binding constraint on the project and three pieces of work ended with
  comments being deleted to fit — a comment gzips to roughly a quarter of
  itself, so it costs a reader almost nothing and the old count everything. The
  compressed number was 36 KB and reached 35.79 with the admin revamp, close
  enough that the next change would have been paid for by deleting comments
  again. Headroom is part of a budget; without it the number stops measuring the
  page and starts measuring whoever edits next.
- The print stylesheet must keep producing a clean document.
- Banned: the terminal metaphor and shell-command headers, ASCII charts,
  gradient text, `border-left` accent stripes, uniform card grids, and
  language proficiency shown as a percentage.
