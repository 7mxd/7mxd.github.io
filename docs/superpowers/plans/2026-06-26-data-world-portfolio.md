# Data-World Portfolio (Project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static resume site with an interactive "data world" — a computed 3-cluster network hero + nav, backed by a full, readable, adaptive light/dark page rendered from `data/*.json`.

**Architecture:** No-build vanilla site. Browser loads ES modules (`<script type="module">`) and plain CSS (`<link>`). Pure-logic modules (data normalization, graph derivation, force simulation, block/HTML rendering, theme selection) contain no browser globals so they're unit-testable under Node's built-in test runner. DOM/canvas/CSS modules are thin and verified by eye. The network graph is *derived* from content (shared tags → edges); only a `cluster` field per entity is authored.

**Tech Stack:** HTML5, CSS custom properties, vanilla ES2020+ modules, Canvas 2D. Dev-only: Node ≥18 built-in `node:test` / `node:assert` (no third-party deps, never shipped).

## Global Constraints

- **No build step.** Files served as-is by GitHub Pages. ES modules via native `import`.
- **No runtime dependencies.** Zero third-party JS/CSS shipped. Dev test runner is Node built-in only.
- **Budget:** CSS + JS combined < 150KB uncompressed. Stay as far under as practical.
- **Accessibility:** WCAG AA. Preserve skip link, `prefers-reduced-motion`, `prefers-contrast: high`, `html.using-keyboard` detection, screen-reader announcements for theme/menu, focus management. Canvas is `aria-hidden`; no information lives only in canvas.
- **Both themes first-class.** Adaptive light + dark via `[data-theme]` on `<html>`; respects `prefers-color-scheme`; user choice persists to `localStorage`.
- **Content is data.** No hard-coded copy in HTML/JS; everything from `data/*.json` + `data/blocks-registry.json`. Section visibility via `settings.json` `sections.*.enabled`.
- **Confidentiality:** Only **HiSalon** named among Join-Future products (name + role + general stack only; no internal/security/infra specifics). HiPay/joinfuture.ai/joinCX represented only by one generic node: "+ other production systems at Join-Future (payments, AI platform)."
- **Pure modules** (`util.js`, `data.js`, `graph-model.js`, `force.js`, `blocks.js`, `render.js`, `theme.js` logic exports) must not reference `window`/`document` at module top level, so Node can import them.
- **Commit after every task.** End commit messages with the Co-Authored-By trailer used in this repo.

---

## File Structure

**Created:**
- `package.json` — dev-only: `{"type":"module","private":true}` + test script. (GitHub Pages ignores it.)
- `js/util.js` — `escapeHtml`, `slugify`, `clamp`, `formatList`. Pure.
- `js/data.js` — `normalizeData(raw)` (pure) + `loadData(fetchFn)` (thin fetch wrapper).
- `js/graph-model.js` — `deriveGraph(model, opts)`. Pure.
- `js/force.js` — `createSimulation(nodes, edges, config)`. Pure (caller seeds positions).
- `js/blocks.js` — `renderBlock(block, ctx)` + per-type renderers. Pure (returns HTML string).
- `js/render.js` — section renderers (`renderSummary`, `renderExperience`, `renderProjects`, `renderSkills`, `renderEducation`, `renderContact`) returning HTML strings. Pure. Plus `mountSections(model, root)` (thin DOM).
- `js/theme.js` — `chooseTheme(stored, prefersDark)` + `nextTheme(cur)` (pure) and `initTheme()` (DOM).
- `js/motion.js` — scroll-reveal, count-up, ascii draw-in; all reduced-motion gated. DOM.
- `js/graph-view.js` — canvas render, "signal from noise" load anim, hover/click/drag. DOM.
- `js/a11y.js` — keyboard-usage detection, SR live region, focus mgmt. DOM.
- `js/main.js` — entry: load data → mount sections → init theme/motion/a11y/graph.
- `css/tokens.css` — theme + cluster palette custom properties.
- `css/base.css` — reset, typography, layout primitives, focus styles.
- `css/sections.css` — hero + per-section styling.
- `css/graph.css` — canvas container, tooltip, node-nav overlay.
- `css/print.css` — print stylesheet.
- `test/util.test.js`, `test/data.test.js`, `test/graph-model.test.js`, `test/force.test.js`, `test/blocks.test.js`, `test/render.test.js`, `test/theme.test.js`.

**Modified:**
- `index.html` — full rewrite: shell, meta, `<noscript>` fallback, section containers, module + CSS includes.
- `data/projects.json`, `data/experience.json`, `data/education.json` — add `cluster` (and `tags` on experience) + approved new content.
- `data/settings.json` — add `graph` config + `theme` default.
- `CLAUDE.md` — rewrite the "Design Context" section for the new identity.
- `README.md` — update structure/run notes.

**Removed at end:** `style.css`, `script.js` (replaced by `css/*` and `js/*`).

---

## Shared Data Shapes (reference for all tasks)

Normalized model (`normalizeData` output):
```js
{
  profile: { name, title, positioning, contact: { email, phone, location,
             linkedin: {url,label}, github: {url,label} } },
  summary: { content },
  experience: [ { company, logo:{default,light,dark}, location, cluster, tags:[String], roles:[
                  { title, startDate, endDate, displayDate, blocks:[Block] } ] } ],
  projects:  [ { title, status, cluster, tags:[String], links:{github,webapp,ios,android,extra:[{label,url}]}, blocks:[Block] } ],
  skills:    { categories:[ { name, type:'tags'|'list'|'languages', items:[{name, level?}] } ] },
  education: [ { institution, logo, degree, displayDate, grade, cluster, blocks:[Block] } ],
  settings:  { cv:{path,downloadName}, siteTitle, navLogo, meta:{...}, sections:{...},
               statuses:{...}, theme:'light'|'dark'|'auto',
               graph:{ clusters:{ math:{label,color}, data:{label,color}, engineering:{label,color} } } }
}
```
`Block` = `{ type, ...fields }` per `data/blocks-registry.json`.

Graph (`deriveGraph` output):
```js
{
  nodes: [ { id, kind:'entity'|'tool', label, cluster:('math'|'data'|'engineering'|null), ref:({section,index}|null), weight:Number } ],
  edges: [ { source:id, target:id } ],
  toolUsage: { [toolId]: Number }   // how many entities use each tool
}
```
IDs: entities `proj:<i>`, `exp:<i>`, `edu:<i>`; tools `tool:<slug>`. Tool nodes have `cluster:null`.

---

### Task 1: Dev test harness + `util.js`

**Files:**
- Create: `package.json`, `js/util.js`, `test/util.test.js`

**Interfaces:**
- Produces: `escapeHtml(s:String)->String`, `slugify(s:String)->String`, `clamp(n,min,max)->Number`, `formatList(arr:String[], sep=', ')->String`.

- [ ] **Step 1: Create `package.json`**
```json
{
  "name": "7mxd-portfolio",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test test/" }
}
```

- [ ] **Step 2: Write the failing test** — `test/util.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, slugify, clamp, formatList } from '../js/util.js';

test('escapeHtml neutralizes HTML metacharacters', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});
test('slugify lowercases and dashes non-alphanumerics', () => {
  assert.equal(slugify('Git / GitHub'), 'git-github');
  assert.equal(slugify('Claude / AI agents'), 'claude-ai-agents');
});
test('clamp bounds a value', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});
test('formatList joins with separator', () => {
  assert.equal(formatList(['a','b','c']), 'a, b, c');
  assert.equal(formatList(['a','b'], ' · '), 'a · b');
});
```

- [ ] **Step 3: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../js/util.js`.

- [ ] **Step 4: Implement `js/util.js`**
```js
export function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
export function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
export function formatList(arr, sep = ', ') { return (arr || []).join(sep); }
```

- [ ] **Step 5: Run test, verify it passes**
Run: `npm test`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**
```bash
git add package.json js/util.js test/util.test.js
git commit -m "feat: dev test harness and util helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Data normalization (`data.js`)

**Files:**
- Create: `js/data.js`, `test/data.test.js`

**Interfaces:**
- Consumes: nothing from prior tasks (uses raw JSON shapes).
- Produces: `normalizeData(raw)->model` (pure; `raw` = `{profile,summary,experience,projects,skills,education,settings}`), and `loadData(fetchFn=fetch)->Promise<model>` (fetches the seven `data/*.json` + `blocks-registry.json`, then calls `normalizeData`). `normalizeData` fills `cluster` defaults (experience→`data`, education→`math`, projects→keep or `engineering`), guarantees `tags:[]`, and guarantees `graph.clusters` exists with the three keys.

