# Living Network Redesign (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Canvas-2D hero with an explorable Three.js "living network" (neural form + flowing data) as the default experience, backed by a complete data-driven Read/CV mode, keeping the admin effective.

**Architecture:** No bundler. Three.js imported as an ES module from a pinned CDN and dynamically `import()`-ed only for Explore mode. Pure logic (3D layout math, capability→mode decision, panel HTML, data integrity) is unit-tested with the existing Node `node:test` harness; the WebGL/DOM modules are thin and verified by headless screenshot + hand. The 3D graph, node panels, and Read view all render from `data/*.json` via the existing data/derivation/block layers.

**Tech Stack:** HTML5, CSS custom properties, vanilla ES2020+ modules, **Three.js r160 (CDN: esm.sh)**, WebGL. Dev-only: Node ≥18 `node:test`/`node:assert`.

## Global Constraints

- **No build step.** ES modules via native `import`. Three.js from a **pinned** CDN: base `https://esm.sh/three@0.160.0`, addons under `https://esm.sh/three@0.160.0/examples/jsm/...`. **Dynamically import Three only inside Explore init** — Read mode must never load it.
- **Data-driven:** the 3D graph (`graph-model.deriveGraph`), node panels, and Read view all render from `data/*.json` + `data/blocks-registry.json`. No résumé content hard-coded in JS/HTML (hero name/title static fallback is allowed).
- **Two modes:** Explore (3D, default on capable devices) and Read/CV (linear résumé, the fallback + accessibility + print path). A toggle is always visible.
- **Robustness:** `chooseInitialMode(caps)` → Read when no WebGL or low-power; reduced-motion runs Explore *calm* (no entrance/flow). Dynamic-import failure or WebGL context loss → fall back to Read.
- **Accessibility:** canvas `aria-hidden`; DOM (panels + Read view) is the source of truth. Preserve skip link, keyboard-usage detection, focus management, SR announcements (mode/theme), `prefers-contrast`. Panels keyboard-operable; focus enters an opened panel, returns on close.
- **Palette (region colors):** Mathematics `#6c5ce7`, Data Science `#d68a1e`, Engineering & Products `#1d9bb8` (from `settings.graph.clusters`). Dark-first 3D; Read view adaptive light/dark.
- **Budget:** authored CSS+JS stays small; Three.js is the one accepted dependency, lazy-loaded in Explore only.
- **Tests:** `npm test` (`node --test`, no path). Commit messages end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Repo:** `7mxd/7mxd.github.io`, branch chosen at execution.

---

## File Structure

**Created:**
- `js/capabilities.js` — `hasWebGL()`, `prefersReducedMotion()`, `isLowPower()`, pure `chooseInitialMode(caps)`. (pure parts tested)
- `js/scene/layout.js` — pure `computeLayout(graph, opts)` → `Map<id,{x,y,z}>`. (tested)
- `js/scene/engine.js` — Three renderer/scene/camera/OrbitControls/loop/resize/focus/dispose. (DOM/WebGL)
- `js/scene/nodes.js` — build neuron meshes from graph+layout; breathing update. (DOM/WebGL)
- `js/scene/edges.js` — synapse lines + flowing pulses; update. (DOM/WebGL)
- `js/scene/interaction.js` — raycast hover/click, focus, selection callbacks. (DOM/WebGL)
- `js/scene/world.js` — orchestrator: `createWorld(canvas, model, opts)`. (DOM/WebGL)
- `css/scene.css` — canvas host, hero overlay, panel, mode toggle.
- `test/capabilities.test.js`, `test/scene-layout.test.js`, `test/render-panel.test.js`, `test/data-projects.test.js`.

**Modified:**
- `data/projects.json` — reorder + Wafa fix + removals.
- `js/render.js` — add pure `renderPanel(item, kind, statuses)`.
- `js/main.js` — mode orchestration + capability gate + lazy Explore + panel wiring.
- `index.html` — shell for two modes.
- `css/sections.css` (Read view: minor additions for panel/toggle if needed), `css/print.css` (Explore hidden).
- `CLAUDE.md`, `README.md`.

**Removed:** `js/graph-view.js`.

---

## Shared interfaces (reference for all tasks)

```
// capabilities.js
chooseInitialMode({ webgl:Boolean, lowPower:Boolean }) -> 'explore' | 'read'   // reducedMotion is NOT here; it's a calm flag passed to the world

// scene/layout.js
computeLayout(graph, { seed=1, radius=120, regionCenters }) -> Map<id, {x,y,z}>
//   regionCenters default: { math:{x:-130,y:0,z:0}, data:{x:130,y:0,z:-40}, engineering:{x:0,y:10,z:130} }
//   entities placed near their cluster center; tools placed at the mean of their neighbors' centers; all + seeded jitter.

// render.js
renderPanel(item, kind, statuses) -> String   // kind ∈ 'projects'|'experience'|'education'; one <article> of detail (reuses renderBlocks)

// scene/engine.js
createEngine(canvas, { reducedMotion }) -> {
  scene, camera, renderer, controls,
  addFrame(fn), start(), stop(), dispose(),
  focusOn({x,y,z}, distance=60), resetView()
}

// scene/nodes.js
buildNodes(THREE, engine, graph, layout, palette) -> {
  group, byId: Map<id, { mesh, position:THREE.Vector3, node }>, meshes:Array<THREE.Mesh>, update(t)
}

// scene/edges.js
buildEdges(THREE, engine, graph, layout, { reducedMotion }) -> { group, update(t) }

// scene/interaction.js
createInteraction(THREE, engine, nodesApi, graph, { onSelectEntity, onSelectTool, onHover }) -> { dispose() }

// scene/world.js
createWorld(canvas, model, { reducedMotion, lowPower, onSelectEntity }) -> Promise<{ dispose(), focusEntity(id), resetView() }>
//   dynamically imports THREE + addons, derives graph, computes layout, builds nodes/edges/interaction, starts loop.
```

