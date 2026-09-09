# Ahmed Alawi Radhi — Portfolio

Personal portfolio for a data scientist in Abu Dhabi. Static site, no build step, plain photo-led editorial design.

**[www.7mxd.me](https://www.7mxd.me)**

## Stack

- HTML / CSS / Vanilla JS (ES2020+, loaded as ES modules from `js/main.js`)
- Content stored in `data/*.json`, rendered client-side by the modules in `js/`
- Admin UI under `admin/` for editing content via GitHub API
- Tests via `node --test` (see `test/`)
- Hosted on Vercel, served at the custom domain www.7mxd.me

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

Anything Ahmed writes about himself lives in `data/*.json`: experience and
education bullets, project descriptions, dates, the summary, milestone and
metric copy. Section visibility is toggled via `data/settings.json`.

Structural interface labels are not content and stay in HTML and JS: section
headings, navigation labels, and affordances like "Download CV" or "Read more
about this work". The test is whether the string would still make sense on
someone else's site with the JSON swapped in. See "Content vs. interface" in
`CLAUDE.md` for the full ruling.

The admin UI under `admin/` rebuilds each JSON file from `admin/schema.js`, so a
new field has to be declared there as well as written to the data file, or it is
dropped on the next save. `test/admin-roundtrip.test.js` enforces that.

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