- [ ] **Step 1: Write the failing test** — `test/data.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeData } from '../js/data.js';

const raw = {
  profile: { name:'A', title:'t', contact:{ email:'e', phone:'p', location:'l',
             linkedin:{url:'u',label:'LinkedIn'}, github:{url:'g',label:'GitHub'} } },
  summary: { content:'s' },
  experience: { items:[ { company:'Saal', location:'AD', roles:[
                 { title:'r', displayDate:'d', blocks:[] } ] } ] },
  projects: { items:[ { title:'P', status:'shipped', tags:['Python'], links:{}, blocks:[] } ] },
  skills: { categories:[ { name:'langs', type:'languages', items:[{name:'Arabic',level:'native'}] } ] },
  education: { items:[ { institution:'KU', degree:'BSc', displayDate:'x', grade:'3.3', blocks:[] } ] },
  settings: { cv:{path:'c',downloadName:'cv'}, siteTitle:'st', navLogo:'AR',
              meta:{}, sections:{}, statuses:{} }
};

test('normalizeData fills cluster defaults', () => {
  const m = normalizeData(raw);
  assert.equal(m.experience[0].cluster, 'data');
  assert.equal(m.education[0].cluster, 'math');
  assert.equal(m.projects[0].cluster, 'engineering');
});
test('normalizeData guarantees tags arrays', () => {
  const m = normalizeData(raw);
  assert.deepEqual(m.experience[0].tags, []);
  assert.deepEqual(m.projects[0].tags, ['Python']);
});
test('normalizeData guarantees graph.clusters with three keys', () => {
  const m = normalizeData(raw);
  assert.deepEqual(Object.keys(m.settings.graph.clusters).sort(),
    ['data','engineering','math']);
});
test('explicit cluster is preserved', () => {
  const r = structuredClone(raw); r.projects.items[0].cluster = 'math';
  assert.equal(normalizeData(r).projects[0].cluster, 'math');
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../js/data.js`.

- [ ] **Step 3: Implement `js/data.js`**
```js
const DEFAULT_CLUSTERS = {
  math:        { label: 'Mathematics',            color: '#6c5ce7' },
  data:        { label: 'Data Science',           color: '#d68a1e' },
  engineering: { label: 'Engineering & Products',  color: '#1d9bb8' }
};

export function normalizeData(raw) {
  const arr = (x) => Array.isArray(x?.items) ? x.items : (Array.isArray(x) ? x : []);
  const settings = raw.settings || {};
  const graph = settings.graph || {};
  return {
    profile: raw.profile || {},
    summary: raw.summary || { content: '' },
    experience: arr(raw.experience).map((e) => ({
      ...e, cluster: e.cluster || 'data', tags: e.tags || [], roles: e.roles || []
    })),
    projects: arr(raw.projects).map((p) => ({
      ...p, cluster: p.cluster || 'engineering', tags: p.tags || [], blocks: p.blocks || []
    })),
    skills: { categories: (raw.skills?.categories) || [] },
    education: arr(raw.education).map((d) => ({
      ...d, cluster: d.cluster || 'math', blocks: d.blocks || []
    })),
    settings: {
      ...settings,
      theme: settings.theme || 'auto',
      graph: { clusters: { ...DEFAULT_CLUSTERS, ...(graph.clusters || {}) } }
    }
  };
}

export async function loadData(fetchFn = fetch) {
  const names = ['profile','summary','experience','projects','skills','education','settings'];
  const base = 'data/';
  const entries = await Promise.all(names.map(async (n) => {
    const res = await fetchFn(`${base}${n}.json`);
    return [n, await res.json()];
  }));
  const raw = Object.fromEntries(entries);
  const reg = await (await fetchFn(`${base}blocks-registry.json`)).json();
  const model = normalizeData(raw);
  model.blocksRegistry = reg;
  return model;
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**
```bash
git add js/data.js test/data.test.js
git commit -m "feat: data normalization with cluster/tags defaults

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Graph derivation (`graph-model.js`)

**Files:**
- Create: `js/graph-model.js`, `test/graph-model.test.js`

**Interfaces:**
- Consumes: `slugify` from `util.js`; normalized `model` from `data.js`.
- Produces: `deriveGraph(model)->{nodes,edges,toolUsage}` per Shared Data Shapes. Entity nodes from projects/experience/education; tool nodes from the union of `tags` across projects + experience + skill categories of type `tags`/`list`. An edge connects each entity to each of its tools. `weight` for tool nodes = usage count; for entity nodes = 1 + tag count. `ref` for entity nodes = `{section, index}` (`section` ∈ `projects|experience|education`).

- [ ] **Step 1: Write the failing test** — `test/graph-model.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveGraph } from '../js/graph-model.js';

const model = {
  experience: [ { company:'Saal', cluster:'data', tags:['Python','Docker'], roles:[] } ],
  projects:   [ { title:'Stmnt', cluster:'engineering', tags:['Supabase','Docker'], blocks:[] } ],
  education:  [ { institution:'KU', cluster:'math', blocks:[] } ],
  skills:     { categories:[ { name:'lang', type:'tags', items:[{name:'Python'}] } ] }
};

test('entity nodes are created for each project/experience/education item', () => {
  const g = deriveGraph(model);
  const ids = g.nodes.filter(n => n.kind==='entity').map(n => n.id).sort();
  assert.deepEqual(ids, ['edu:0','exp:0','proj:0']);
});
test('tool nodes are de-duplicated across sources', () => {
  const g = deriveGraph(model);
  const tools = g.nodes.filter(n => n.kind==='tool').map(n => n.label).sort();
  assert.deepEqual(tools, ['Docker','Python','Supabase']);
});
test('shared tool becomes a cross-cluster bridge edge set', () => {
  const g = deriveGraph(model);
  const docker = g.nodes.find(n => n.label==='Docker');
  const touching = g.edges.filter(e => e.source===docker.id || e.target===docker.id).length;
  assert.equal(touching, 2); // Saal + Stmnt
});
test('toolUsage counts entities per tool', () => {
  const g = deriveGraph(model);
  const docker = g.nodes.find(n => n.label==='Docker');
  assert.equal(g.toolUsage[docker.id], 2);
});
test('entity ref points to section + index for scroll', () => {
  const g = deriveGraph(model);
  const stmnt = g.nodes.find(n => n.id==='proj:0');
  assert.deepEqual(stmnt.ref, { section:'projects', index:0 });
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../js/graph-model.js`.

- [ ] **Step 3: Implement `js/graph-model.js`**
```js
import { slugify } from './util.js';

export function deriveGraph(model) {
  const nodes = [];
  const edges = [];
  const toolUsage = {};
  const toolNodes = new Map(); // slug -> node

  function ensureTool(label) {
    const id = `tool:${slugify(label)}`;
    if (!toolNodes.has(id)) {
      const node = { id, kind:'tool', label, cluster:null, ref:null, weight:0 };
      toolNodes.set(id, node);
      toolUsage[id] = 0;
    }
    return toolNodes.get(id);
  }
  function addEntity(prefix, i, label, cluster, section, tags) {
    const id = `${prefix}:${i}`;
    nodes.push({ id, kind:'entity', label, cluster, ref:{section,index:i}, weight:1 + tags.length });
    for (const t of tags) {
      const tool = ensureTool(t);
      edges.push({ source:id, target:tool.id });
      tool.weight += 1;
      toolUsage[tool.id] += 1;
    }
  }

  (model.projects || []).forEach((p, i) =>
    addEntity('proj', i, p.title, p.cluster, 'projects', p.tags || []));
  (model.experience || []).forEach((e, i) =>
    addEntity('exp', i, e.company, e.cluster, 'experience', e.tags || []));
  (model.education || []).forEach((d, i) =>
    addEntity('edu', i, d.institution, d.cluster, 'education', d.blocks ? (d.tags||[]) : []));

  // Skill-only tools (declared in skills but not on any entity) still appear as nodes.
  for (const cat of (model.skills?.categories || [])) {
    if (cat.type === 'tags' || cat.type === 'list') {
      for (const it of (cat.items || [])) ensureTool(it.name);
    }
  }

  nodes.push(...toolNodes.values());
  return { nodes, edges, toolUsage };
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (13 tests total).

- [ ] **Step 5: Commit**
```bash
git add js/graph-model.js test/graph-model.test.js
git commit -m "feat: derive network graph from content (shared tags as edges)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Force simulation (`force.js`)

**Files:**
- Create: `js/force.js`, `test/force.test.js`