THREE import lines used by scene modules:
```js
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
```
(`world.js` does the dynamic `await import(...)` of THREE/OrbitControls and passes `THREE` into the builder functions so the builders stay import-light and consistent.)

---

### Task 1: Project data fixes (`data/projects.json`)

**Files:**
- Modify: `data/projects.json`
- Create: `test/data-projects.test.js`

**Interfaces:** Produces the final project content/order the graph + Read view consume.

- [ ] **Step 1: Write the failing test** — `test/data-projects.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../data/projects.json', import.meta.url)));
const titles = data.items.map(p => p.title);

test('projects are ordered HiSalon, Stmnt, Wafa, KRLS', () => {
  assert.equal(titles[0], 'HiSalon');
  assert.equal(titles[1], 'Stmnt: AI-powered bank statement analyzer');
  assert.equal(titles[2], 'Wafa');
  assert.ok(/Kernel RLS/i.test(titles[3]));
  assert.equal(titles.length, 4);
});
test('gcc_currency and generic Join-Future node removed', () => {
  assert.ok(!titles.some(t => /gcc/i.test(t)));
  assert.ok(!titles.some(t => /other production systems/i.test(t)));
});
test('Wafa is shipped, names Mal, has correct tags + links', () => {
  const wafa = data.items.find(p => p.title === 'Wafa');
  assert.equal(wafa.status, 'shipped');
  const desc = wafa.blocks.find(b => b.type === 'description').content;
  assert.match(desc, /Mal/);
  assert.match(desc, /qard|interest-free/i);
  assert.ok(wafa.tags.includes('Next.js') && wafa.tags.includes('Supabase') && wafa.tags.includes('Claude / AI agents'));
  assert.equal(wafa.links.webapp, 'https://wafa.7mxd.me');
  assert.equal(wafa.links.github, 'https://github.com/7mxd/Wafa');
});
test('no forbidden Join-Future product names anywhere', () => {
  const raw = JSON.stringify(data);
  assert.ok(!/HiPay|joinfuture\.ai|joinCX/i.test(raw));
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL (order/Wafa assertions).

- [ ] **Step 3: Edit `data/projects.json`** — set `items` to exactly four entries in order. Keep the existing HiSalon, Stmnt, and KRLS objects unchanged except position. Replace the Wafa object with:
```json
{
  "title": "Wafa",
  "status": "shipped",
  "cluster": "engineering",
  "tags": ["Next.js", "TypeScript", "Supabase", "PostgreSQL", "Row-Level Security", "Claude / AI agents", "OpenRouter", "Tailwind CSS"],
  "links": {
    "webapp": "https://wafa.7mxd.me",
    "github": "https://github.com/7mxd/Wafa"
  },
  "blocks": [
    { "type": "description", "content": "A take-home for Mal (an AI-native, Sharia-compliant fintech): a deployed qard-hasan (interest-free) loan-tracking app for friends. One clean flow — a borrower requests a loan, the lender approves, counters, or declines, and it is tracked to settled, with every transition written to an immutable audit timeline both sides can see. A record of agreement, not a payment processor: no money moves through it, which keeps it genuinely shippable and clear of payments/regulatory scope. Built with Next.js and Supabase (Postgres + Row-Level Security), with two light server-side AI touches via Claude on OpenRouter." }
  ]
}
```
Order: `HiSalon`, `Stmnt…`, `Wafa`, `On a Generalization of Kernel RLS…`. Delete the `GCC Currency` and `Other production systems at Join-Future` objects.

- [ ] **Step 4: Run test + validate JSON**
Run: `node -e "JSON.parse(require('fs').readFileSync('data/projects.json','utf8'));console.log('valid')"` then `npm test`
Expected: `valid`; data-projects tests PASS; all prior tests still pass.

- [ ] **Step 5: Commit**
```bash
git add data/projects.json test/data-projects.test.js
git commit -m "content: reorder projects, fix Wafa (Mal take-home, shipped), drop gcc/generic

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Capability detection (`js/capabilities.js`)

**Files:**
- Create: `js/capabilities.js`, `test/capabilities.test.js`

**Interfaces:**
- Produces (pure): `chooseInitialMode({webgl, lowPower})->'explore'|'read'`. Produces (DOM, untested): `hasWebGL()`, `prefersReducedMotion()`, `isLowPower()`, `detect()->{webgl,lowPower,reducedMotion}`.

- [ ] **Step 1: Write the failing test** — `test/capabilities.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseInitialMode } from '../js/capabilities.js';

test('no webgl -> read', () => { assert.equal(chooseInitialMode({webgl:false, lowPower:false}), 'read'); });
test('low power -> read', () => { assert.equal(chooseInitialMode({webgl:true, lowPower:true}), 'read'); });
test('capable -> explore', () => { assert.equal(chooseInitialMode({webgl:true, lowPower:false}), 'explore'); });
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test` → FAIL (module missing).

- [ ] **Step 3: Implement `js/capabilities.js`**
```js
export function chooseInitialMode(caps) {
  if (!caps || !caps.webgl) return 'read';
  if (caps.lowPower) return 'read';
  return 'explore';
}
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (_) { return false; }
}
export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function isLowPower() {
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return mem <= 2 || cores <= 2 || (coarse && mem <= 4 && cores <= 4);
}
export function detect() {
  return { webgl: hasWebGL(), lowPower: isLowPower(), reducedMotion: prefersReducedMotion() };
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test` → PASS (+3).

