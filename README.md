# Ahmed Alawi Radhi - Portfolio

A personal portfolio website showcasing my background in Applied Mathematics, Statistics, and Data Science.

## Live Website

**[7mxd.github.io](https://7mxd.github.io)**

## Structure

- `index.html` — shell (nav, hero canvas, section containers).
- `css/` — `tokens.css` (themes/palette), `base.css`, `sections.css`, `graph.css`, `print.css`.
- `js/` — ES modules: `main.js` (entry), `data.js`, `graph-model.js`, `force.js`, `graph-view.js`, `render.js`, `blocks.js`, `theme.js`, `motion.js`, `a11y.js`, `util.js`.
- `data/` — content JSON + `blocks-registry.json` (block schema, shared by site and admin).
- `test/` — Node built-in unit tests for pure logic.

## Running locally

    python -m http.server 8000   # then visit http://localhost:8000

## Tests

    npm test   # node --test test/  (dev-only, nothing ships)

## Admin (content manager)

A custom, no-build admin lives at `/admin/`. Sign in with GitHub (you must have write access to this repo); it reads and writes `data/*.json` and uploads images to `assets/` via the GitHub Contents API, committing directly to `main` (which redeploys the site). The OAuth token is held in `sessionStorage` for the session only. Block editing is generated from `data/blocks-registry.json`.

## License

This repository is for personal use.