**Interfaces:**
- Consumes: graph `nodes`/`edges` from `graph-model.js`. Caller seeds each node's `x,y` before stepping (keeps the module deterministic and Node-importable; no `Math.random` at import).
- Produces: `createSimulation(nodes, edges, config)->{ step()->Number }`. `step()` mutates `node.x,y,vx,vy` for one tick and returns total kinetic energy. `config` (all optional, defaults below): `{ repulsion, springLength, springK, damping, centerGravity, clusterGravity, clusterCenters:{cluster:{x,y}}, width, height }`.

- [ ] **Step 1: Write the failing test** — `test/force.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../js/force.js';

function seed(nodes) { nodes.forEach((n,i)=>{ n.x=(i+1)*40; n.y=(i%2)*30; n.vx=0; n.vy=0; }); }

test('step returns finite energy and keeps coordinates finite', () => {
  const nodes=[{id:'a'},{id:'b'},{id:'c'}]; seed(nodes);
  const edges=[{source:'a',target:'b'}];
  const sim=createSimulation(nodes,edges,{width:800,height:600});
  const e=sim.step();
  assert.ok(Number.isFinite(e));
  for (const n of nodes){ assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y)); }
});
test('connected nodes move closer over many steps than disconnected ones drift apart', () => {
  const nodes=[{id:'a'},{id:'b'},{id:'c'}]; seed(nodes);
  const edges=[{source:'a',target:'b'}];
  const sim=createSimulation(nodes,edges,{width:800,height:600,springLength:30});
  const dist=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
  const before=dist(nodes[0],nodes[1]);
  for (let i=0;i<300;i++) sim.step();
  const after=dist(nodes[0],nodes[1]);
  assert.ok(after < before + 1, `expected spring to pull a,b together (before ${before}, after ${after})`);
});
test('energy trends toward zero (system settles)', () => {
  const nodes=Array.from({length:6},(_,i)=>({id:String(i)})); seed(nodes);
  const edges=[{source:'0',target:'1'},{source:'1',target:'2'},{source:'2',target:'3'}];
  const sim=createSimulation(nodes,edges,{width:800,height:600});
  let last=Infinity, e;
  for (let i=0;i<1000;i++) e=sim.step();
  assert.ok(e < 5, `expected low residual energy, got ${e}`);
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../js/force.js`.

- [ ] **Step 3: Implement `js/force.js`**
```js
export function createSimulation(nodes, edges, config = {}) {
  const cfg = {
    repulsion: 1400, springLength: 60, springK: 0.02, damping: 0.85,
    centerGravity: 0.002, clusterGravity: 0.01, clusterCenters: {},
    width: 800, height: 600, ...config
  };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cx = cfg.width / 2, cy = cfg.height / 2;

  function step() {
    // repulsion (O(n^2) — fine for our node counts)
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx*dx + dy*dy || 0.01;
        const f = cfg.repulsion / d2;
        const d = Math.sqrt(d2);
        const fx = (dx/d)*f, fy = (dy/d)*f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    // springs along edges
    for (const e of edges) {
      const a = byId.get(e.source), b = byId.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d - cfg.springLength) * cfg.springK;
      const fx = (dx/d)*f, fy = (dy/d)*f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    // gravity toward center and cluster centroid
    let energy = 0;
    for (const n of nodes) {
      n.vx += (cx - n.x) * cfg.centerGravity;
      n.vy += (cy - n.y) * cfg.centerGravity;
      const cc = n.cluster && cfg.clusterCenters[n.cluster];
      if (cc) {
        n.vx += (cc.x - n.x) * cfg.clusterGravity;
        n.vy += (cc.y - n.y) * cfg.clusterGravity;
      }
      n.vx *= cfg.damping; n.vy *= cfg.damping;
      n.x += n.vx; n.y += n.vy;
      energy += n.vx*n.vx + n.vy*n.vy;
    }
    return energy;
  }
  return { step };
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (16 tests total).

- [ ] **Step 5: Commit**
```bash
git add js/force.js test/force.test.js
git commit -m "feat: deterministic force simulation for the network

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Block renderers (`blocks.js`)

**Files:**
- Create: `js/blocks.js`, `test/blocks.test.js`

**Interfaces:**
- Consumes: `escapeHtml`, `formatList` from `util.js`.
- Produces: `renderBlock(block, ctx)->String` dispatching on `block.type` for every type in `blocks-registry.json` (`description`, `ascii-chart`, `image`, `code`, `callout`, `html`, `responsibility`, `metric`, `linked-artifact`, `coursework`, `thesis`, `honor`). All text is `escapeHtml`'d except `html` (intentional raw). `ascii-chart` wraps the chart in `<pre class="ascii" data-animate="ascii">` with bar runs marked for the draw-in animation; `metric` emits `data-countup` for count-up. Unknown types return `''`.

- [ ] **Step 1: Write the failing test** — `test/blocks.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBlock } from '../js/blocks.js';

test('description escapes HTML', () => {
  const h = renderBlock({ type:'description', content:'<b>x</b>' });
  assert.ok(h.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(!h.includes('<b>x</b>'));
});
test('ascii-chart marks bars for animation and keeps a caption', () => {
  const h = renderBlock({ type:'ascii-chart', caption:'cap', chart:'A ▇▇ 1' });
  assert.ok(h.includes('data-animate="ascii"'));
  assert.ok(h.includes('cap'));
});
test('metric emits count-up hook', () => {
  const h = renderBlock({ type:'metric', label:'Years', value:'3' });
  assert.ok(h.includes('data-countup'));
  assert.ok(h.includes('Years'));
});
test('linked-artifact renders an anchor with escaped url', () => {
  const h = renderBlock({ type:'linked-artifact', label:'paper', url:'a.pdf' });
  assert.ok(h.includes('href="a.pdf"'));
  assert.ok(h.includes('paper'));
});
test('html block passes content through raw', () => {
  const h = renderBlock({ type:'html', content:'<i>ok</i>' });
  assert.ok(h.includes('<i>ok</i>'));
});
test('unknown type returns empty string', () => {
  assert.equal(renderBlock({ type:'nope' }), '');
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../js/blocks.js`.

- [ ] **Step 3: Implement `js/blocks.js`**
```js
import { escapeHtml, formatList } from './util.js';

const renderers = {
  description: (b) => `<p class="block-desc">${escapeHtml(b.content)}</p>`,
  responsibility: (b) => `<li class="block-resp">${escapeHtml(b.content)}</li>`,
  honor: (b) => `<p class="block-honor">${escapeHtml(b.content)}</p>`,
  metric: (b) =>
    `<div class="block-metric"><span class="metric-value" data-countup="${escapeHtml(b.value)}">${escapeHtml(b.value)}</span><span class="metric-label">${escapeHtml(b.label)}</span></div>`,
  'ascii-chart': (b) => {
    const cap = b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : '';
    return `<figure class="block-ascii">${cap}<pre class="ascii" data-animate="ascii">${escapeHtml(b.chart)}</pre></figure>`;
  },
  image: (b) => {
    const cap = b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : '';
    return `<figure class="block-image"><img loading="lazy" src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt)}">${cap}</figure>`;
  },
  code: (b) => {
    const lang = b.language ? ` data-lang="${escapeHtml(b.language)}"` : '';
    return `<pre class="block-code"${lang}><code>${escapeHtml(b.content)}</code></pre>`;
  },
  callout: (b) => `<aside class="block-callout" data-tone="${escapeHtml(b.tone)}">${escapeHtml(b.content)}</aside>`,
  html: (b) => b.content || '',
  'linked-artifact': (b) =>
    `<a class="block-artifact" href="${escapeHtml(b.url)}" target="_blank" rel="noopener">${escapeHtml(b.label)}</a>`,
  coursework: (b) => `<ul class="block-coursework">${(b.items||[]).map(i=>`<li>${escapeHtml(i)}</li>`).join('')}</ul>`,
  thesis: (b) => {
    const t = escapeHtml(b.title);
    return b.link ? `<p class="block-thesis"><a href="${escapeHtml(b.link)}" target="_blank" rel="noopener">${t}</a></p>`
                  : `<p class="block-thesis">${t}</p>`;
  }
};