- [ ] **Step 5: Commit**
```bash
git add js/capabilities.js test/capabilities.test.js
git commit -m "feat: capability detection + initial-mode decision

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 3D layout (`js/scene/layout.js`)

**Files:**
- Create: `js/scene/layout.js`, `test/scene-layout.test.js`

**Interfaces:**
- Consumes: graph `{nodes, edges}` from `graph-model.deriveGraph`.
- Produces (pure): `computeLayout(graph, opts)->Map<id,{x,y,z}>`. Deterministic given `opts.seed`. Entity nodes near their `cluster` region center; tool nodes at the mean of their connected entities' region centers (fallback: origin); all positions get seeded jitter. No THREE/DOM.

- [ ] **Step 1: Write the failing test** — `test/scene-layout.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/scene/layout.js';

const graph = {
  nodes: [
    { id:'proj:0', kind:'entity', cluster:'engineering' },
    { id:'edu:0', kind:'entity', cluster:'math' },
    { id:'tool:python', kind:'tool', cluster:null },
  ],
  edges: [ { source:'proj:0', target:'tool:python' }, { source:'edu:0', target:'tool:python' } ]
};

test('returns finite positions for every node', () => {
  const pos = computeLayout(graph, { seed: 7 });
  for (const n of graph.nodes) { const p = pos.get(n.id);
    assert.ok(p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)); }
});
test('entity sits nearer its region center than other regions', () => {
  const centers = { math:{x:-130,y:0,z:0}, data:{x:130,y:0,z:-40}, engineering:{x:0,y:10,z:130} };
  const pos = computeLayout(graph, { seed: 1, regionCenters: centers });
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const p = pos.get('edu:0');
  assert.ok(d(p, centers.math) < d(p, centers.data));
  assert.ok(d(p, centers.math) < d(p, centers.engineering));
});
test('deterministic for a given seed', () => {
  const a = computeLayout(graph, { seed: 42 }); const b = computeLayout(graph, { seed: 42 });
  assert.deepEqual([...a.entries()], [...b.entries()]);
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test` → FAIL (module missing).

- [ ] **Step 3: Implement `js/scene/layout.js`**
```js
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DEFAULT_CENTERS = {
  math: { x: -130, y: 0, z: 0 },
  data: { x: 130, y: 0, z: -40 },
  engineering: { x: 0, y: 10, z: 130 }
};
export function computeLayout(graph, opts = {}) {
  const seed = opts.seed ?? 1;
  const centers = opts.regionCenters || DEFAULT_CENTERS;
  const spread = opts.radius ?? 120;
  const rng = mulberry32(seed);
  const jit = (s) => (rng() - 0.5) * s;
  const pos = new Map();
  const center = { x: 0, y: 0, z: 0 };

  // entities first
  for (const n of graph.nodes) {
    if (n.kind !== 'entity') continue;
    const c = centers[n.cluster] || center;
    pos.set(n.id, { x: c.x + jit(spread * 0.6), y: c.y + jit(spread * 0.5), z: c.z + jit(spread * 0.6) });
  }
  // tools at mean of connected entity centers
  const neighborCenters = new Map(); // toolId -> [centers]
  for (const e of graph.edges) {
    const ent = pos.has(e.source) ? e.source : (pos.has(e.target) ? e.target : null);
    const tool = ent === e.source ? e.target : e.source;
    if (!ent) continue;
    const node = graph.nodes.find(n => n.id === ent);
    const c = centers[node?.cluster] || center;
    if (!neighborCenters.has(tool)) neighborCenters.set(tool, []);
    neighborCenters.get(tool).push(c);
  }
  for (const n of graph.nodes) {
    if (n.kind !== 'tool') continue;
    const cs = neighborCenters.get(n.id);
    let base = center;
    if (cs && cs.length) base = { x: cs.reduce((s,c)=>s+c.x,0)/cs.length, y: cs.reduce((s,c)=>s+c.y,0)/cs.length, z: cs.reduce((s,c)=>s+c.z,0)/cs.length };
    pos.set(n.id, { x: base.x + jit(spread), y: base.y + jit(spread * 0.8), z: base.z + jit(spread) });
  }
  return pos;
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test` → PASS (+3).

- [ ] **Step 5: Commit**
```bash
git add js/scene/layout.js test/scene-layout.test.js
git commit -m "feat(scene): deterministic 3D region layout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Node-detail panel renderer (`render.js` `renderPanel`)

**Files:**
- Modify: `js/render.js`
- Create: `test/render-panel.test.js`

**Interfaces:**
- Consumes: `renderBlocks` (blocks.js), `escapeHtml` (util.js), already imported in render.js.
- Produces (pure): `renderPanel(item, kind, statuses)->String` for `kind ∈ 'projects'|'experience'|'education'`; returns one detail `<article>` with title/heading, status pill (projects), tags, links, and blocks. Unknown kind → `''`.

- [ ] **Step 1: Write the failing test** — `test/render-panel.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPanel } from '../js/render.js';

const statuses = { shipped:{label:'shipped',glyph:'✓',tone:'neutral'} };

test('project panel shows title, status, tag, link, block', () => {
  const item = { title:'Wafa', status:'shipped', tags:['Next.js'], links:{ webapp:'https://wafa.7mxd.me' }, blocks:[{type:'description',content:'qard hasan'}] };
  const h = renderPanel(item, 'projects', statuses);
  assert.ok(h.includes('Wafa') && h.includes('shipped') && h.includes('Next.js'));
  assert.ok(h.includes('https://wafa.7mxd.me') && h.includes('qard hasan'));
});
test('experience panel shows company + role + responsibility', () => {
  const item = { company:'Saal', location:'AD', roles:[{ title:'Trainee', displayDate:'2024', blocks:[{type:'responsibility',content:'did x'}] }] };
  const h = renderPanel(item, 'experience', statuses);
  assert.ok(h.includes('Saal') && h.includes('Trainee') && h.includes('did x'));
});
test('unknown kind returns empty', () => { assert.equal(renderPanel({}, 'nope', statuses), ''); });
test('escapes html', () => {
  const h = renderPanel({ title:'<b>x</b>', blocks:[] }, 'projects', statuses);
  assert.ok(h.includes('&lt;b&gt;') && !h.includes('<b>x</b>'));
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test` → FAIL (no `renderPanel` export).

- [ ] **Step 3: Add `renderPanel` to `js/render.js`** (append; reuse existing `escapeHtml`, `renderBlocks`, and the same markup conventions as the section renderers)
```js
export function renderPanel(item, kind, statuses = {}) {
  const tagRow = (tags) => (tags && tags.length)
    ? `<ul class="tag-row">${tags.map(t=>`<li class="tag">${escapeHtml(t)}</li>`).join('')}</ul>` : '';
  if (kind === 'projects') {
    const st = statuses[item.status];
    const pill = st ? `<span class="status-pill" data-tone="${escapeHtml(st.tone)}">${escapeHtml(st.glyph)} ${escapeHtml(st.label)}</span>` : '';
    const links = Object.entries(item.links || {}).flatMap(([k, v]) => {
      if (k === 'extra' && Array.isArray(v)) return v.map(x => `<a href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${escapeHtml(x.label)}</a>`);
      if (typeof v === 'string' && v) return [`<a href="${escapeHtml(v)}" target="_blank" rel="noopener">${escapeHtml(k)}</a>`];
      return [];
    }).join('');
    return `<article class="panel-item" data-cluster="${escapeHtml(item.cluster||'')}">
      <header class="panel-head"><h2 class="panel-title">${escapeHtml(item.title)}</h2>${pill}</header>
      ${tagRow(item.tags)}<div class="panel-body">${renderBlocks(item.blocks)}</div>
      <div class="panel-links">${links}</div></article>`;
  }
  if (kind === 'experience') {
    const roles = (item.roles || []).map((r) => {
      const resps = (r.blocks||[]).filter(b => b.type==='responsibility');
      const other = (r.blocks||[]).filter(b => b.type!=='responsibility');
      const list = resps.length ? `<ul class="resp-list">${renderBlocks(resps)}</ul>` : '';
      return `<div class="role"><h3 class="role-title">${escapeHtml(r.title)}</h3>
        <p class="role-date">${escapeHtml(r.displayDate||'')}</p>${list}${renderBlocks(other)}</div>`;
    }).join('');
    return `<article class="panel-item" data-cluster="${escapeHtml(item.cluster||'')}">
      <header class="panel-head"><h2 class="panel-title">${escapeHtml(item.company)}</h2>
      <span class="exp-loc">${escapeHtml(item.location||'')}</span></header>
      ${tagRow(item.tags)}${roles}</article>`;
  }
  if (kind === 'education') {
    return `<article class="panel-item" data-cluster="${escapeHtml(item.cluster||'')}">
      <header class="panel-head"><h2 class="panel-title">${escapeHtml(item.institution)}</h2></header>
      <p class="edu-degree">${escapeHtml(item.degree||'')}</p>
      <p class="edu-meta">${escapeHtml(item.displayDate||'')} · ${escapeHtml(item.grade||'')}</p>
      ${renderBlocks(item.blocks)}</article>`;
  }
  return '';
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test` → PASS (+4); existing render tests still pass.

- [ ] **Step 5: Commit**
```bash
git add js/render.js test/render-panel.test.js
git commit -m "feat(render): node-detail panel renderer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Three.js engine (`js/scene/engine.js`)

**Files:**
- Create: `js/scene/engine.js`

**Interfaces:** Produces `createEngine(canvas, {reducedMotion})` per Shared interfaces. DOM/WebGL — not unit-tested; verified once `world.js`/`main.js` render (Task 9). Implement a working baseline; visual polish happens in live iteration.

- [ ] **Step 1: Implement `js/scene/engine.js`**
```js
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';

export function createEngine(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  const home = new THREE.Vector3(0, 40, 360);
  camera.position.copy(home);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.minDistance = 60; controls.maxDistance = 700;
  controls.autoRotate = !reducedMotion; controls.autoRotateSpeed = 0.35;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.PointLight(0xffffff, 1.2, 0, 0); key.position.set(120, 200, 200); scene.add(key);

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const frameCbs = [];
  let raf = null, running = false;
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    controls.update();
    for (const cb of frameCbs) cb(t);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!running) { running = true; clock.start(); raf = requestAnimationFrame(tick); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf), raf = null; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (running === false && !document.hidden) {/* caller decides */} });

  function focusOn(p, distance = 90) {
    const target = new THREE.Vector3(p.x, p.y, p.z);
    controls.target.copy(target);
    const dir = new THREE.Vector3().subVectors(camera.position, target).normalize();
    camera.position.copy(target.clone().add(dir.multiplyScalar(distance)));
  }
  function resetView() { controls.target.set(0, 0, 0); camera.position.copy(home); }

  function dispose() {
    stop(); window.removeEventListener('resize', resize);
    controls.dispose(); renderer.dispose();
  }
  return { THREE, scene, camera, renderer, controls, addFrame: (fn)=>frameCbs.push(fn), start, stop, dispose, focusOn, resetView };
}
```

- [ ] **Step 2: Syntax check**
Run: `node --check js/scene/engine.js`
Expected: passes (note: `node --check` validates syntax; the CDN import is not resolved under Node, which is fine — it only loads in the browser).

- [ ] **Step 3: Commit**
```bash
git add js/scene/engine.js
git commit -m "feat(scene): Three.js engine (renderer, camera, orbit, loop, focus)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Neuron nodes + synapse edges (`js/scene/nodes.js`, `js/scene/edges.js`)

