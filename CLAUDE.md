# Ahmed Alawi Radhi, Portfolio (7mxd.github.io)

Static personal portfolio hosted on GitHub Pages. Pure HTML/CSS/JS, no framework, no build step. Content lives in `data/*.json` and is rendered client-side by ES modules in `js/` (entry point `js/main.js`).

## Stack

- HTML / CSS / Vanilla JS (ES2020+, runs directly from `js/` ES modules, no bundler)
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

Static site at [7mxd.github.io](https://7mxd.github.io).

### Identity

**Living network.** The site is an explorable 3D network (Three.js/WebGL) — a neural form (neurons grouped into three regions: Mathematics, Data Science, Engineering & Products) with data/signals flowing along its synapses. It is *derived from* `data/*.json`, so it is a real, editable résumé, not decoration. Two modes share one data source: **Explore** (the 3D world; click a node for a detail panel) and **Read / CV** (the full linear résumé, the fallback + accessibility + print path).

### Principles

1. **The network is the experience, and it's made of real data** (shared tags/clusters → nodes/edges). Never fake it.
2. **Immersive by default, scannable on demand.** Explore wows; Read serves recruiters; both always reachable.
3. **Robust everywhere.** No WebGL / low-power / reduced-motion gracefully use Read (calm Explore under reduced-motion).
4. **Dark-first 3D; adaptive Read.** Region palette: Mathematics `#6c5ce7`, Data `#d68a1e`, Engineering `#1d9bb8`.

### Constraints

- **Three.js** is an accepted dependency, pinned and loaded from a CDN (`esm.sh/three@0.160.0`) as an ES module, **lazy-loaded only in Explore**. No bundler. Read mode loads no WebGL.
- **A11y:** WCAG AA. Canvas `aria-hidden`; DOM (panels + Read view) is the source of truth. Keep skip link, reduced-motion handling, keyboard detection, focus management, SR announcements, `prefers-contrast`.
- **Data-driven:** all content from `data/*.json` + `blocks-registry.json`; the custom admin at `/admin/` edits it. No résumé content hard-coded.
- **Confidentiality:** only HiSalon is named among Join-Future products.
- **Printable:** Read view prints cleanly; Explore hidden in print.
