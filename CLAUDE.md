# Ahmed Alawi Radhi, Portfolio (7mxd.github.io)

Static personal portfolio hosted on GitHub Pages. Pure HTML/CSS/JS, no framework, no build step. Content lives in `data/*.json` and is rendered client-side by `script.js`.

## Stack

- HTML / CSS / Vanilla JS (ES2020+, runs directly from `script.js`)
- Data in `data/`: `profile.json`, `summary.json`, `education.json`, `experience.json`, `skills.json`, `projects.json`, `settings.json`
- Images and logos in `assets/`
- Hosted on GitHub Pages with custom CNAME. A lightweight admin UI lives under `admin/`.

## Running locally

Open `index.html` directly or serve the root with any static server:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Important conventions

- **Content is data, not code.** Copy, project lists, experience dates live in `data/*.json`. Do not hard-code strings in HTML or JS, extend the JSON schema instead.
- **Section visibility** is controlled by `data/settings.json` (each section has an `enabled` flag).
- **Accessibility is non-negotiable.** Existing foundations include skip link, `prefers-reduced-motion`, `prefers-contrast: high`, keyboard-usage detection (`html.using-keyboard`), screen-reader announcements for theme/menu changes. Preserve all of these across any redesign.
- **Both themes must work.** Light is primary; dark mode is a derived palette, not an afterthought.
- **Print styles matter.** A recruiter printing the page should still get a clean one-page document.

---

## Design Context

Static site at [7mxd.github.io](https://7mxd.github.io). The sections below are the source of truth for all design decisions. Every impeccable-family skill (`/bolder`, `/typeset`, `/colorize`, etc.) should read these before acting.

### Users

The site serves four overlapping audiences simultaneously, so the design must work at every depth of attention:

- **Recruiter, ~30-second scan.** Needs to learn who Ahmed is, what role he wants, and one concrete piece of evidence without scrolling past the fold twice.
- **Hiring manager, 2-5 minute read.** Evaluating fit for a Data Scientist / Quantitative Developer / Data Analyst role. Wants depth: methodology, tools, outcomes, taste.
- **Peer or collaborator.** Curious about craft, approach, and personality. Weird-in-a-good-way is welcome.
- **Ahmed's durable personal site.** Anyone who looks him up over the next 2-3 years. Should age well; timeless over trendy.

**Implication**: information hierarchy must be legible in 3 seconds, but reward the reader who stays. No content is duplicated across depth levels.

### Brand Personality

**Experimental · unexpected · playful.** Ahmed is a data scientist who builds ETL pipelines, writes Python, and has a bachelor's in Applied Mathematics & Statistics from Khalifa University. The portfolio should not look like every other data-science portfolio, it should look like *his*.

Tone: dry humor, technical confidence, no corporate polish. Reads like a well-loved lab notebook or a technical journal with a sense of humor, not a LinkedIn page.

### Aesthetic Direction

**Terminal / data-product, reinterpreted as light-first and warm.** The metaphor is a *printed* terminal output, Knuth's *The TeXbook*, Tufte's quantitative reports, a line-printer dump from a 1970s mainframe, a scientist's field journal kept in LaTeX. Command-line vocabulary shapes the information architecture, but the execution is archival, legible, and human.

Concretely:

- **Typography is monospace-forward, but not monospace-only.** A distinctive monospace for structural elements (section headers, prompts, labels, metadata) paired with a warm serif or humanist sans for body. Body text in monospace is fatiguing, avoid.
- **Light-first palette, warm and paper-like.** Off-white / cream / bone background. Dark mode is supported but not the hero. Accents are *earthy* (ochre, rust, burgundy, olive, ink). **Not** teal (#1a8fa8), cyan, neon green, or electric blue.
- **Dense information, generous margins.** Like a well-typeset book: lots of content, breathing room around it. Avoid card-grid-everywhere. Layouts vary per section.
- **Command-line motifs in the IA, not the decoration.** Section headers can be prompts (`$ ls experience/`, `> whoami`). Do not plaster ASCII art. The terminal is a *frame*, not a costume.
- **Unexpected small moments.** An ASCII chart where a bar graph would be. A blinking cursor in one specific place. A command-log footer. Nothing decorative, every quirk says something.

References: The TeXbook, *Practical Common Lisp* online edition, Tufte's books, the MIT Press monospace tradition, lab notebooks.

Anti-references: Matrix-style green-on-black, hacker-movie terminals, cyberpunk glow, data-science-teal dashboards, Notion-template portfolios, centered-avatar-3-column-cards portfolios.

### Design Principles

1. **Terminal as metaphor, not costume.** Command-line vocabulary shapes IA and copy; execution is warm, printed, legible. A reader who's never used a terminal should still find it beautiful.
2. **Density earns trust.** Lots of signal, tight composition, no filler. If a card can be a line, make it a line.
3. **Dry humor, no performance.** Unexpected choices live in copy, structure, and typography, never in emoji, bounce animations, or glow effects.
4. **Every word earns its place.** No "highly motivated," no "strong passion," no "meaningful projects." If it could appear on any portfolio, it does not appear on this one.
5. **Light-first, dark-respectful.** Design looks best in light mode. Dark mode is supported properly but is not where aesthetic decisions are made.

### Constraints

- **A11y**: WCAG AA minimum. Keep existing foundations intact.
- **Performance**: Keep CSS + JS under ~80KB uncompressed total. Lazy-load below-the-fold images.
- **Printable**: Existing print stylesheet must continue to work.
- **Banned palette**: `#1a8fa8` (current teal), pure cyan, neon green, purple-to-blue gradients.
- **Banned typography**: Montserrat (current), Inter (current), anything from the reflex-fonts list in `impeccable/SKILL.md`.
- **Banned patterns**: gradient text, side-stripe `border-left: 4px solid` dividers, card-grid-for-everything, centered-circular-avatar hero, language-proficiency-as-percentage, staggered fade-ins on every grid.