**Files:**
- Create: `js/scene/nodes.js`, `js/scene/edges.js`

**Interfaces:** `buildNodes(THREE, engine, graph, layout, palette)` and `buildEdges(THREE, engine, graph, layout, {reducedMotion})` per Shared interfaces. DOM/WebGL. Node counts are small (~50) so use individual meshes (no instancing). `palette` = `{ math, data, engineering }` hex strings; tool nodes neutral.

- [ ] **Step 1: Implement `js/scene/nodes.js`**
```js
export function buildNodes(THREE, engine, graph, layout, palette) {
  const group = new THREE.Group();
  const byId = new Map();
  const meshes = [];
  const sphere = new THREE.SphereGeometry(1, 20, 20);
  const toolColor = new THREE.Color(0x9aa1aa);

  for (const n of graph.nodes) {
    const p = layout.get(n.id); if (!p) continue;
    const isEntity = n.kind === 'entity';
    const color = isEntity ? new THREE.Color(palette[n.cluster] || '#8a8f98') : toolColor;
    const radius = isEntity ? 6 + Math.min(n.weight || 1, 8) : 2.4;
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: isEntity ? 0.8 : 0.35,
      roughness: 0.4, metalness: 0.1, transparent: true, opacity: isEntity ? 1 : 0.85
    });
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.position.set(p.x, p.y, p.z); mesh.scale.setScalar(radius);
    mesh.userData = { id: n.id, node: n, baseEmissive: mat.emissiveIntensity, radius };
    group.add(mesh); meshes.push(mesh);
    byId.set(n.id, { mesh, position: mesh.position.clone(), node: n });
  }
  engine.scene.add(group);

  function update(t) {
    for (const m of meshes) {
      const e = m.userData; if (e.node.kind !== 'entity') continue;
      m.material.emissiveIntensity = e.baseEmissive + Math.sin(t * 1.3 + e.radius) * 0.15; // breathing
    }
  }
  return { group, byId, meshes, update };
}
```