export function renderBlock(block, ctx = {}) {
  const fn = renderers[block?.type];
  return fn ? fn(block, ctx) : '';
}
export function renderBlocks(blocks, ctx = {}) {
  return (blocks || []).map((b) => renderBlock(b, ctx)).join('');
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (22 tests total).

- [ ] **Step 5: Commit**
```bash
git add js/blocks.js test/blocks.test.js
git commit -m "feat: block renderers from blocks-registry types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Section renderers (`render.js`)

**Files:**
- Create: `js/render.js`, `test/render.test.js`

**Interfaces:**
- Consumes: `renderBlock`/`renderBlocks` from `blocks.js`; `escapeHtml`, `formatList` from `util.js`; normalized `model`.
- Produces: pure section renderers each returning an HTML string for a `<section>`'s inner content:
  `renderSummary(model)`, `renderExperience(model)`, `renderProjects(model)`, `renderSkills(model)`, `renderEducation(model)`, `renderContact(model)`. Each respects `model.settings.sections[name].enabled` by returning `''` when disabled. Section root elements (with ids `summary|experience|projects|skills|education|contact`) live in `index.html`; `mountSections(model, root=document)` (thin DOM, not unit-tested) sets each section's `innerHTML`. Tags render as a `.tag-row` of `.tag` spans; project status uses `model.settings.statuses[status]` for label/glyph.

- [ ] **Step 1: Write the failing test** — `test/render.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProjects, renderSkills, renderExperience } from '../js/render.js';

const model = {
  settings: { sections:{ projects:{enabled:true}, skills:{enabled:true}, experience:{enabled:true} },
              statuses:{ shipped:{label:'shipped',glyph:'✓',tone:'neutral'} } },
  projects: [ { title:'Stmnt', status:'shipped', tags:['Flutter'], links:{ios:'x'}, blocks:[{type:'description',content:'desc'}] } ],
  skills: { categories:[ { name:'langs', type:'languages', items:[{name:'Arabic',level:'native'}] },
                         { name:'tools', type:'tags', items:[{name:'Python'}] } ] },
  experience: [ { company:'Saal', location:'AD', cluster:'data', tags:[], roles:[
                  { title:'Trainee', displayDate:'2024-now', blocks:[{type:'responsibility',content:'did x'}] } ] } ]
};

