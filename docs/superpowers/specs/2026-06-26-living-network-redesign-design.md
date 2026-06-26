# Living Network — Portfolio Redesign (v2)

**Date:** 2026-06-26
**Status:** Design — awaiting review
**Supersedes:** the Canvas-2D "data-world" hero (`js/graph-view.js`). Keeps the data-driven architecture and the custom admin (Project B) fully intact.

---

## 1. Summary

Turn the portfolio from "a résumé with a network theme" into an **explorable 3D living network** — the network *is* the experience. The site renders a Three.js (WebGL) 3D structure with a **neural form** (neurons grouped into three regions) and **flowing data/signals** moving along its connections (the "reactor" kinetic layer). It is **derived from `data/*.json`**, so it stays a real résumé and the admin keeps real power.

Two modes share one data source:
- **Explore (default):** the 3D living network; click a node to focus and open a content panel.
- **Read / CV (toggle):** the full linear résumé for fast recruiter scans and printing.

WebGL/reduced-motion/low-power detection gracefully falls back to Read mode, which is also the accessibility path. Three.js loads from a CDN as an ES module (no bundler), lazy-loaded only for Explore.

---

## 2. Goals & non-goals

### Goals
- An immersive, **genuinely interactive 3D network** that reads as a feature, not noise: depth, lighting, bloom, flowing signals, smooth orbit/zoom/fly, hover + click-to-focus.
- The network is **the primary interface**, with the résumé woven in (node panels + a complete Read view).
- 100% **data-driven**: the 3D graph, node panels, and Read view all render from `data/*.json` + `data/blocks-registry.json`, so the admin reshapes everything.
- **Robust everywhere:** modern desktop + mobile run an optimized 3D scene; weak/no-WebGL/reduced-motion fall back to a complete, readable résumé.
- Preserve accessibility foundations and the existing data/admin layers.

### Non-goals (v2)
- Changing the admin (Project B) beyond what new content fields require (none expected).
- A physics sandbox or game; interaction is orbit/zoom/focus + panels, not free-flight collision.
- Multiplayer, audio, or VR.
- Editing files other than the visualization/shell + the project data fixes.

---

## 3. Concept: the living network

- **Form (neural):** nodes are "neurons." **Entity** neurons (projects, experience roles, education, the research project) are large and labeled; **tool** neurons (Python, Supabase, Three.js-of-the-mind, etc.) are small. Edges are "synapses." Nodes group into **three regions** in 3D space — Mathematics, Data Science, Engineering & Products — using the existing `cluster` field; cross-region tools sit between regions (the bridges).
- **Flow (reactor):** light **pulses travel along edges** continuously (data moving through the system), and the network gently "breathes"/fires — a slow activation shimmer. Pulse density scales with a tool's usage / a node's weight.
- **Entrance:** on load, the network **assembles from scattered points and "wakes up"** (a brief activation sweep), then becomes interactive (signal-from-noise, reinterpreted). Under reduced-motion it appears already settled and calm.
- **Palette:** region colors reuse the cluster palette — Mathematics indigo `#6c5ce7`, Data amber `#d68a1e`, Engineering cyan `#1d9bb8` — against a dark space. Bloom makes them glow; tool nodes are dimmer/neutral.

---

## 4. Interaction & content model