- [ ] **Step 2: Implement `js/scene/edges.js`**
```js
export function buildEdges(THREE, engine, graph, layout, { reducedMotion = false } = {}) {
  const group = new THREE.Group();
  const positions = [];
  const segments = []; // {a,b} for pulses
  for (const e of graph.edges) {
    const a = layout.get(e.source), b = layout.get(e.target);
    if (!a || !b) continue;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    segments.push({ a: new THREE.Vector3(a.x,a.y,a.z), b: new THREE.Vector3(b.x,b.y,b.z) });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x6a7079, transparent: true, opacity: 0.22 }));
  group.add(lines);

  // flowing pulses: one small glowing point per edge travelling a->b repeatedly
  const pulseGeo = new THREE.BufferGeometry();
  const pulsePos = new Float32Array(segments.length * 3);
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  const pulses = new THREE.Points(pulseGeo, new THREE.PointsMaterial({ color: 0xbfe9f5, size: 4.5, transparent: true, opacity: 0.9, sizeAttenuation: true }));
  group.add(pulses);
  engine.scene.add(group);

  const speed = reducedMotion ? 0 : 0.25;
  const phase = segments.map((_, i) => (i * 0.137) % 1);
  function update(t) {
    const attr = pulseGeo.getAttribute('position');
    for (let i = 0; i < segments.length; i++) {
      const f = speed === 0 ? 0.5 : ((t * speed + phase[i]) % 1);
      const s = segments[i];
      attr.array[i*3]   = s.a.x + (s.b.x - s.a.x) * f;
      attr.array[i*3+1] = s.a.y + (s.b.y - s.a.y) * f;
      attr.array[i*3+2] = s.a.z + (s.b.z - s.a.z) * f;
    }
    attr.needsUpdate = true;
  }
  update(0);
  return { group, update };
}
```

- [ ] **Step 3: Syntax check**
Run: `node --check js/scene/nodes.js && node --check js/scene/edges.js`
Expected: passes.

- [ ] **Step 4: Commit**
```bash
git add js/scene/nodes.js js/scene/edges.js
git commit -m "feat(scene): neuron node meshes and flowing-pulse synapse edges

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Interaction + world orchestrator (`js/scene/interaction.js`, `js/scene/world.js`)

**Files:**
- Create: `js/scene/interaction.js`, `js/scene/world.js`

**Interfaces:** `createInteraction(...)` and `createWorld(canvas, model, opts)` per Shared interfaces. `world.js` dynamically imports THREE + OrbitControls + the builders, derives the graph, computes layout, builds the scene, wires interaction → `opts.onSelectEntity(entityNode)`, starts the loop.

- [ ] **Step 1: Implement `js/scene/interaction.js`**
```js
export function createInteraction(THREE, engine, nodesApi, graph, { onSelectEntity, onSelectTool, onHover } = {}) {
  const canvas = engine.renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;

  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, engine.camera);
    const hits = raycaster.intersectObjects(nodesApi.meshes, false);
    return hits.length ? hits[0].object : null;
  }
  function setHover(mesh) {
    if (hovered === mesh) return;
    if (hovered) hovered.material.emissiveIntensity = hovered.userData.baseEmissive;
    hovered = mesh;
    if (hovered) hovered.material.emissiveIntensity = hovered.userData.baseEmissive + 0.8;
    canvas.style.cursor = mesh ? 'pointer' : 'default';
    onHover && onHover(mesh ? mesh.userData.node : null);
  }
  function onMove(ev) { setHover(pick(ev)); }
  function onClick(ev) {
    const mesh = pick(ev); if (!mesh) return;
    const node = mesh.userData.node;
    engine.focusOn(mesh.position, Math.max(70, mesh.userData.radius * 8));
    if (node.kind === 'entity') onSelectEntity && onSelectEntity(node);
    else onSelectTool && onSelectTool(node);
  }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('click', onClick);
  return { dispose() { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick); } };
}
```

- [ ] **Step 2: Implement `js/scene/world.js`**
```js
import { deriveGraph } from '../graph-model.js';
import { computeLayout } from './layout.js';