test('renderProjects includes title, status label, tag, and block content', () => {
  const h = renderProjects(model);
  assert.ok(h.includes('Stmnt'));
  assert.ok(h.includes('shipped'));
  assert.ok(h.includes('Flutter'));
  assert.ok(h.includes('desc'));
});
test('renderSkills renders language level and a tag', () => {
  const h = renderSkills(model);
  assert.ok(h.includes('Arabic'));
  assert.ok(h.includes('native'));
  assert.ok(h.includes('Python'));
});
test('renderExperience includes company, role and responsibility', () => {
  const h = renderExperience(model);
  assert.ok(h.includes('Saal') && h.includes('Trainee') && h.includes('did x'));
});
test('disabled section returns empty string', () => {
  const m = structuredClone(model); m.settings.sections.projects.enabled = false;
  assert.equal(renderProjects(m), '');
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../js/render.js`.

- [ ] **Step 3: Implement `js/render.js`**
```js
import { renderBlock, renderBlocks } from './blocks.js';
import { escapeHtml } from './util.js';

const enabled = (model, name) => model.settings?.sections?.[name]?.enabled !== false;
const tagRow = (tags) => (tags && tags.length)
  ? `<ul class="tag-row">${tags.map(t=>`<li class="tag">${escapeHtml(t)}</li>`).join('')}</ul>` : '';

export function renderSummary(model) {
  if (!enabled(model, 'summary')) return '';
  return `<p class="summary-text">${escapeHtml(model.summary?.content || '')}</p>`;
}

export function renderExperience(model) {
  if (!enabled(model, 'experience')) return '';
  return (model.experience || []).map((e) => {
    const roles = (e.roles || []).map((r) => {
      const resps = (r.blocks || []).filter(b => b.type === 'responsibility');
      const other = (r.blocks || []).filter(b => b.type !== 'responsibility');
      const list = resps.length ? `<ul class="resp-list">${renderBlocks(resps)}</ul>` : '';
      return `<div class="role"><h4 class="role-title">${escapeHtml(r.title)}</h4>
        <p class="role-date">${escapeHtml(r.displayDate || '')}</p>${list}${renderBlocks(other)}</div>`;
    }).join('');
    return `<article class="exp" data-cluster="${escapeHtml(e.cluster)}">
      <header class="exp-head"><h3 class="exp-company">${escapeHtml(e.company)}</h3>
      <span class="exp-loc">${escapeHtml(e.location || '')}</span></header>
      ${tagRow(e.tags)}${roles}</article>`;
  }).join('');
}

export function renderProjects(model) {
  if (!enabled(model, 'projects')) return '';
  const statuses = model.settings?.statuses || {};
  return (model.projects || []).map((p, i) => {
    const st = statuses[p.status];
    const pill = st ? `<span class="status-pill" data-tone="${escapeHtml(st.tone)}">${escapeHtml(st.glyph)} ${escapeHtml(st.label)}</span>` : '';
    const links = Object.entries(p.links || {}).flatMap(([k, v]) => {
      if (k === 'extra' && Array.isArray(v)) return v.map(x => `<a href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${escapeHtml(x.label)}</a>`);
      if (typeof v === 'string' && v) return [`<a href="${escapeHtml(v)}" target="_blank" rel="noopener">${escapeHtml(k)}</a>`];
      return [];
    }).join('');
    return `<article class="project" id="project-${i}" data-cluster="${escapeHtml(p.cluster)}">
      <header class="project-head"><h3 class="project-title">${escapeHtml(p.title)}</h3>${pill}</header>
      ${tagRow(p.tags)}<div class="project-body">${renderBlocks(p.blocks)}</div>
      <div class="project-links">${links}</div></article>`;
  }).join('');
}

export function renderSkills(model) {
  if (!enabled(model, 'skills')) return '';
  return (model.skills?.categories || []).map((c) => {
    if (c.type === 'languages') {
      const items = (c.items||[]).map(it => `<li class="lang"><span class="lang-name">${escapeHtml(it.name)}</span> <span class="lang-level">${escapeHtml(it.level||'')}</span></li>`).join('');
      return `<div class="skill-cat"><h3 class="skill-cat-name">${escapeHtml(c.name)}</h3><ul class="lang-list">${items}</ul></div>`;
    }
    const items = (c.items||[]).map(it => `<li class="tag">${escapeHtml(it.name)}</li>`).join('');
    return `<div class="skill-cat"><h3 class="skill-cat-name">${escapeHtml(c.name)}</h3><ul class="tag-row">${items}</ul></div>`;
  }).join('');
}

export function renderEducation(model) {
  if (!enabled(model, 'education')) return '';
  return (model.education || []).map((d) => `<article class="edu" data-cluster="${escapeHtml(d.cluster)}">
    <h3 class="edu-inst">${escapeHtml(d.institution)}</h3>
    <p class="edu-degree">${escapeHtml(d.degree)}</p>
    <p class="edu-meta">${escapeHtml(d.displayDate||'')} · ${escapeHtml(d.grade||'')}</p>
    ${renderBlocks(d.blocks)}</article>`).join('');
}

export function renderContact(model) {
  const c = model.profile?.contact || {};
  const cv = model.settings?.cv;
  const links = [];
  if (c.email) links.push(`<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>`);
  if (c.linkedin?.url) links.push(`<a href="${escapeHtml(c.linkedin.url)}" target="_blank" rel="noopener">${escapeHtml(c.linkedin.label||'LinkedIn')}</a>`);
  if (c.github?.url) links.push(`<a href="${escapeHtml(c.github.url)}" target="_blank" rel="noopener">${escapeHtml(c.github.label||'GitHub')}</a>`);
  if (cv?.path) links.push(`<a href="${escapeHtml(cv.path)}" download="${escapeHtml(cv.downloadName||'CV.pdf')}">Download CV</a>`);
  return `<p class="contact-meta">${escapeHtml(c.location||'')} · ${escapeHtml(c.phone||'')}</p>
    <div class="contact-links">${links.join('')}</div>`;
}

export function mountSections(model, root = document) {
  const map = { summary:renderSummary, experience:renderExperience, projects:renderProjects,
                skills:renderSkills, education:renderEducation, contact:renderContact };
  for (const [id, fn] of Object.entries(map)) {
    const el = root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
    if (el) el.innerHTML = fn(model);
  }
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (26 tests total).

- [ ] **Step 5: Commit**
```bash
git add js/render.js test/render.test.js
git commit -m "feat: section renderers for all content sections

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Theme logic + controller (`theme.js`)

**Files:**
- Create: `js/theme.js`, `test/theme.test.js`

**Interfaces:**
- Produces (pure): `chooseTheme(stored, prefersDark)->'light'|'dark'` (stored `light`/`dark` wins; else `auto`/null → `prefersDark?'dark':'light'`), `nextTheme(cur)->'light'|'dark'`. Produces (DOM): `initTheme({announce})` — applies `[data-theme]` to `<html>`, wires a `[data-theme-toggle]` button, persists to `localStorage['theme']`, calls `announce(msg)` for SR.

- [ ] **Step 1: Write the failing test** — `test/theme.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseTheme, nextTheme } from '../js/theme.js';

test('stored explicit theme wins', () => {
  assert.equal(chooseTheme('dark', false), 'dark');
  assert.equal(chooseTheme('light', true), 'light');
});
test('auto/null falls back to system preference', () => {
  assert.equal(chooseTheme(null, true), 'dark');
  assert.equal(chooseTheme('auto', false), 'light');
});
test('nextTheme toggles', () => {
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'light');
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../js/theme.js`.

- [ ] **Step 3: Implement `js/theme.js`**
```js
export function chooseTheme(stored, prefersDark) {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}
export function nextTheme(cur) { return cur === 'dark' ? 'light' : 'dark'; }

export function initTheme({ announce = () => {} } = {}) {
  const root = document.documentElement;
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  let theme = chooseTheme(localStorage.getItem('theme'), mql.matches);
  const apply = (t) => { root.setAttribute('data-theme', t); };
  apply(theme);
  const btn = document.querySelector('[data-theme-toggle]');
  if (btn) {
    btn.addEventListener('click', () => {
      theme = nextTheme(theme);
      localStorage.setItem('theme', theme);
      apply(theme);
      announce(`${theme} theme enabled`);
    });
  }
  return { get: () => theme };
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (29 tests total).

- [ ] **Step 5: Commit**
```bash
git add js/theme.js test/theme.test.js
git commit -m "feat: theme selection logic and toggle controller

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: HTML shell (`index.html`) + a11y module + main wiring (render path only)

This task makes the site render real content from data in the browser (no graph/animation yet), so it's independently verifiable.

**Files:**
- Create: `js/a11y.js`, `js/main.js`
- Modify (full rewrite): `index.html`

**Interfaces:**
- Consumes: `loadData` (`data.js`), `mountSections` (`render.js`), `initTheme` (`theme.js`).
- Produces: `a11y.js` exports `initA11y()->{ announce(msg) }` (creates an `aria-live="polite"` region, sets `html.using-keyboard` on Tab, removes on mouse), and `setupSkipLink()`. `main.js` default-runs on `DOMContentLoaded`.

- [ ] **Step 1: Write `js/a11y.js`**
```js
export function initA11y() {
  const live = document.createElement('div');
  live.setAttribute('aria-live', 'polite');
  live.className = 'sr-only';
  document.body.appendChild(live);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') document.documentElement.classList.add('using-keyboard');
  });
  window.addEventListener('mousedown', () => {
    document.documentElement.classList.remove('using-keyboard');
  });
  return { announce: (msg) => { live.textContent = ''; live.textContent = msg; } };
}
```

- [ ] **Step 2: Write `js/main.js`**
```js
import { loadData } from './data.js';
import { mountSections } from './render.js';
import { initTheme } from './theme.js';
import { initA11y } from './a11y.js';

async function start() {
  const a11y = initA11y();
  initTheme({ announce: a11y.announce });
  try {
    const model = await loadData();
    document.title = model.settings?.siteTitle || document.title;
    mountSections(model);
    window.__model = model; // consumed by graph init in a later task
    document.dispatchEvent(new CustomEvent('model:ready', { detail: model }));
  } catch (err) {
    console.error('Failed to load portfolio data', err);
    document.getElementById('summary')?.insertAdjacentHTML('afterbegin',
      '<p role="alert">Content failed to load. Please refresh.</p>');
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
```

- [ ] **Step 3: Rewrite `index.html`** (shell with section containers, noscript fallback, nav, theme toggle, CSS + module includes)
```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ahmed Alawi Radhi, Data Scientist</title>
  <meta name="description" content="Ahmed Alawi Radhi — applied mathematician and data scientist. Math foundation, applied data science at Saal.ai, and shipping production systems." />
  <link rel="icon" href="assets/favicon.svg" />
  <link rel="manifest" href="manifest.json" />
  <link rel="stylesheet" href="css/tokens.css" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/sections.css" />
  <link rel="stylesheet" href="css/graph.css" />
  <link rel="stylesheet" href="css/print.css" media="print" />
</head>
<body>
  <a class="skip-link" href="#summary">Skip to content</a>
  <header class="site-nav">
    <a class="nav-logo" href="#top">AR</a>
    <nav aria-label="Sections">
      <a href="#summary">summary</a>
      <a href="#experience">experience</a>
      <a href="#projects">projects</a>
      <a href="#skills">skills</a>
      <a href="#education">education</a>
      <a href="#contact">contact</a>
    </nav>
    <button data-theme-toggle aria-label="Toggle light and dark theme">◐</button>
  </header>

  <main id="top">
    <section id="hero" class="hero" aria-label="Introduction">
      <canvas id="graph-canvas" aria-hidden="true"></canvas>
      <div class="hero-content">
        <h1 id="hero-name">Ahmed Alawi Radhi</h1>
        <p id="hero-title">Data scientist. Applied mathematician. I ship the modeling and the system around it.</p>
        <div class="hero-actions">
          <a class="btn" href="assets/ahmed_radhi_cv_2025.pdf" download>Download CV</a>
          <a class="btn" href="#contact">Contact</a>
        </div>
      </div>
      <p class="sr-only">Interactive map of Ahmed's work across three areas: Mathematics, Data Science, and Engineering & Products. The same information is available as readable sections below.</p>
    </section>

    <section id="summary" aria-label="Summary"></section>
    <section id="experience" aria-label="Experience"><h2 class="section-title">Experience</h2></section>
    <section id="projects" aria-label="Projects"><h2 class="section-title">Projects</h2></section>
    <section id="skills" aria-label="Skills"><h2 class="section-title">Skills</h2></section>
    <section id="education" aria-label="Education"><h2 class="section-title">Education</h2></section>
    <section id="contact" aria-label="Contact"><h2 class="section-title">Contact</h2></section>
  </main>

  <noscript>
    <p>This site renders with JavaScript. View the CV directly:
    <a href="assets/ahmed_radhi_cv_2025.pdf">Ahmed Radhi CV (PDF)</a>.</p>
  </noscript>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```
Note: section renderers set `innerHTML`, which will replace the `<h2>` placeholders. Move the section titles into the renderers OR keep a child wrapper. To preserve titles, change each renderer’s mount to target a child container. Implementation detail: in `mountSections`, target `#<id> .section-body`; add `<div class="section-body"></div>` after each `<h2>` here. Update `index.html` sections accordingly:
```html
<section id="projects" aria-label="Projects"><h2 class="section-title">Projects</h2><div class="section-body"></div></section>
```
and in `render.js` `mountSections`, replace the element lookup with:
```js
const host = (root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`));
const target = host?.querySelector('.section-body') || host;
if (target) target.innerHTML = fn(model);
```
(Apply the `.section-body` pattern to summary/experience/projects/skills/education/contact.)

- [ ] **Step 4: Update `render.js` `mountSections`** to the `.section-body` lookup shown above, and re-run tests.
Run: `npm test`
Expected: PASS (still 29 tests — `mountSections` is DOM-only and untested; renderer tests unaffected).

- [ ] **Step 5: Manual verification**
Run: `python -m http.server 8000` then open `http://localhost:8000`.
Expected: All sections show real content from `data/*.json`; theme toggle flips light/dark; Tab adds `using-keyboard` class; skip link focuses content. (Hero canvas is blank — graph comes next.)

- [ ] **Step 6: Commit**
```bash
git add index.html js/a11y.js js/main.js js/render.js
git commit -m "feat: HTML shell, a11y init, and data-driven section rendering

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Design tokens + base CSS (themes, typography, layout)

**Files:**
- Create: `css/tokens.css`, `css/base.css`

**Interfaces:** Consumes nothing. Produces CSS custom properties used by all other CSS. Defines `--cluster-math`, `--cluster-data`, `--cluster-engineering` and `--bg`, `--surface`, `--ink`, `--muted`, `--accent` for `[data-theme="light"]` and `[data-theme="dark"]`.

- [ ] **Step 1: Write `css/tokens.css`**
```css
:root {
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", monospace;
  --space: clamp(1rem, 2vw, 1.5rem);
  --maxw: 72rem;
  --radius: 10px;
  --cluster-math: #6c5ce7;
  --cluster-data: #d68a1e;
  --cluster-engineering: #1d9bb8;
}
[data-theme="light"] {
  --bg: #f7f6f3; --surface: #ffffff; --ink: #171614; --muted: #5d5a54;
  --line: #e3e0d8; --accent: var(--cluster-engineering);
}
[data-theme="dark"] {
  --bg: #0e1116; --surface: #161b22; --ink: #ecedee; --muted: #9aa1aa;
  --line: #262c36; --accent: #36b6d6;
}
```

- [ ] **Step 2: Write `css/base.css`**
```css
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: var(--font-sans); line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
h1,h2,h3,h4 { font-family: var(--font-mono); line-height: 1.2; }
a { color: var(--accent); }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
.skip-link {
  position: absolute; left: -999px; top: 0; background: var(--ink); color: var(--bg);
  padding: .6rem 1rem; z-index: 100;
}
.skip-link:focus { left: 0; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.using-keyboard a:focus, .using-keyboard button:focus { outline: 2px solid var(--accent); }
main { max-width: var(--maxw); margin: 0 auto; padding: 0 var(--space); }
section { padding: clamp(3rem, 8vh, 6rem) 0; border-top: 1px solid var(--line); }
#hero { border-top: 0; }
.section-title { font-size: clamp(1.4rem, 3vw, 2rem); margin: 0 0 1.5rem; color: var(--muted); }
.section-title::before { content: "// "; color: var(--accent); }
.btn {
  display: inline-block; padding: .6rem 1.1rem; border: 1px solid var(--line);
  border-radius: var(--radius); background: var(--surface); color: var(--ink);
  text-decoration: none; font-family: var(--font-mono); font-size: .9rem;
}
.btn:hover { border-color: var(--accent); color: var(--accent); }
@media (prefers-contrast: more) { :root { --muted: var(--ink); --line: var(--ink); } }
```

- [ ] **Step 3: Manual verification**
Reload `http://localhost:8000`. Expected: readable typography, both themes have legible contrast (toggle and check), section dividers, focus outlines visible when tabbing.

- [ ] **Step 4: Commit**
```bash
git add css/tokens.css css/base.css
git commit -m "feat: design tokens and base styles for both themes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Section + graph CSS (visual design pass)

**Files:**
- Create: `css/sections.css`, `css/graph.css`

**Interfaces:** Consumes tokens from `tokens.css`. Styles `.site-nav`, `.hero`, `#graph-canvas`, all section content classes emitted by `render.js`/`blocks.js` (`.exp`, `.role`, `.project`, `.tag-row`, `.tag`, `.status-pill`, `.block-metric`, `.block-ascii .ascii`, `.lang-list`, `.skill-cat`, `.edu`, `.contact-links`), and the graph tooltip `.graph-tooltip`.

- [ ] **Step 1: Write `css/sections.css`**
```css
.site-nav {
  position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 1rem;
  padding: .6rem var(--space); background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px); border-bottom: 1px solid var(--line);
}
.site-nav nav { display: flex; gap: 1rem; flex-wrap: wrap; margin-left: auto; }
.site-nav nav a { font-family: var(--font-mono); font-size: .85rem; text-decoration: none; color: var(--muted); }
.site-nav nav a:hover { color: var(--accent); }
.nav-logo { font-family: var(--font-mono); font-weight: 700; text-decoration: none; color: var(--ink); }
[data-theme-toggle] { background: none; border: 1px solid var(--line); border-radius: var(--radius); color: var(--ink); cursor: pointer; padding: .3rem .6rem; }

.hero { position: relative; min-height: 78vh; display: grid; place-items: center; overflow: hidden; }
#graph-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.hero-content { position: relative; z-index: 2; text-align: center; padding: var(--space);
  background: radial-gradient(closest-side, color-mix(in srgb, var(--bg) 70%, transparent), transparent); }
#hero-name { font-size: clamp(2rem, 7vw, 4rem); margin: 0; }
#hero-title { color: var(--muted); max-width: 40ch; margin: .8rem auto 1.4rem; }
.hero-actions { display: flex; gap: .8rem; justify-content: center; flex-wrap: wrap; }

.exp, .project, .edu { margin-bottom: 2rem; }
.exp-head, .project-head { display: flex; align-items: baseline; gap: .8rem; flex-wrap: wrap; }
.exp-company, .project-title { margin: 0; font-size: 1.2rem; }
.exp-loc, .role-date { color: var(--muted); font-family: var(--font-mono); font-size: .8rem; }
.role { margin-top: 1rem; }
.resp-list { margin: .5rem 0; padding-left: 1.2rem; }
.tag-row { display: flex; flex-wrap: wrap; gap: .4rem; padding: 0; margin: .6rem 0; list-style: none; }
.tag { font-family: var(--font-mono); font-size: .75rem; padding: .15rem .5rem;
  border: 1px solid var(--line); border-radius: 999px; color: var(--muted); }
.status-pill { font-family: var(--font-mono); font-size: .72rem; padding: .1rem .5rem; border-radius: 999px;
  border: 1px solid var(--accent); color: var(--accent); }
.block-metric { display: inline-flex; flex-direction: column; margin-right: 1.5rem; }
.metric-value { font-family: var(--font-mono); font-size: 1.8rem; color: var(--accent); }
.metric-label { color: var(--muted); font-size: .8rem; }
.block-ascii .ascii { font-family: var(--font-mono); font-size: .8rem; line-height: 1.3; overflow-x: auto;
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; }
.block-ascii figcaption, .block-image figcaption { color: var(--muted); font-size: .82rem; margin-bottom: .5rem; }
.project-links { display: flex; gap: 1rem; flex-wrap: wrap; font-family: var(--font-mono); font-size: .85rem; }
.skill-cat { margin-bottom: 1.4rem; }
.skill-cat-name { font-size: 1rem; color: var(--muted); }
.lang-list { list-style: none; padding: 0; display: flex; gap: 1.2rem; flex-wrap: wrap; }
.lang-level { color: var(--accent); font-family: var(--font-mono); font-size: .8rem; }
.contact-links { display: flex; gap: 1.2rem; flex-wrap: wrap; }
[data-cluster="math"] .exp-company, [data-cluster="math"] .project-title, [data-cluster="math"] .edu-inst { border-bottom: 2px solid var(--cluster-math); }
[data-cluster="data"] .exp-company, [data-cluster="data"] .project-title { border-bottom: 2px solid var(--cluster-data); }
[data-cluster="engineering"] .project-title { border-bottom: 2px solid var(--cluster-engineering); }
@media (max-width: 600px) { .site-nav nav { display: none; } }
```

- [ ] **Step 2: Write `css/graph.css`**
```css
.graph-tooltip {
  position: fixed; z-index: 30; pointer-events: none; padding: .3rem .6rem;
  background: var(--ink); color: var(--bg); font-family: var(--font-mono); font-size: .78rem;
  border-radius: 6px; opacity: 0; transition: opacity .12s; white-space: nowrap;
}
.graph-tooltip[data-show="true"] { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .graph-tooltip { transition: none; } }
```

- [ ] **Step 3: Manual verification**
Reload. Expected: nav sticky + blurred, hero centered, projects/experience/skills styled, ASCII chart in a monospace box, cluster-colored underlines, tags as pills, both themes legible, mobile (<600px) hides nav links.

- [ ] **Step 4: Commit**
```bash
git add css/sections.css css/graph.css
git commit -m "feat: section and graph styling for both themes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Motion module (`motion.js`) — scroll-reveal, count-up, ASCII draw-in

**Files:**
- Create: `js/motion.js`
- Modify: `js/main.js` (call `initMotion()` after mount)

**Interfaces:**
- Consumes: DOM produced by renderers (`[data-countup]`, `[data-animate="ascii"]`, `.exp/.project/.edu/.skill-cat`).
- Produces: `initMotion()` — if `prefers-reduced-motion`, no-op (content already visible). Else: IntersectionObserver adds `.in-view` to sections/cards; count-up animates numeric `data-countup` values; ASCII charts reveal bar characters left-to-right.

- [ ] **Step 1: Write `js/motion.js`**
```js
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(el) {
  const target = parseFloat(el.dataset.countup);
  if (!Number.isFinite(target)) return;
  const dur = 900; const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(target * t).toString();
    if (t < 1) requestAnimationFrame(tick); else el.textContent = el.dataset.countup;
  };
  requestAnimationFrame(tick);
}

function revealAscii(pre) {
  const full = pre.textContent; pre.textContent = '';
  let i = 0; const step = Math.max(1, Math.floor(full.length / 60));
  const tick = () => { i += step; pre.textContent = full.slice(0, i);
    if (i < full.length) requestAnimationFrame(tick); else pre.textContent = full; };
  requestAnimationFrame(tick);
}

export function initMotion() {
  const cards = document.querySelectorAll('.exp, .project, .edu, .skill-cat, .summary-text');
  if (reduced()) { cards.forEach(c => c.classList.add('in-view')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in-view');
      e.target.querySelectorAll?.('[data-countup]').forEach(countUp);
      e.target.querySelectorAll?.('[data-animate="ascii"]').forEach(revealAscii);
      io.unobserve(e.target);
    }
  }, { threshold: 0.2 });
  cards.forEach(c => io.observe(c));
}
```

- [ ] **Step 2: Add reveal CSS to `css/base.css`** (append)
```css
.exp, .project, .edu, .skill-cat, .summary-text { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
  .exp, .project, .edu, .skill-cat, .summary-text { opacity: 0; transform: translateY(12px); transition: opacity .5s, transform .5s; }
  .in-view { opacity: 1 !important; transform: none !important; }
}
```

- [ ] **Step 3: Wire into `js/main.js`** — after `mountSections(model);` add:
```js
import { initMotion } from './motion.js';
// ...inside start(), after mountSections(model):
initMotion();
```

- [ ] **Step 4: Manual verification**
Reload with normal motion: sections fade/rise into view; any metric counts up; ASCII chart types in. Then enable OS "reduce motion" (or DevTools rendering emulation) and reload: everything visible immediately, no animation.

- [ ] **Step 5: Commit**
```bash
git add js/motion.js js/main.js css/base.css
git commit -m "feat: scroll-reveal, count-up, and ascii draw-in (reduced-motion safe)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Graph view (`graph-view.js`) — canvas render, load animation, interaction

**Files:**
- Create: `js/graph-view.js`
- Modify: `js/main.js` (init graph on `model:ready`)

**Interfaces:**
- Consumes: `deriveGraph` (`graph-model.js`), `createSimulation` (`force.js`), `clamp` (`util.js`); the model; the `#graph-canvas` element and cluster colors from `model.settings.graph.clusters`.
- Produces: `initGraph(model, canvas)` — derives the graph, seeds positions near each cluster centroid (3 regions across the width), runs the simulation on `requestAnimationFrame`, draws edges + nodes (entity nodes filled by cluster color, tool nodes small/neutral, radius by `weight`), freezes when energy < threshold, pauses when tab hidden / canvas offscreen. "Signal from noise": start nodes at random scattered positions with high alpha jitter and ease into settled layout. Hover highlights node + neighbors via a tooltip (`.graph-tooltip`); click on an entity node scrolls to `node.ref` section. Under `prefers-reduced-motion`, run the sim headless (~300 steps) then draw once (no animation, no rAF loop).

- [ ] **Step 1: Write `js/graph-view.js`**
```js
import { deriveGraph } from './graph-model.js';
import { createSimulation } from './force.js';
import { clamp } from './util.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initGraph(model, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const clusters = model.settings.graph.clusters;
  const order = ['math','data','engineering'];
  const { nodes, edges } = deriveGraph(model);
  const byId = new Map(nodes.map(n => [n.id, n]));

  let W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  const centers = {};
  order.forEach((k, i) => { centers[k] = { x: W * (i + 1) / 4, y: H / 2 }; });
  // seed: scattered "noise"
  for (const n of nodes) {
    const c = centers[n.cluster] || { x: W/2, y: H/2 };
    n.x = c.x + (Math.random() - 0.5) * W * 0.6;
    n.y = c.y + (Math.random() - 0.5) * H * 0.6;
    n.vx = 0; n.vy = 0;
  }
  const sim = createSimulation(nodes, edges, {
    width: W, height: H, clusterCenters: centers,
    springLength: 50, repulsion: 1200, clusterGravity: 0.014
  });

  const radius = (n) => clamp(4 + n.weight * 1.4, 4, 16);
  const colorOf = (n) => n.cluster ? (clusters[n.cluster]?.color || '#888') : 'rgba(140,140,140,.6)';

  let hover = null;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(128,128,128,.35)'; ctx.lineWidth = 1;
    for (const e of edges) {
      const a = byId.get(e.source), b = byId.get(e.target); if (!a || !b) continue;
      const lit = hover && (a.id === hover.id || b.id === hover.id);
      ctx.globalAlpha = lit ? 0.9 : 0.25;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const n of nodes) {
      ctx.beginPath(); ctx.arc(n.x, n.y, radius(n), 0, Math.PI * 2);
      ctx.fillStyle = colorOf(n); ctx.globalAlpha = (!hover || hover === n) ? 1 : 0.5;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let raf = null, frozen = false;
  function loop() {
    const e = sim.step();
    draw();
    if (e < 0.05) { frozen = true; return; }
    raf = requestAnimationFrame(loop);
  }
  function startLoop() { if (!frozen && raf == null) raf = requestAnimationFrame(loop); }
  function stopLoop() { if (raf != null) { cancelAnimationFrame(raf); raf = null; } }

  if (reduced()) { for (let i = 0; i < 300; i++) sim.step(); draw(); }
  else { startLoop(); }

  // pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop(); else if (!frozen) startLoop();
  });
  // pause when hero scrolled offscreen
  const io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { if (!frozen) startLoop(); } else stopLoop();
  }, { threshold: 0 });
  io.observe(canvas);

  window.addEventListener('resize', () => { resize();
    order.forEach((k,i)=>{ centers[k]={x:W*(i+1)/4,y:H/2}; }); frozen=false; startLoop(); });

  // tooltip + interaction
  const tip = document.createElement('div'); tip.className = 'graph-tooltip';
  document.body.appendChild(tip);
  function nodeAt(px, py) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]; if (Math.hypot(n.x - px, n.y - py) <= radius(n) + 4) return n;
    }
    return null;
  }
  canvas.addEventListener('mousemove', (ev) => {
    const r = canvas.getBoundingClientRect();
    hover = nodeAt(ev.clientX - r.left, ev.clientY - r.top);
    if (hover) {
      tip.textContent = hover.label; tip.dataset.show = 'true';
      tip.style.left = `${ev.clientX + 12}px`; tip.style.top = `${ev.clientY + 12}px`;
      canvas.style.cursor = hover.ref ? 'pointer' : 'default';
      if (frozen) draw();
    } else { tip.dataset.show = 'false'; canvas.style.cursor = 'default'; if (frozen) draw(); }
  });
  canvas.addEventListener('mouseleave', () => { hover = null; tip.dataset.show = 'false'; if (frozen) draw(); });
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    const n = nodeAt(ev.clientX - r.left, ev.clientY - r.top);
    if (n?.ref) {
      const el = document.getElementById(n.ref.section);
      el?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
    }
  });
}
```

- [ ] **Step 2: Wire into `js/main.js`** — add import and init after model is ready:
```js
import { initGraph } from './graph-view.js';
// inside start(), after initMotion():
initGraph(model, document.getElementById('graph-canvas'));
```

- [ ] **Step 3: Manual verification**
Reload. Expected: nodes scatter then settle into 3 clusters; edges connect entities to shared tools (visible bridges between clusters); hovering shows a tooltip and highlights neighbors; clicking an entity node scrolls to its section; switching tabs pauses animation; resizing reflows. Enable reduce-motion: graph appears already settled, no animation, hover still works.

- [ ] **Step 4: Performance check**
Open DevTools Performance/CPU: confirm the rAF loop stops (CPU ~0) a few seconds after load (frozen) and when the hero is scrolled away.

- [ ] **Step 5: Commit**
```bash
git add js/graph-view.js js/main.js
git commit -m "feat: canvas network hero with signal-from-noise load and interaction

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Data content updates (clusters, tags, approved new entries, settings graph config)

**Files:**
- Modify: `data/projects.json`, `data/experience.json`, `data/education.json`, `data/settings.json`

**Interfaces:** Consumed by `normalizeData`/`deriveGraph`/renderers. Must satisfy: every entity has a valid `cluster`; experience items gain a `tags` array of tools; new approved entries added per confidentiality rule.

- [ ] **Step 1: Add `cluster` + `tags` to `data/experience.json`** — for each company item add `"cluster": "data"` and a `"tags"` array of the tools that role used. Example for Saal.ai item (place `tags` at the item level, sibling to `roles`):
```json
"cluster": "data",
"tags": ["Python", "Pandas", "MongoDB", "Docker", "Power BI", "Tableau", "Dataiku", "Flask"]
```
For Daman add `"cluster": "data", "tags": ["SQL", "Business Intelligence"]`.

- [ ] **Step 2: Add `cluster` to `data/education.json`** — Khalifa University: `"cluster": "math"`; Al Nahda: `"cluster": "math"`. (Khalifa already implicitly math; explicit is required.)

- [ ] **Step 3: Update `data/projects.json`** — add `"cluster"` to existing projects (`Stmnt` → `engineering`, KRLS research → `math`) and add approved new entries. Append these items to the `items` array:
```json
{
  "title": "HiSalon",
  "status": "in-progress",
  "cluster": "engineering",
  "tags": ["TypeScript", "Flutter", "PostgreSQL", "AWS", "Supabase"],
  "links": {},
  "blocks": [
    { "type": "description", "content": "A production salon-management platform built with the Join-Future team. I work across the stack — TypeScript services, a Flutter client, and a production PostgreSQL backend on AWS. My focus has been making it reliable and safe to run in production." }
  ]
},
{
  "title": "Wafa",
  "status": "in-progress",
  "cluster": "engineering",
  "tags": ["TypeScript", "Supabase"],
  "links": { "github": "https://github.com/7mxd/Wafa" },
  "blocks": [
    { "type": "description", "content": "Interest-free (qard hasan) loan tracking between friends — a record of agreement, not a payment processor. Built in TypeScript." }
  ]
},
{
  "title": "GCC Currency",
  "status": "shipped",
  "cluster": "engineering",
  "tags": ["TypeScript"],
  "links": { "github": "https://github.com/7mxd/gcc_currency" },
  "blocks": [
    { "type": "description", "content": "A small utility around GCC currency data." }
  ]
},
{
  "title": "Other production systems at Join-Future",
  "status": "in-progress",
  "cluster": "engineering",
  "tags": ["TypeScript", "Claude / AI agents"],
  "blocks": [
    { "type": "description", "content": "Additional production systems with the Join-Future team across payments and AI platforms. Details under wraps." }
  ],
  "links": {}
}
```
Also add `"Claude / AI agents"` to the `tags` of `Stmnt` (it uses an AI pipeline) and to the Saal.ai experience tags, so the AI-agent through-line forms cross-cluster bridges.

- [ ] **Step 4: Add `graph` + `theme` to `data/settings.json`** — add these keys at the top level:
```json
"theme": "auto",
"graph": {
  "clusters": {
    "math":        { "label": "Mathematics",            "color": "#6c5ce7" },
    "data":        { "label": "Data Science",           "color": "#d68a1e" },
    "engineering": { "label": "Engineering & Products",  "color": "#1d9bb8" }
  }
}
```

- [ ] **Step 5: Validate JSON + verify in browser**
Run: `node -e "for (const f of ['profile','summary','experience','projects','skills','education','settings']) JSON.parse(require('fs').readFileSync('data/'+f+'.json','utf8')); console.log('all valid')"`
Expected: `all valid`. Then reload the site: new projects appear; graph shows new nodes and the `Claude / AI agents` + `TypeScript` bridges between Data and Engineering clusters.

- [ ] **Step 6: Commit**
```bash
git add data/projects.json data/experience.json data/education.json data/settings.json
git commit -m "content: add clusters, tags, approved Join-Future entries, graph config

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Print stylesheet (`print.css`)

**Files:**
- Create: `css/print.css` (already linked in `index.html` via `media="print"`)

**Interfaces:** Print-only. Hides the canvas/nav/toggle; renders a clean one-page-ish document.

- [ ] **Step 1: Write `css/print.css`**
```css
@media print {
  .site-nav, [data-theme-toggle], #graph-canvas, .skip-link, .hero-actions, .graph-tooltip { display: none !important; }
  html { background: #fff; }
  body { color: #000; background: #fff; font-size: 11pt; }
  .hero { min-height: auto; padding: 0 0 1rem; }
  .hero-content { background: none; text-align: left; }
  #hero-name { font-size: 20pt; }
  main { max-width: none; padding: 0; }
  section { padding: .6rem 0; border-top: 1px solid #ccc; break-inside: avoid; }
  a { color: #000; text-decoration: underline; }
  .exp, .project, .edu, .skill-cat, .summary-text { opacity: 1 !important; transform: none !important; }
}
```

- [ ] **Step 2: Manual verification**
Browser Print Preview (Ctrl+P). Expected: no canvas/nav, name as a heading, all sections as a clean black-on-white document; cards not clipped across pages.

- [ ] **Step 3: Commit**
```bash
git add css/print.css
git commit -m "feat: print stylesheet for clean document output

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Remove legacy files + rewrite CLAUDE.md design context + README

**Files:**
- Remove: `style.css`, `script.js`
- Modify: `CLAUDE.md` (Design Context section), `README.md`

**Interfaces:** None runtime. Ensures no dangling references to old files and updates docs to the new identity.

- [ ] **Step 1: Confirm nothing references the old files**
Run: `grep -rn "script.js\|style.css" index.html js/ css/ || echo "no references"`
Expected: `no references` (the new `index.html` links `css/*` and `js/main.js`).

- [ ] **Step 2: Remove legacy files**
```bash
git rm style.css script.js
```

- [ ] **Step 3: Rewrite the "Design Context" section of `CLAUDE.md`** — replace the old terminal/printed direction with the data-world identity. Replace everything from the `## Design Context` heading to the end of the file with:
```markdown
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
```

- [ ] **Step 4: Update `README.md`** — reflect the new structure. Replace the "Running locally / structure" notes with:
```markdown
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
```

- [ ] **Step 5: Verify site still loads + tests pass**
Run: `npm test` (Expected: all pass), then reload `http://localhost:8000` (Expected: full site works with no console 404s for `style.css`/`script.js`).

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "chore: remove legacy site files; rewrite design context and README

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Final verification pass (spec §13)

**Files:** None modified unless issues found.

- [ ] **Step 1: Run the full test suite**
Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: File-size budget**
Run: `node -e "const fs=require('fs');let t=0;for(const d of ['css','js'])for(const f of fs.readdirSync(d))t+=fs.statSync(d+'/'+f).size;console.log((t/1024).toFixed(1)+'KB')"`
Expected: < 150KB. If over, trim.

- [ ] **Step 3: Accessibility + themes (manual)**
Verify: Lighthouse a11y ≥ 95; AA contrast in both themes (toggle); keyboard-only nav (skip link, nav links, theme button, project links) with visible focus; SR live region announces theme change.

- [ ] **Step 4: Reduced motion + mobile + print (manual)**
Verify: reduce-motion → no animation, graph settled, content intact; layouts at 360px / 768px / 1280px; touch targets adequate; Print Preview clean.

- [ ] **Step 5: Content parity (manual)**
Compare against the previous site (`git show HEAD~N:script.js` / old data) — every datum (all roles, responsibilities, projects, skills, languages, education, contact, CV link) is present.

- [ ] **Step 6: Commit any fixes + final commit**
```bash
git add -A
git commit -m "test: final verification fixes for data-world portfolio

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (against spec)

**Spec coverage:**
- §4 network (model/sim/load/interaction/a11y) → Tasks 3,4,12 + canvas `aria-hidden` & text equiv in Task 8. ✓
- §5 page sections (all content-complete) → Tasks 5,6,8,10. ✓
- §6 theming → Tasks 7,9. ✓
- §7 accessibility → Tasks 8,9,11,16. ✓
- §8 performance (no build, <150KB, lazy img, freeze sim) → Tasks 1,12,16; `loading="lazy"` in Task 5 image block. ✓
- §9 confidentiality → Task 13 (only HiSalon named). ✓
- §10 schema changes → Tasks 2,13. ✓
- §11 risks (noscript fallback, canvas a11y) → Task 8 `<noscript>` + text equivalent. ✓
- §12 deliverables (CLAUDE.md rewrite, README) → Task 15. ✓
- §13 verification → Task 16. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Visual tasks carry real baseline code + explicit manual checks (the chosen hybrid methodology), not placeholders. Hex values are concrete.

**Type consistency:** `deriveGraph`→`{nodes,edges,toolUsage}` consumed consistently by `force.js`/`graph-view.js`; node shape `{id,kind,label,cluster,ref,weight}` matches across Tasks 3/12; `mountSections` `.section-body` lookup is consistent between Task 8 and Task 6; `chooseTheme`/`nextTheme` signatures consistent across Tasks 7/12. ✓