- **Camera/controls:** orbit-drag, scroll/pinch zoom, with gentle auto-drift when idle. Optional damping. A "reset view" affordance.
- **Hover/focus:** hovering a node brightens it + its direct synapses and dims the rest; a small label/tooltip shows the name.
- **Click an entity node:** the camera eases toward it and a **content panel** slides in (HTML overlay, not in-canvas) showing that item's full detail — title, status, dates/role, stack/tags, links, and rich blocks (description, the ASCII chart, metrics, etc.) rendered by the existing block renderer. Panel has a close control; closing returns the camera.
- **Click a tool node:** highlights every entity using it (shows a skill's reach) and shows a small "used in N" label.
- **Read / CV toggle (persistent):** switches to the full linear résumé — Summary, Experience, Projects, Skills, Education, Contact — rendered from the same data, scannable and print-friendly. Toggling back returns to Explore. The toggle is always visible.
- **Hero overlay (Explore):** name, one-line positioning, and primary actions (Download CV, Contact) float over the 3D scene; a subtle "drag to explore · click a node" hint.

All panel/Read content is the source of truth in the DOM (accessibility), with the canvas `aria-hidden`.

---

## 5. Architecture

No bundler; ES modules; Three.js imported from a pinned CDN URL (e.g. `https://esm.sh/three@<ver>` or unpkg), **dynamically `import()`-ed only when Explore initializes**.

**Reuse (unchanged or lightly extended):**
- `js/data.js` (`loadData`), `js/graph-model.js` (`deriveGraph` → nodes/edges/clusters/toolUsage), `js/blocks.js`, `js/render.js` (section renderers for Read view + a new `renderPanel`), `js/theme.js`, `js/a11y.js`, `js/motion.js`, `js/util.js`.

**Replace:**
- `js/graph-view.js` (Canvas-2D) → a focused set of Three.js scene modules under `js/scene/`:
  - `scene/engine.js` — renderer, scene, camera, controls, resize, render loop, bloom/post; pause when tab hidden / Explore inactive.
  - `scene/layout.js` — **pure** 3D layout: seed node positions by region + a light force/spread pass (or precomputed spherical regions). No Three/DOM imports → unit-testable.
  - `scene/nodes.js` — build instanced neuron meshes from the derived graph; map cluster → color, weight → size.
  - `scene/edges.js` — synapse lines + animated flowing pulses (shader or moving sprites).
  - `scene/interaction.js` — raycast hover/click, camera focus tween, selection state.
- `js/main.js` — orchestration: load data; build Read view DOM; manage **Explore/Read mode**; capability detection; lazy-init Explore; wire toggle, panels, theme, a11y.
- `index.html` — shell: `#scene` canvas host, `#hero-overlay`, `#panel`, `#read` (Read-view container), mode toggle, theme toggle, `<noscript>`/fallback.

**New:**
- `js/capabilities.js` — **pure-ish** detection helpers: `hasWebGL()`, `prefersReducedMotion()`, `isLowPower()` (heuristic from deviceMemory/hardwareConcurrency/coarse-pointer); returns a recommended initial mode. Pure decision function `chooseInitialMode(caps)` is unit-tested.
- `js/render.js` gains `renderPanel(entity, model)` (pure HTML string) for node detail.

**CSS:** extend `css/` — `scene.css` (canvas host, hero overlay, panel, toggle), keep `tokens.css`/`base.css`/`sections.css` (Read view)/`print.css`. Budget note: the JS/CSS **we author** stays small; Three.js is the one accepted external dependency (lazy-loaded). The old `< 150KB` rule is replaced by: "authored CSS+JS small; Three.js lazy-loaded only in Explore; Read mode loads no WebGL."

---

## 6. Data changes

`data/projects.json` `items` become, in order:
1. **HiSalon** (engineering; existing entry kept).
2. **Stmnt** (engineering; existing entry kept).
3. **Wafa** — **corrected**: status `shipped`; description: a take-home for **Mal** (an AI-native, Sharia-compliant fintech) — a deployed qard-hasan (interest-free) loan-tracking app with a request → review (approve/counter/decline) → settle flow and an immutable audit timeline; a *record of agreement, not a payment processor*. Tags: `Next.js`, `TypeScript`, `Supabase`, `PostgreSQL`, `Row-Level Security`, `Claude / AI agents`, `OpenRouter`, `Tailwind CSS`. Links: webapp `https://wafa.7mxd.me`, github `https://github.com/7mxd/Wafa`.
4. **On a Generalization of Kernel RLS to Nonlinear State-Space Systems** (math; existing KRLS entry with the ASCII chart kept).

**Removed:** `gcc_currency` and the generic "Other production systems at Join-Future" entry.

Clusters/tags on the kept items remain so the graph stays well-connected. No schema changes → admin unaffected; `blocks-registry.json` unchanged.

---

## 7. Performance

- Three.js **lazy-loaded** only when Explore initializes (dynamic `import()`); Read mode never loads it.
- Instanced meshes for nodes; merged/segment geometry for edges; capped `devicePixelRatio` (≤2 desktop, ≤1.5 mobile); bloom at reduced resolution.
- Mobile/low-power: fewer tool nodes, lighter bloom, lower pulse count, paused-on-hidden, frame throttling if needed.
- Idle: keep a gentle loop but throttle; pause entirely when Read mode is active or tab hidden.
- Target ~60fps desktop, ~30–60fps modern mobile.

---

## 8. Accessibility & robustness

- **Capability gate:** `chooseInitialMode(caps)` → Explore on capable devices (desktop + modern mobile), **Read** when no WebGL, reduced-motion-strict, or low-power heuristics fire. A visible "Launch 3D" lets fallback users opt in; a "Read / CV" toggle lets Explore users opt out — always both available.
- **Reduced motion:** no entrance animation, no idle drift, calmed/stopped pulses; the network renders settled and static (still orbit-able if the user drags).
- **Source of truth in DOM:** node panels and the Read view are real HTML; canvas is `aria-hidden`. All résumé information exists without WebGL.
- Preserve: skip link, keyboard-usage detection, focus management, SR announcements (mode/theme changes announced), `prefers-contrast`. Mode toggle and panels are keyboard-operable; focus moves into an opened panel and returns on close.
- **Print:** Read view is the print target (existing `print.css`); Explore hidden in print.

---

## 9. Testing & verification

Hybrid TDD with the existing `node:test` harness (dev-only):
- **Unit (pure):** `scene/layout.js` (positions finite, grouped by region, deterministic given seed); `capabilities.js` `chooseInitialMode(caps)` (truth table: no-WebGL→read, reduced-motion→read or calm, low-power→read, capable→explore); `render.js` `renderPanel` (contains title/tags/links/blocks, escaped); existing `graph-model`/`render`/`blocks` suites stay green; data integrity (projects order + Wafa fields + removals) checkable by a small test.
- **Manual + headless screenshots:** Explore renders (desktop + mobile viewport), entrance, hover/click focus + panel, Read toggle, theme toggle, no-WebGL fallback (force-disable), reduced-motion, print preview, content parity, fps sanity (DevTools).

---

## 10. Risks & mitigations
- **Three.js dependency/size:** accepted, pinned version, lazy-loaded only in Explore; Read mode unaffected. Document the CDN/version.
- **"Brain of nodes" looking generic:** differentiate via real signal flow, restraint, strong typography, and the three-region structure; tune in live iteration (impeccable).
- **Legibility vs. immersion:** node panels + always-available Read view guarantee recruiters get content fast.
- **Mobile perf:** optimized scene + auto-fallback (§7, §8).
- **CDN availability:** if the dynamic import fails, catch → fall back to Read mode with a notice (no broken Explore).
- **WebGL context loss:** handle `webglcontextlost` → attempt restore or fall back to Read.

## 11. Deliverables
- New `js/scene/*`, `js/capabilities.js`, reworked `js/main.js`, `index.html`, `css/scene.css`; `render.js` `renderPanel`.
- Updated `data/projects.json` (reorder + Wafa + removals).
- Rewritten "Design Context" in `CLAUDE.md` (living-network identity; Three.js dependency noted).
- Unit tests for the new pure logic; README note (Three.js via CDN, Explore/Read modes).
- Removed `js/graph-view.js`.

## 12. Out of scope → future
- Per-node 3D custom models, audio, guided tours, deep-linking to a focused node, saved camera bookmarks — all deferred.