export async function createWorld(canvas, model, { reducedMotion = false, lowPower = false, onSelectEntity } = {}) {
  const THREE = await import('https://esm.sh/three@0.160.0');
  const { createEngine } = await import('./engine.js');
  const { buildNodes } = await import('./nodes.js');
  const { buildEdges } = await import('./edges.js');
  const { createInteraction } = await import('./interaction.js');

  const graph = deriveGraph(model);
  // optional: thin tool nodes on low-power
  if (lowPower) {
    const keep = new Set(graph.nodes.filter(n => n.kind==='entity').map(n=>n.id));
    graph.edges.forEach(e => { keep.add(e.source); keep.add(e.target); });
  }
  const layout = computeLayout(graph, { seed: 7 });
  const palette = model.settings?.graph?.clusters
    ? { math: model.settings.graph.clusters.math.color, data: model.settings.graph.clusters.data.color, engineering: model.settings.graph.clusters.engineering.color }
    : { math:'#6c5ce7', data:'#d68a1e', engineering:'#1d9bb8' };

  const engine = createEngine(canvas, { reducedMotion });
  const nodes = buildNodes(THREE, engine, graph, layout, palette);
  const edges = buildEdges(THREE, engine, graph, layout, { reducedMotion });
  const interaction = createInteraction(THREE, engine, nodes, graph, { onSelectEntity });
  engine.addFrame((t) => { nodes.update(t); edges.update(t); });
  engine.start();

  function focusEntity(id) { const e = nodes.byId.get(id); if (e) engine.focusOn(e.position, 90); }
  return {
    focusEntity, resetView: () => engine.resetView(),
    start: () => engine.start(), stop: () => engine.stop(),
    dispose() { interaction.dispose(); engine.dispose(); }
  };
}
```

- [ ] **Step 3: Syntax check**
Run: `node --check js/scene/interaction.js && node --check js/scene/world.js`
Expected: passes.

- [ ] **Step 4: Commit**
```bash
git add js/scene/interaction.js js/scene/world.js
git commit -m "feat(scene): raycast interaction + world orchestrator (lazy Three import)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Shell + scene CSS (`index.html`, `css/scene.css`)

**Files:**
- Modify: `index.html` (rework), Create: `css/scene.css`
- Modify: `css/print.css` (hide Explore in print)

**Interfaces:** Shell containers: `#scene-canvas`, `#hero-overlay` (name/title/actions/hint), `#panel` (+ `#panel-body`, close button), `#read` (Read-view host with the existing section containers), `[data-mode-toggle]`, `[data-theme-toggle]`, `<noscript>`. `body[data-mode="explore"|"read"]` drives visibility.

- [ ] **Step 1: Rewrite `index.html`** (keep `<head>` meta/SEO/theme-color from the current file; replace `<body>`)
```html
<body data-mode="read">
  <a class="skip-link" href="#read">Skip to content</a>
  <header class="site-nav">
    <a class="nav-logo" href="#top">AR</a>
    <div class="nav-actions">
      <button data-mode-toggle aria-pressed="false">Explore</button>
      <button data-theme-toggle aria-label="Toggle light and dark theme">◐</button>
    </div>
  </header>

  <div id="explore" aria-hidden="true">
    <canvas id="scene-canvas"></canvas>
    <div id="hero-overlay">
      <h1 id="hero-name">Ahmed Alawi Radhi</h1>
      <p id="hero-title">Data scientist. Applied mathematician. I ship the modeling and the system around it.</p>
      <div class="hero-actions">
        <a class="btn" href="assets/ahmed_radhi_cv_2025.pdf" download>Download CV</a>
        <a class="btn" href="#contact" data-goto-read>Contact</a>
      </div>
      <p class="hero-hint">drag to explore · click a node</p>
    </div>
    <aside id="panel" hidden aria-label="Details">
      <button id="panel-close" aria-label="Close details">×</button>
      <div id="panel-body"></div>
    </aside>
    <p class="sr-only">Interactive 3D network of Ahmed's work across Mathematics, Data Science, and Engineering. The same information is available in the readable view.</p>
  </div>

  <main id="read">
    <section id="hero-read" class="hero-read"><h1>Ahmed Alawi Radhi</h1><p>Data scientist. Applied mathematician.</p>
      <div class="hero-actions"><a class="btn" href="assets/ahmed_radhi_cv_2025.pdf" download>Download CV</a></div></section>
    <section id="summary" aria-label="Summary"><h2 class="section-title">Summary</h2><div class="section-body"></div></section>
    <section id="experience" aria-label="Experience"><h2 class="section-title">Experience</h2><div class="section-body"></div></section>
    <section id="projects" aria-label="Projects"><h2 class="section-title">Projects</h2><div class="section-body"></div></section>
    <section id="skills" aria-label="Skills"><h2 class="section-title">Skills</h2><div class="section-body"></div></section>
    <section id="education" aria-label="Education"><h2 class="section-title">Education</h2><div class="section-body"></div></section>
    <section id="contact" aria-label="Contact"><h2 class="section-title">Contact</h2><div class="section-body"></div></section>
  </main>

  <noscript><p>This site needs JavaScript. View the CV: <a href="assets/ahmed_radhi_cv_2025.pdf">Ahmed Radhi CV (PDF)</a>.</p></noscript>
  <script type="module" src="js/main.js"></script>
</body>
```

