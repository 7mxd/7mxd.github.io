# Ahmed Alawi Radhi — Portfolio

Personal portfolio for a data scientist in Abu Dhabi. Static site, no build step, terminal aesthetic rendered in warm paper tones.

**[7mxd.github.io](https://7mxd.github.io)**

## Stack

- HTML / CSS / Vanilla JS (ES2020+)
- Content stored in `data/*.json`, rendered client-side by `script.js`
- Admin UI under `admin/` for editing content via GitHub API
- Tests via `node --test` (see `test/`)
- Hosted on GitHub Pages with a custom CNAME

## Running locally

```bash
python -m http.server 8000
# visit http://localhost:8000
```

No dependencies to install. Open `index.html` directly or use any static server.

## Project structure

```
index.html          Main page
script.js           Client-side rendering
style.css           Styles (light, dark, print)
css/                Additional stylesheets
data/               JSON content (profile, experience, education, skills, projects, settings)
assets/             Images, logos, favicons
admin/              Content management UI
test/               Node.js test suite
```

## Content as data

All copy, dates, and project listings live in `data/*.json`. Section visibility is toggled via `data/settings.json`. Nothing is hard-coded in HTML or JS — extend the JSON schema to add content.

## Design

Terminal-meets-printed-journal: monospace-forward typography for structure, warm serif for body. Light-first palette on off-white/cream, with a proper dark mode. Dense information, generous margins. Command-line motifs shape the IA (`$ ls experience/`, `> whoami`) without becoming costume.

## Accessibility

WCAG AA minimum. Includes skip link, `prefers-reduced-motion` support, `prefers-contrast: high`, keyboard-usage detection, and screen-reader announcements for theme and menu changes. Print stylesheet produces a clean one-page document.

## License

This repository is for personal use.
