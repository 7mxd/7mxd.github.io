# Ahmed Alawi Radhi — Portfolio

Personal portfolio for a data scientist in Abu Dhabi. Static site, no build step, plain photo-led editorial design.

**[7mxd.github.io](https://7mxd.github.io)**

## Stack

- HTML / CSS / Vanilla JS (ES2020+, loaded as ES modules from `js/main.js`)
- Content stored in `data/*.json`, rendered client-side by the modules in `js/`
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
index.html          Page shell
css/                tokens, base, layout, sections, print
js/                 data loading, timeline composition, renderers, theme
data/               JSON content
assets/             photographs, brand marks, logos, CV
tools/              one-off image processing scripts
admin/              content management UI
test/               node --test suite
```

## Content as data

All copy, dates, and project listings live in `data/*.json`. Section visibility is toggled via `data/settings.json`. Nothing is hard-coded in HTML or JS — extend the JSON schema to add content.

## Design

Plain, photo-led, single-column personal site. Near-black on off-white, with a
palette derived from the site's own logo artwork and verified to pass WCAG AA
in both themes. A reverse-chronological timeline carries roles, degrees,
projects, and awards, composed from the content files rather than authored
twice. Source Serif 4 for prose, Public Sans for metadata, Amiri for the
Arabic name.

## Accessibility

WCAG AA minimum. Includes skip link, `prefers-reduced-motion` support, `prefers-contrast: high`, keyboard-usage detection, and screen-reader announcements for theme and menu changes. Print stylesheet produces a clean one-page document.

## License

This repository is for personal use.