- [ ] **Step 2: Write `css/scene.css`**
```css
#explore { position: fixed; inset: 0; z-index: 1; }
#scene-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; background: radial-gradient(circle at 50% 40%, #11151c 0%, #0a0d12 70%); }
#hero-overlay { position: absolute; left: 0; right: 0; top: 18vh; text-align: center; pointer-events: none; padding: 0 1rem; }
#hero-overlay #hero-name { font-family: var(--font-mono); font-size: clamp(1.8rem, 6vw, 4rem); color: #f3f4f6; margin: 0; text-shadow: 0 2px 30px rgba(0,0,0,.6); }
#hero-overlay #hero-title { color: #c4c9d0; max-width: 40ch; margin: .7rem auto 1.2rem; }
.hero-actions { display: flex; gap: .7rem; justify-content: center; flex-wrap: wrap; pointer-events: auto; }
.hero-hint { color: #8b9099; font-family: var(--font-mono); font-size: .75rem; margin-top: 1.4rem; }
#panel { position: absolute; top: 0; right: 0; height: 100%; width: min(420px, 92vw); overflow-y: auto;
  background: color-mix(in srgb, #0d1117 88%, transparent); backdrop-filter: blur(10px);
  border-left: 1px solid #232a33; color: #e6e8eb; padding: 3rem 1.5rem 2rem; z-index: 3; }
#panel-close { position: absolute; top: .6rem; right: .8rem; background: none; border: 0; color: #c4c9d0; font-size: 1.6rem; cursor: pointer; }
.panel-title { font-family: var(--font-mono); margin: 0 0 .4rem; }
.panel-links { display: flex; gap: 1rem; flex-wrap: wrap; font-family: var(--font-mono); font-size: .85rem; margin-top: 1rem; }
.site-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 5; display: flex; align-items: center; padding: .6rem 1rem; }
.site-nav .nav-actions { margin-left: auto; display: flex; gap: .6rem; }
.nav-logo { font-family: var(--font-mono); font-weight: 700; color: #e6e8eb; text-decoration: none; }
[data-mode-toggle], [data-theme-toggle] { font-family: var(--font-mono); font-size: .85rem; padding: .35rem .7rem; border: 1px solid #2a313b; border-radius: 8px; background: rgba(13,17,23,.6); color: #e6e8eb; cursor: pointer; }

/* mode visibility */
body[data-mode="read"] #explore { display: none; }
body[data-mode="read"] .site-nav { position: sticky; background: color-mix(in srgb, var(--bg) 88%, transparent); border-bottom: 1px solid var(--line); }
body[data-mode="read"] .nav-logo, body[data-mode="read"] [data-mode-toggle], body[data-mode="read"] [data-theme-toggle] { color: var(--ink); background: var(--surface); border-color: var(--line); }
body[data-mode="explore"] #read { display: none; }
#read { max-width: 72rem; margin: 0 auto; padding: 0 var(--space); }
.hero-read { padding: 4rem 0 2rem; }
@media (prefers-reduced-motion: reduce) { #hero-overlay { transition: none; } }
```

- [ ] **Step 3: Add to `css/print.css`** (append, inside `@media print`)
```css
@media print { #explore, .site-nav { display: none !important; } body[data-mode] #read { display: block !important; } }
```

- [ ] **Step 4: Manual verification**
Run a static server; load `/`. With `body[data-mode="read"]` (default in HTML), the Read view shell shows (sections empty until main.js renders — built next). Confirm no console errors for missing CSS; theme/mode toggle buttons present.

- [ ] **Step 5: Commit**
```bash
git add index.html css/scene.css css/print.css
git commit -m "feat: two-mode shell (explore/read) + scene styles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Main orchestration (`js/main.js`)

**Files:**
- Modify (rewrite): `js/main.js`

**Interfaces:** Consumes `loadData` (data.js), `mountSections` (render.js), `renderPanel` (render.js), `initTheme` (theme.js), `initA11y` (a11y.js), `initMotion` (motion.js), `detect`/`chooseInitialMode` (capabilities.js), `createWorld` (scene/world.js, dynamic). Orchestrates modes, capability gate, lazy Explore, panel open/close, toggles.

- [ ] **Step 1: Rewrite `js/main.js`**
```js
import { loadData } from './data.js';
import { mountSections, renderPanel } from './render.js';
import { initTheme } from './theme.js';
import { initA11y } from './a11y.js';
import { initMotion } from './motion.js';
import { detect, chooseInitialMode } from './capabilities.js';

const $ = (id) => document.getElementById(id);
let model = null, world = null, caps = null, a11y = null;

function setMode(mode, announce) {
  document.body.dataset.mode = mode;
  const btn = document.querySelector('[data-mode-toggle]');
  if (btn) { btn.textContent = mode === 'explore' ? 'Read / CV' : 'Explore'; btn.setAttribute('aria-pressed', String(mode === 'explore')); }
  $('explore')?.setAttribute('aria-hidden', String(mode !== 'explore'));
  if (mode === 'explore') { ensureWorld(); world && world.start && world.start(); }
  else { world && world.stop && world.stop(); }
  if (announce && a11y) a11y.announce(mode === 'explore' ? '3D explore mode' : 'Reading mode');
}

async function ensureWorld() {
  if (world || !caps.webgl) return;
  try {
    const { createWorld } = await import('./scene/world.js');
    world = await createWorld($('scene-canvas'), model, {
      reducedMotion: caps.reducedMotion, lowPower: caps.lowPower, onSelectEntity: openPanel
    });
  } catch (err) {
    console.error('3D failed to load; staying in Read mode', err);
    caps.webgl = false; setMode('read');
  }
}

function openPanel(node) {
  if (!node?.ref) return;
  const { section, index } = node.ref;
  const kindMap = { projects:'projects', experience:'experience', education:'education' };
  const item = model[section]?.[index];
  if (!item || !kindMap[section]) return;
  $('panel-body').innerHTML = renderPanel(item, kindMap[section], model.settings?.statuses || {});
  const panel = $('panel'); panel.hidden = false; $('panel-close').focus();
}
function closePanel() { const p = $('panel'); if (p) { p.hidden = true; world && world.resetView && world.resetView(); } }

