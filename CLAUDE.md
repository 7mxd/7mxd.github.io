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

Static site at [7mxd.github.io](https://7mxd.github.io). Source of truth for design decisions.

### Identity

**Interactive "data world."** Ahmed is an applied mathematician and data scientist who ships production systems. The site's hero is a computed network graph of his work — three clusters (Mathematics, Data Science, Engineering & Products) wired together by the tools and methods (notably AI agents) that connect them. The graph is derived from content, not authored. Below it is a full, readable page.

### Principles

1. **Made of data.** The signature visual is generated from real content (shared tags → edges). Never fake the data.
2. **Wow, then substance.** The network grabs attention; the readable sections below carry the depth. No information lives only in the canvas.
3. **Adaptive, both themes first-class.** Light and dark each get a real design pass.
4. **Motion with respect.** Animation is core but every motion is gated by `prefers-reduced-motion`.
5. **Every word earns its place.** No filler superlatives.

### Constraints

- **A11y:** WCAG AA. Keep skip link, reduced-motion, high-contrast, keyboard detection, SR announcements, focus management. Canvas is `aria-hidden` with a text equivalent.
- **Performance:** CSS + JS < 150KB uncompressed. No build step, no runtime dependencies. Lazy-load below-the-fold images. Freeze/pause the simulation when idle/offscreen.
- **Confidentiality:** Only HiSalon is named among Join-Future products (name + role + general stack). No internal/security/infra specifics.
- **Printable:** `css/print.css` must keep producing a clean document.
- **Cluster palette:** Mathematics indigo `#6c5ce7`, Data amber `#d68a1e`, Engineering cyan `#1d9bb8` (tunable in `data/settings.json` `graph.clusters`).
