# Ahmed Alawi Radhi - Portfolio

A personal portfolio website showcasing my background in Applied Mathematics, Statistics, and Data Science.

## Live Website

**[7mxd.github.io](https://7mxd.github.io)**

## Structure

- `index.html` — two-mode shell (Explore 3D / Read résumé).
- `js/` — ES modules: `main.js` (orchestration), `data.js`, `graph-model.js`, `blocks.js`, `render.js` (sections + `renderPanel`), `theme.js`, `motion.js`, `a11y.js`, `capabilities.js`, `util.js`, and `scene/` (`engine`, `nodes`, `edges`, `interaction`, `layout`, `world`) — the Three.js living network.
- `css/` — `tokens.css`, `base.css`, `sections.css` (Read view), `scene.css` (Explore), `print.css`.
- `data/` — content JSON + `blocks-registry.json`. `admin/` — custom content manager.
- `test/` — Node unit tests for pure logic.

## Running locally

    python -m http.server 8000   # then http://localhost:8000

## Notes

- Three.js (r160) loads from a CDN only in Explore mode; Read mode is dependency-free.
- `npm test` runs the dev-only unit suite (`node --test`).

## Admin (content manager)

A custom, no-build admin lives at `/admin/`. Sign in with GitHub (you must have write access to this repo); it reads and writes `data/*.json` and uploads images to `assets/` via the GitHub Contents API, committing directly to `main` (which redeploys the site). The OAuth token is held in `sessionStorage` for the session only. Block editing is generated from `data/blocks-registry.json`.

## License

This repository is for personal use.