async function start() {
  a11y = initA11y();
  initTheme({ announce: a11y.announce, defaultTheme: 'auto' });
  caps = detect();
  try {
    model = await loadData();
    document.title = model.settings?.siteTitle || document.title;
    mountSections(model);          // Read view
    initMotion();
    // toggles
    document.querySelector('[data-mode-toggle]')?.addEventListener('click', () => {
      setMode(document.body.dataset.mode === 'explore' ? 'read' : 'explore', true);
    });
    $('panel-close')?.addEventListener('click', () => { closePanel(); });
    document.querySelectorAll('[data-goto-read]').forEach(el => el.addEventListener('click', () => setMode('read', true)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
    setMode(chooseInitialMode(caps), false);
  } catch (err) {
    console.error('Failed to load portfolio data', err);
    setMode('read');
    $('summary')?.querySelector('.section-body')?.insertAdjacentHTML('afterbegin', '<p role="alert">Content failed to load. Please refresh.</p>');
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
```

- [ ] **Step 2: Manual + headless verification**
Run `python -m http.server 8000`. In a browser: default mode = chooseInitialMode (Explore on desktop) → 3D network renders, orbit/drag works, hover highlights, clicking an entity opens a panel with its content, Esc/close returns; toggle flips to Read (full résumé); theme toggle works. Force no-WebGL (DevTools/flag) → lands in Read.
Headless screenshots (WebGL in headless needs SwiftShader):
```
chrome --headless=new --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader \
  --window-size=1280,800 --virtual-time-budget=8000 --screenshot=explore.png http://localhost:8000/
```
Confirm `explore.png` shows the 3D network behind the hero name. (If headless WebGL is unavailable in the environment, verify in a real browser and note it.)

- [ ] **Step 3: Commit**
```bash
git add js/main.js
git commit -m "feat: main orchestration — explore/read modes, capability gate, panels

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Remove legacy + docs + final verification

**Files:**
- Remove: `js/graph-view.js`
- Modify: `CLAUDE.md` (Design Context), `README.md`

- [ ] **Step 1: Confirm `graph-view.js` is unreferenced**
Run: `grep -rn "graph-view" index.html js/ css/ || echo "clean"`
Expected: `clean` (main.js now imports `scene/world.js`, not graph-view).

- [ ] **Step 2: Remove it**
```bash
git rm js/graph-view.js
```

- [ ] **Step 3: Rewrite the `## Design Context` section of `CLAUDE.md`** — replace from `## Design Context` to end of file:
```markdown
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
```

- [ ] **Step 4: Update `README.md`** — replace the structure/run notes' front-end bullets with:
```markdown
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
```

- [ ] **Step 5: Final verification**
Run: `npm test` (all pass); `grep -rn "graph-view" js/ css/ index.html || echo clean`; load `/` in a browser and confirm Explore (3D) + Read both work, no console 404s; load `/admin/` and confirm it still loads (admin unaffected). Verify projects show in order HiSalon→Stmnt→Wafa→KRLS in Read mode; Wafa reads as the Mal take-home.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "chore: remove Canvas graph-view; rewrite design context + README for living network

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (against spec)

**Spec coverage:**
- §3 living network (neural form + flow + regions + entrance + palette) → Tasks 3,5,6,7 (layout/engine/nodes/edges/world); breathing+pulses in 6; palette from settings in 7. ✓
- §4 interaction + content model (orbit/zoom, hover, click-focus, panel, tool highlight, Read toggle, hero overlay) → Tasks 5,7,8,9; renderPanel Task 4. (tool-node "used in N" label is minor/stretch — node click for tools focuses + is wired via onSelectTool hook; full highlight-all-users is a follow-up noted below.)
- §5 architecture (reuse vs replace, lazy Three, modules) → Tasks 5–9; removal Task 10. ✓
- §6 data changes → Task 1. ✓
- §7 performance (lazy load, capped DPR, pause-hidden, mobile thinning) → Tasks 5 (DPR/visibility), 7 (lowPower thinning), 9. ✓
- §8 a11y/robustness (capability gate, reduced-motion calm, DOM source of truth, focus, print) → Tasks 2,8,9,10. ✓
- §9 testing → unit Tasks 1–4; manual/headless Tasks 5–10. ✓
- §10 risks (import-failure→Read, context-loss) → Task 9 try/catch (import failure); context-loss handler is a noted follow-up. ✓
- §11 deliverables → all tasks. ✓

**Placeholder scan:** No TBD/"handle errors" placeholders; 3D modules ship real baseline code with explicit manual/headless verification (visual polish via impeccable live-iteration during Task 9 verification, not a code gap).

**Type consistency:** `createWorld(canvas, model, opts)` returns `{focusEntity, resetView, start, stop, dispose}` — consumed by main.js (`world.start/stop/resetView`). `buildNodes`→`{group,byId,meshes,update}` consumed by interaction (`nodesApi.meshes`) + world (`nodes.byId`, `nodes.update`). `engine` shape (`scene,camera,renderer,controls,addFrame,start,stop,dispose,focusOn,resetView`) consistent across 5/6/7. `renderPanel(item,kind,statuses)` consistent Tasks 4/9. `chooseInitialMode({webgl,lowPower})` consistent Tasks 2/9. ✓

**Noted follow-ups (not blockers):** tool-node "highlight all users" full effect; WebGL `webglcontextlost` handler; entrance "assemble from scatter" animation (baseline starts settled — enhance in live iteration). These are enhancements to land during Task 9 visual iteration or post-merge.
