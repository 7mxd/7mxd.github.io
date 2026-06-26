# Custom GitHub-Backed Admin (Project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Decap CMS with a no-build vanilla admin under `admin/` that edits `data/*.json` + `assets/` images via the GitHub Contents API, authenticated by the existing Vercel OAuth, committing directly to `main`.

**Architecture:** Vanilla ES modules under `admin/`. Pure-logic modules (schema, helpers, validation, form-model transforms, GitHub payload/URL builders, block-model helpers) carry no browser globals and are unit-tested with the repo's Node `node:test` harness. DOM/auth/upload modules are thin and verified by hand. Forms are generated from a declarative `admin/schema.js`; content-block sub-forms come from the shared `data/blocks-registry.json`.

**Tech Stack:** HTML5, CSS custom properties (reuses `css/tokens.css`), vanilla ES2020+ modules, GitHub REST Contents API. Dev-only: Node ≥18 `node:test`/`node:assert`.

## Global Constraints

- **No build step. Zero runtime dependencies.** ES modules via native `import`; served as static files.
- **Pure modules** (`admin/schema.js`, `admin/lib.js`, `admin/validate.js`, `admin/forms-model.js`, `admin/blocks-model.js`, and the builder exports of `admin/github.js`) must NOT reference `window`/`document`/`fetch`/`btoa` at module top level. `btoa`/`atob` usage must be guarded so Node can import (use the `Buffer` branch under Node).
- **Tests:** Node built-in `node:test` only; run with `npm test` (`node --test`, no path). Never shipped.
- **Commit format:** every save the admin makes commits to `main` via the API; this plan's own git commits end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **JSON style:** serialize data files as `JSON.stringify(obj, null, 2) + "\n"` (2-space indent, trailing newline) to match existing files.
- **Auth:** token is `repo`-scoped, stored in `sessionStorage` key `gh_token`; access control is GitHub's (writes require repo write access). `admin/` stays `noindex`.
- **Confidentiality:** the admin edits live data; do not seed it with any content. (No HiPay/joinfuture.ai/joinCX literals anywhere.)
- **Repo:** `7mxd/7mxd.github.io`, branch `main`.

---

## File Structure

**Created (admin app):**
- `admin/index.html` — shell: login view + app view (sidebar + form panel). `noindex`.
- `admin/lib.js` — pure helpers: base64, JSON serialize, filename/image validation. Tested.
- `admin/schema.js` — declarative collections + fields. Tested.
- `admin/validate.js` — pure required/shape validation. Tested.
- `admin/forms-model.js` — pure `buildFormModel`/`modelToData`. Tested.
- `admin/blocks-model.js` — pure block helpers from `blocks-registry.json`. Tested.
- `admin/github.js` — Contents API client; pure builders (`contentsUrl`, `putBody`, `decodeFile`) tested, network methods thin.
- `admin/auth.js` — OAuth popup + token storage (DOM, manual).
- `admin/media.js` — image pick/validate/upload (DOM, manual; validation reuses lib).
- `admin/forms.js` — DOM form renderer + `readForm` (manual; uses forms-model).
- `admin/blocks-editor.js` — DOM block list editor (manual; uses blocks-model).
- `admin/app.js` — entry: boot, login/app routing, collection select, save flow, conflict handling.
- `admin/admin.css` — styles reusing site tokens.

**Created (tests):**
- `test/admin-lib.test.js`, `test/admin-schema.test.js`, `test/admin-validate.test.js`, `test/admin-forms-model.test.js`, `test/admin-blocks-model.test.js`, `test/admin-github.test.js`.

**Modified:**
- `api/callback.js` — change success `postMessage` to `{type:'oauth:success', token, provider:'github'}`.
- `README.md` — admin usage note.

**Removed:**
- `admin/config.yml` (Decap config). The old `admin/index.html` Decap loader is overwritten by the new shell.

---

## Shared shapes (reference for all tasks)

Schema field:
```js
{ name, label, type, required?, options?, fields?, itemField?, scope?, accept? }
// type ∈ 'string'|'text'|'boolean'|'select'|'image'|'object'|'list'|'blocks'
// object → has `fields:[field...]`; list → has `fields` (sub-schema) OR `itemField` (single primitive field, e.g. tags); select → `options:[{label,value}]`; blocks → `scope:'project'|'experience'|'education'`; image → `accept` default image types
```
Collection:
```js
{ name, file, label, kind:'single'|'list', listKey?, fields?, itemFields? }
// single → data is an object shaped by `fields`
// list   → data is { [listKey]: [ item shaped by itemFields ] }   (listKey 'items' or 'categories')
```
GitHub builders:
```js
contentsUrl(path) -> 'https://api.github.com/repos/7mxd/7mxd.github.io/contents/' + path
decodeFile(resp) -> { content:String, sha:String }     // base64-decodes resp.content
putBody({ message, contentString, sha, branch='main' }) -> { message, content:<base64>, sha?, branch }
```

---

### Task 1: Pure helpers (`admin/lib.js`)

**Files:**
- Create: `admin/lib.js`, `test/admin-lib.test.js`

**Interfaces:**
- Produces: `toBase64(str)->String`, `fromBase64(b64)->String`, `serializeJson(obj)->String` (2-space + trailing `\n`), `sanitizeFilename(name)->String`, `validateImage({type,size})->{ok:Boolean, error?:String}`.

- [ ] **Step 1: Write the failing test** — `test/admin-lib.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBase64, fromBase64, serializeJson, sanitizeFilename, validateImage } from '../admin/lib.js';

test('base64 round-trips UTF-8', () => {
  const s = 'Ahmed — Radhi · café ✓';
  assert.equal(fromBase64(toBase64(s)), s);
});
test('serializeJson is 2-space with trailing newline', () => {
  assert.equal(serializeJson({a:1}), '{\n  "a": 1\n}\n');
});
test('sanitizeFilename lowercases, dashes spaces, keeps extension', () => {
  assert.equal(sanitizeFilename('My Logo (1).PNG'), 'my-logo-1.png');
});
test('validateImage accepts png under 2MB', () => {
  assert.deepEqual(validateImage({type:'image/png', size: 500000}), {ok:true});
});
test('validateImage rejects disallowed type', () => {
  const r = validateImage({type:'image/gif', size: 100});
  assert.equal(r.ok, false); assert.match(r.error, /type/i);
});
test('validateImage rejects oversize', () => {
  const r = validateImage({type:'image/png', size: 3*1024*1024});
  assert.equal(r.ok, false); assert.match(r.error, /2 ?MB|large/i);
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../admin/lib.js`.

- [ ] **Step 3: Implement `admin/lib.js`**
```js
const IMG_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_IMG = 2 * 1024 * 1024;

export function toBase64(str) {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(str)));
}
export function fromBase64(b64) {
  const clean = String(b64).replace(/\s/g, '');
  if (typeof Buffer !== 'undefined') return Buffer.from(clean, 'base64').toString('utf8');
  return decodeURIComponent(escape(atob(clean)));
}
export function serializeJson(obj) { return JSON.stringify(obj, null, 2) + '\n'; }
export function sanitizeFilename(name) {
  const dot = String(name).lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return ext ? `${slug}.${ext}` : slug;
}
export function validateImage({ type, size }) {
  if (!IMG_TYPES.includes(type)) return { ok: false, error: `Unsupported type ${type}. Allowed: PNG, JPEG, SVG, WebP.` };
  if (size > MAX_IMG) return { ok: false, error: 'Image too large (max 2MB).' };
  return { ok: true };
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (existing site tests + 6 new).

- [ ] **Step 5: Commit**
```bash
git add admin/lib.js test/admin-lib.test.js
git commit -m "feat(admin): pure helpers (base64, json, filename, image validation)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Collection schema (`admin/schema.js`)

**Files:**
- Create: `admin/schema.js`, `test/admin-schema.test.js`

**Interfaces:**
- Produces: `COLLECTIONS` (array of Collection per Shared shapes) and `getCollection(name)->Collection|undefined`. Must include all 7: profile, summary, settings, education, experience, projects, skills — with the Project-A fields (`cluster`, `tags`, `settings.graph.clusters`, `settings.theme`).

- [ ] **Step 1: Write the failing test** — `test/admin-schema.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTIONS, getCollection } from '../admin/schema.js';

const VALID_TYPES = new Set(['string','text','boolean','select','image','object','list','blocks']);

test('all 7 collections present', () => {
  assert.deepEqual(COLLECTIONS.map(c => c.name).sort(),
    ['education','experience','profile','projects','settings','skills','summary']);
});
test('every field has name/label and a valid type', () => {
  const walk = (fields) => fields.forEach(f => {
    assert.ok(f.name && f.label, `field missing name/label: ${JSON.stringify(f)}`);
    assert.ok(VALID_TYPES.has(f.type), `bad type ${f.type} on ${f.name}`);
    if (f.type === 'object') assert.ok(Array.isArray(f.fields));
    if (f.type === 'list') assert.ok(Array.isArray(f.fields) || f.itemField, `list ${f.name} needs fields or itemField`);
    if (f.type === 'select') assert.ok(Array.isArray(f.options));
    if (f.type === 'blocks') assert.ok(['project','experience','education'].includes(f.scope));
    if (f.fields) walk(f.fields);
  });
  for (const c of COLLECTIONS) {
    assert.ok(c.file && c.label && (c.kind === 'single' || c.kind === 'list'));
    if (c.kind === 'list') assert.ok(c.listKey && Array.isArray(c.itemFields));
    walk(c.kind === 'list' ? c.itemFields : c.fields);
  }
});
test('projects item has cluster + tags + blocks(scope project)', () => {
  const p = getCollection('projects');
  const names = p.itemFields.map(f => f.name);
  assert.ok(names.includes('cluster') && names.includes('tags'));
  assert.ok(p.itemFields.some(f => f.type === 'blocks' && f.scope === 'project'));
});
test('settings has graph.clusters and theme', () => {
  const s = getCollection('settings');
  const graph = s.fields.find(f => f.name === 'graph');
  assert.ok(graph && graph.fields.some(f => f.name === 'clusters'));
  assert.ok(s.fields.some(f => f.name === 'theme' && f.type === 'select'));
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../admin/schema.js`.

- [ ] **Step 3: Implement `admin/schema.js`**
```js
const clusterField = { name:'cluster', label:'Cluster', type:'select', options:[
  {label:'Mathematics', value:'math'}, {label:'Data Science', value:'data'}, {label:'Engineering & Products', value:'engineering'} ] };
const tagsField = { name:'tags', label:'Tags', type:'list', itemField:{ name:'tag', label:'Tag', type:'string' } };

export const COLLECTIONS = [
  { name:'profile', file:'data/profile.json', label:'Profile', kind:'single', fields:[
    { name:'name', label:'Full name', type:'string', required:true },
    { name:'title', label:'Title', type:'string', required:true },
    { name:'contact', label:'Contact', type:'object', fields:[
      { name:'email', label:'Email', type:'string' },
      { name:'phone', label:'Phone', type:'string' },
      { name:'location', label:'Location', type:'string' },
      { name:'linkedin', label:'LinkedIn', type:'object', fields:[
        { name:'url', label:'URL', type:'string' }, { name:'label', label:'Label', type:'string' } ] },
      { name:'github', label:'GitHub', type:'object', fields:[
        { name:'url', label:'URL', type:'string' }, { name:'label', label:'Label', type:'string' } ] } ] } ] },

  { name:'summary', file:'data/summary.json', label:'Summary', kind:'single', fields:[
    { name:'content', label:'Summary text', type:'text', required:true } ] },

  { name:'settings', file:'data/settings.json', label:'Settings', kind:'single', fields:[
    { name:'siteTitle', label:'Site title', type:'string' },
    { name:'navLogo', label:'Nav logo text', type:'string' },
    { name:'theme', label:'Default theme', type:'select', options:[
      {label:'Auto', value:'auto'}, {label:'Light', value:'light'}, {label:'Dark', value:'dark'} ] },
    { name:'cv', label:'CV', type:'object', fields:[
      { name:'path', label:'CV file', type:'image', accept:'.pdf' }, { name:'downloadName', label:'Download filename', type:'string' } ] },
    { name:'meta', label:'SEO meta', type:'object', fields:[
      { name:'title', label:'Meta title', type:'string' }, { name:'description', label:'Meta description', type:'text' },
      { name:'keywords', label:'Keywords', type:'string' }, { name:'url', label:'Site URL', type:'string' } ] },
    { name:'graph', label:'Graph', type:'object', fields:[
      { name:'clusters', label:'Clusters', type:'object', fields:[
        { name:'math', label:'Mathematics', type:'object', fields:[ {name:'label',label:'Label',type:'string'}, {name:'color',label:'Color',type:'string'} ] },
        { name:'data', label:'Data Science', type:'object', fields:[ {name:'label',label:'Label',type:'string'}, {name:'color',label:'Color',type:'string'} ] },
        { name:'engineering', label:'Engineering', type:'object', fields:[ {name:'label',label:'Label',type:'string'}, {name:'color',label:'Color',type:'string'} ] } ] } ] } ] },

  { name:'education', file:'data/education.json', label:'Education', kind:'list', listKey:'items', itemFields:[
    { name:'institution', label:'Institution', type:'string', required:true },
    { name:'logo', label:'Logo', type:'image' },
    { name:'degree', label:'Degree', type:'string' },
    { name:'startDate', label:'Start (YYYY-MM)', type:'string' },
    { name:'endDate', label:'End (YYYY-MM)', type:'string' },
    { name:'displayDate', label:'Display date', type:'string' },
    { name:'grade', label:'Grade', type:'string' },
    clusterField,
    { name:'blocks', label:'Blocks', type:'blocks', scope:'education' } ] },

  { name:'experience', file:'data/experience.json', label:'Experience', kind:'list', listKey:'items', itemFields:[
    { name:'company', label:'Company', type:'string', required:true },
    { name:'logo', label:'Logo', type:'object', fields:[
      { name:'default', label:'Default', type:'image' }, { name:'light', label:'Light', type:'image' }, { name:'dark', label:'Dark', type:'image' } ] },
    { name:'location', label:'Location', type:'string' },
    clusterField, tagsField,
    { name:'roles', label:'Roles', type:'list', fields:[
      { name:'title', label:'Title', type:'string', required:true },
      { name:'startDate', label:'Start (YYYY-MM)', type:'string' },
      { name:'endDate', label:'End (YYYY-MM or Present)', type:'string' },
      { name:'displayDate', label:'Display date', type:'string' },
      { name:'blocks', label:'Blocks', type:'blocks', scope:'experience' } ] } ] },

  { name:'projects', file:'data/projects.json', label:'Projects', kind:'list', listKey:'items', itemFields:[
    { name:'title', label:'Title', type:'string', required:true },
    { name:'status', label:'Status', type:'select', options:[
      {label:'(none)', value:''}, {label:'in progress', value:'in-progress'}, {label:'shipped', value:'shipped'},
      {label:'research', value:'research'}, {label:'archived', value:'archived'} ] },
    clusterField, tagsField,
    { name:'image', label:'Image', type:'image' },
    { name:'links', label:'Links', type:'object', fields:[
      { name:'github', label:'GitHub URL', type:'string' }, { name:'webapp', label:'Web app URL', type:'string' },
      { name:'ios', label:'iOS URL', type:'string' }, { name:'android', label:'Android URL', type:'string' },
      { name:'extra', label:'Extra links', type:'list', fields:[
        { name:'label', label:'Label', type:'string' }, { name:'url', label:'URL', type:'string' } ] } ] },
    { name:'blocks', label:'Blocks', type:'blocks', scope:'project' } ] },

  { name:'skills', file:'data/skills.json', label:'Skills', kind:'list', listKey:'categories', itemFields:[
    { name:'name', label:'Category name', type:'string', required:true },
    { name:'type', label:'Display type', type:'select', options:[
      {label:'Tags', value:'tags'}, {label:'Simple list', value:'list'}, {label:'Languages', value:'languages'} ] },
    { name:'items', label:'Items', type:'list', fields:[
      { name:'name', label:'Name', type:'string', required:true },
      { name:'level', label:'Level (languages only)', type:'string' } ] } ] }
];

export function getCollection(name) { return COLLECTIONS.find(c => c.name === name); }
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (+4).

- [ ] **Step 5: Commit**
```bash
git add admin/schema.js test/admin-schema.test.js
git commit -m "feat(admin): declarative collection schema with cluster/tags/graph fields

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Form-model transforms (`admin/forms-model.js`)

**Files:**
- Create: `admin/forms-model.js`, `test/admin-forms-model.test.js`

**Interfaces:**
- Consumes: Collection/field shapes from `schema.js`.
- Produces (pure): `buildFormModel(collection, data)->model` — normalizes raw file data into a complete editable model (fills missing objects/lists with defaults so the renderer never hits `undefined`); `modelToData(collection, model)->data` — inverse, producing the object to serialize (drops empty-string optional fields and empty lists). For `kind:'list'`, model/data are `{ [listKey]: [...] }`. Block fields pass through as arrays untouched (block editing handled elsewhere).

- [ ] **Step 1: Write the failing test** — `test/admin-forms-model.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCollection } from '../admin/schema.js';
import { buildFormModel, modelToData } from '../admin/forms-model.js';

test('single: buildFormModel fills missing nested objects', () => {
  const m = buildFormModel(getCollection('profile'), { name:'A', title:'t' });
  assert.equal(m.contact.email, '');
  assert.equal(m.contact.linkedin.url, '');
});
test('list: buildFormModel preserves items and fills item defaults', () => {
  const m = buildFormModel(getCollection('projects'), { items:[{ title:'P' }] });
  assert.equal(m.items[0].title, 'P');
  assert.deepEqual(m.items[0].tags, []);
  assert.deepEqual(m.items[0].blocks, []);
  assert.equal(m.items[0].links.github, '');
});
test('modelToData round-trips a project and drops empties', () => {
  const c = getCollection('projects');
  const data = { items:[{ title:'P', status:'shipped', cluster:'engineering', tags:['X'], links:{ github:'g' }, blocks:[{type:'description',content:'d'}] }] };
  const back = modelToData(c, buildFormModel(c, data));
  assert.equal(back.items[0].title, 'P');
  assert.equal(back.items[0].tags[0], 'X');
  assert.equal(back.items[0].links.github, 'g');
  assert.equal(back.items[0].links.ios, undefined); // empty dropped
  assert.equal(back.items[0].blocks[0].content, 'd');
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../admin/forms-model.js`.

- [ ] **Step 3: Implement `admin/forms-model.js`**
```js
function defaultFor(field) {
  switch (field.type) {
    case 'boolean': return false;
    case 'list': return [];
    case 'blocks': return [];
    case 'object': return buildObject(field.fields, {});
    default: return '';
  }
}
function buildObject(fields, data) {
  const out = {};
  for (const f of fields) {
    const v = data ? data[f.name] : undefined;
    if (f.type === 'object') out[f.name] = buildObject(f.fields, v || {});
    else if (f.type === 'list') out[f.name] = Array.isArray(v) ? v.map(it => itemModel(f, it)) : [];
    else if (f.type === 'blocks') out[f.name] = Array.isArray(v) ? v : [];
    else out[f.name] = v ?? defaultFor(f);
  }
  return out;
}
function itemModel(listField, item) {
  if (listField.itemField) return item; // primitive list (e.g. tags) — raw value
  return buildObject(listField.fields, item || {});
}
export function buildFormModel(collection, data) {
  if (collection.kind === 'single') return buildObject(collection.fields, data || {});
  const arr = Array.isArray(data?.[collection.listKey]) ? data[collection.listKey] : [];
  return { [collection.listKey]: arr.map(it => buildObject(collection.itemFields, it)) };
}

function cleanObject(fields, model) {
  const out = {};
  for (const f of fields) {
    const v = model ? model[f.name] : undefined;
    if (f.type === 'object') { const o = cleanObject(f.fields, v || {}); if (Object.keys(o).length) out[f.name] = o; }
    else if (f.type === 'list') {
      const list = (Array.isArray(v) ? v : []).map(it => f.itemField ? it : cleanObject(f.fields, it)).filter(it => f.itemField ? (it !== '' && it != null) : Object.keys(it).length);
      if (list.length) out[f.name] = list;
    }
    else if (f.type === 'blocks') { if (Array.isArray(v) && v.length) out[f.name] = v; }
    else if (f.type === 'boolean') out[f.name] = !!v;
    else if (v !== '' && v != null) out[f.name] = v;
  }
  return out;
}
export function modelToData(collection, model) {
  if (collection.kind === 'single') return cleanObject(collection.fields, model);
  const arr = (model?.[collection.listKey] || []).map(it => cleanObject(collection.itemFields, it));
  return { [collection.listKey]: arr };
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (+3).

- [ ] **Step 5: Commit**
```bash
git add admin/forms-model.js test/admin-forms-model.test.js
git commit -m "feat(admin): pure form-model build/serialize transforms

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Validation (`admin/validate.js`)

**Files:**
- Create: `admin/validate.js`, `test/admin-validate.test.js`

**Interfaces:**
- Consumes: Collection schema; a built form model.
- Produces (pure): `validateModel(collection, model)->[{path, message}]` — returns errors for missing `required` fields (recursing objects/list items). Empty array = valid.

- [ ] **Step 1: Write the failing test** — `test/admin-validate.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCollection } from '../admin/schema.js';
import { buildFormModel } from '../admin/forms-model.js';
import { validateModel } from '../admin/validate.js';

test('flags missing required field', () => {
  const c = getCollection('profile');
  const errs = validateModel(c, buildFormModel(c, { name:'' , title:'' }));
  assert.ok(errs.some(e => e.path.includes('name')));
  assert.ok(errs.some(e => e.path.includes('title')));
});
test('valid profile yields no errors', () => {
  const c = getCollection('profile');
  const errs = validateModel(c, buildFormModel(c, { name:'A', title:'t' }));
  assert.deepEqual(errs, []);
});
test('required inside list items is checked', () => {
  const c = getCollection('projects');
  const errs = validateModel(c, buildFormModel(c, { items:[{ title:'' }] }));
  assert.ok(errs.some(e => e.path.includes('items[0].title')));
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../admin/validate.js`.

- [ ] **Step 3: Implement `admin/validate.js`**
```js
function checkFields(fields, model, prefix, errs) {
  for (const f of fields) {
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    const v = model ? model[f.name] : undefined;
    if (f.required && (v === '' || v == null)) errs.push({ path, message: `${f.label} is required` });
    if (f.type === 'object') checkFields(f.fields, v || {}, path, errs);
    if (f.type === 'list' && !f.itemField && Array.isArray(v)) v.forEach((it, i) => checkFields(f.fields, it, `${path}[${i}]`, errs));
  }
}
export function validateModel(collection, model) {
  const errs = [];
  if (collection.kind === 'single') checkFields(collection.fields, model, '', errs);
  else (model?.[collection.listKey] || []).forEach((it, i) => checkFields(collection.itemFields, it, `${collection.listKey}[${i}]`, errs));
  return errs;
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (+3).

- [ ] **Step 5: Commit**
```bash
git add admin/validate.js test/admin-validate.test.js
git commit -m "feat(admin): required-field validation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Block-model helpers (`admin/blocks-model.js`)

**Files:**
- Create: `admin/blocks-model.js`, `test/admin-blocks-model.test.js`

**Interfaces:**
- Consumes: `data/blocks-registry.json` (passed in as a parsed object — keeps the module pure/testable).
- Produces (pure): `blockTypesForScope(registry, scope)->[{type,label}]`; `fieldsForBlock(registry, type)->[field]` (registry field defs); `newBlock(registry, type)->{type, ...defaults}` (empty strings / `[]` for list fields).

- [ ] **Step 1: Write the failing test** — `test/admin-blocks-model.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blockTypesForScope, fieldsForBlock, newBlock } from '../admin/blocks-model.js';
const reg = JSON.parse(readFileSync(new URL('../data/blocks-registry.json', import.meta.url)));

test('project scope includes description and ascii-chart, excludes responsibility', () => {
  const types = blockTypesForScope(reg, 'project').map(t => t.type);
  assert.ok(types.includes('description') && types.includes('ascii-chart'));
  assert.ok(!types.includes('responsibility'));
});
test('experience scope includes responsibility', () => {
  assert.ok(blockTypesForScope(reg, 'experience').map(t=>t.type).includes('responsibility'));
});
test('newBlock seeds the type and empty fields', () => {
  const b = newBlock(reg, 'metric');
  assert.equal(b.type, 'metric');
  assert.equal(b.label, ''); assert.equal(b.value, '');
});
test('fieldsForBlock returns the registry field list', () => {
  const f = fieldsForBlock(reg, 'ascii-chart').map(x => x.name);
  assert.deepEqual(f, ['caption','chart']);
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../admin/blocks-model.js`.

- [ ] **Step 3: Implement `admin/blocks-model.js`**
```js
export function blockTypesForScope(registry, scope) {
  return Object.entries(registry)
    .filter(([k, v]) => k !== '_comment' && Array.isArray(v.scope) && v.scope.includes(scope))
    .map(([type, v]) => ({ type, label: v.label || type }));
}
export function fieldsForBlock(registry, type) {
  const entry = registry[type];
  return entry && Array.isArray(entry.fields) ? entry.fields : [];
}
export function newBlock(registry, type) {
  const block = { type };
  for (const f of fieldsForBlock(registry, type)) {
    block[f.name] = f.type === 'list' ? [] : '';
  }
  return block;
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (+4).

- [ ] **Step 5: Commit**
```bash
git add admin/blocks-model.js test/admin-blocks-model.test.js
git commit -m "feat(admin): block-model helpers driven by blocks-registry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: GitHub client + pure builders (`admin/github.js`)

**Files:**
- Create: `admin/github.js`, `test/admin-github.test.js`

**Interfaces:**
- Consumes: `toBase64`/`fromBase64` from `lib.js`.
- Produces (pure): `contentsUrl(path)`, `decodeFile(resp)->{content,sha}`, `putBody({message,contentString,sha,branch='main'})->{message,content,sha?,branch}` (omits `sha` when falsy — for new files). Produces (network, thin): `createClient({token, fetchFn=fetch})` → `{ getFile(path), putFile(path, contentString, sha, message), putBinary(path, base64, sha, message) }`.

- [ ] **Step 1: Write the failing test** — `test/admin-github.test.js`
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentsUrl, decodeFile, putBody } from '../admin/github.js';
import { toBase64 } from '../admin/lib.js';

test('contentsUrl targets the repo', () => {
  assert.equal(contentsUrl('data/profile.json'),
    'https://api.github.com/repos/7mxd/7mxd.github.io/contents/data/profile.json');
});
test('decodeFile base64-decodes content and keeps sha', () => {
  const resp = { content: toBase64('{"a":1}'), sha: 'abc', encoding: 'base64' };
  assert.deepEqual(decodeFile(resp), { content: '{"a":1}', sha: 'abc' });
});
test('putBody encodes content and includes sha + branch', () => {
  const b = putBody({ message:'m', contentString:'{"a":1}', sha:'s1' });
  assert.equal(b.message, 'm'); assert.equal(b.branch, 'main'); assert.equal(b.sha, 's1');
  assert.equal(b.content, toBase64('{"a":1}'));
});
test('putBody omits sha for new files', () => {
  const b = putBody({ message:'m', contentString:'x', sha: null });
  assert.ok(!('sha' in b));
});
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test`
Expected: FAIL — cannot find module `../admin/github.js`.

- [ ] **Step 3: Implement `admin/github.js`**
```js
import { toBase64, fromBase64 } from './lib.js';

const REPO = '7mxd/7mxd.github.io';
export function contentsUrl(path) { return `https://api.github.com/repos/${REPO}/contents/${path}`; }
export function decodeFile(resp) { return { content: fromBase64(resp.content), sha: resp.sha }; }
export function putBody({ message, contentString, sha, branch = 'main' }) {
  const body = { message, content: toBase64(contentString), branch };
  if (sha) body.sha = sha;
  return body;
}

export function createClient({ token, fetchFn = fetch }) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  async function getFile(path) {
    const res = await fetchFn(contentsUrl(path), { headers });
    if (res.status === 404) return { content: null, sha: null };
    if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
    return decodeFile(await res.json());
  }
  async function put(path, body) {
    const res = await fetchFn(contentsUrl(path), { method:'PUT', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    if (res.status === 409 || res.status === 422) { const e = new Error('conflict'); e.conflict = true; throw e; }
    if (res.status === 403) { const e = new Error('no write access'); e.forbidden = true; throw e; }
    if (!res.ok) throw new Error(`PUT ${path} failed (${res.status})`);
    return res.json();
  }
  function putFile(path, contentString, sha, message) { return put(path, putBody({ message, contentString, sha })); }
  function putBinary(path, base64, sha, message) {
    const body = { message, content: base64.replace(/\s/g,''), branch:'main' }; if (sha) body.sha = sha;
    return put(path, body);
  }
  return { getFile, putFile, putBinary };
}
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test`
Expected: PASS (+4).

- [ ] **Step 5: Commit**
```bash
git add admin/github.js test/admin-github.test.js
git commit -m "feat(admin): GitHub Contents API client + pure builders

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: OAuth callback format + `admin/auth.js`

**Files:**
- Modify: `api/callback.js`
- Create: `admin/auth.js`

**Interfaces:**
- Produces: `auth.js` exports `getToken()->String|null` (reads `sessionStorage.gh_token`), `signOut()` (removes it), `signIn()->Promise<String>` (opens `/auth` popup, resolves with token via `postMessage`), `setToken(t)`. Origin-checks messages against the Vercel callback origin.

- [ ] **Step 1: Modify `api/callback.js`** — replace the Decap success HTML's message block. Change the inline script's message to:
```js
var data = { type: "oauth:success", token: "${accessToken}", provider: "github" };
if (window.opener) window.opener.postMessage(data, "*");
setTimeout(function(){ window.close(); }, 500);
```
(Remove the `"authorizing:github"` and `"authorization:github:success:"+JSON.stringify(...)` lines — Decap is gone.)

- [ ] **Step 2: Implement `admin/auth.js`**
```js
const KEY = 'gh_token';
const OAUTH_BASE = 'https://7mxd-oauth.vercel.app';
export function getToken() { return sessionStorage.getItem(KEY); }
export function setToken(t) { sessionStorage.setItem(KEY, t); }
export function signOut() { sessionStorage.removeItem(KEY); }
export function signIn() {
  return new Promise((resolve, reject) => {
    const popup = window.open(`${OAUTH_BASE}/auth`, 'oauth', 'width=600,height=700');
    if (!popup) return reject(new Error('Popup blocked'));
    function onMessage(e) {
      if (e.origin !== OAUTH_BASE) return;
      const d = e.data;
      if (d && d.type === 'oauth:success' && d.token) {
        window.removeEventListener('message', onMessage);
        setToken(d.token); resolve(d.token);
      }
    }
    window.addEventListener('message', onMessage);
  });
}
```

- [ ] **Step 3: Manual verification**
Deploy note: the Vercel app must be redeployed with the updated `api/callback.js` for the new message format to take effect (the Vercel project tracks this repo). Locally, you can't fully test OAuth without the deployed callback. Verify the file change is correct and the `OAUTH_BASE` matches the deployed callback origin (`https://7mxd-oauth.vercel.app`). Confirm `npm test` still passes (no test impact).
Run: `npm test` → all pass.

- [ ] **Step 4: Commit**
```bash
git add api/callback.js admin/auth.js
git commit -m "feat(admin): OAuth callback message format + auth/token module

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Admin shell + styles (`admin/index.html`, `admin/admin.css`)

**Files:**
- Create: `admin/index.html` (overwrite the Decap loader), `admin/admin.css`

**Interfaces:** Provides DOM containers `#login`, `#app`, `#collections` (sidebar), `#panel` (form host), `#topbar` (user + sign out + save), and loads `admin/app.js`. Reuses `../css/tokens.css`.

- [ ] **Step 1: Write `admin/index.html`**
```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>Content Manager · Ahmed's Portfolio</title>
  <link rel="stylesheet" href="../css/tokens.css" />
  <link rel="stylesheet" href="admin.css" />
</head>
<body>
  <section id="login" hidden>
    <div class="login-card">
      <h1>Content Manager</h1>
      <p>Edit your portfolio content. Changes commit to <code>main</code> and publish your site.</p>
      <button id="signin" class="btn">Sign in with GitHub</button>
      <p id="login-error" class="err" role="alert"></p>
    </div>
  </section>

  <section id="app" hidden>
    <header id="topbar">
      <span class="brand">Content Manager</span>
      <span id="who" class="who"></span>
      <span class="spacer"></span>
      <span id="save-status" class="save-status" aria-live="polite"></span>
      <button id="save" class="btn">Save</button>
      <button id="signout" class="btn ghost">Sign out</button>
    </header>
    <div class="layout">
      <nav id="collections" aria-label="Collections"></nav>
      <main id="panel"></main>
    </div>
  </section>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `admin/admin.css`**
```css
* { box-sizing: border-box; }
body { margin:0; font-family: var(--font-sans, system-ui); background: var(--bg, #f7f6f3); color: var(--ink, #171614); }
.btn { font-family: var(--font-mono, monospace); font-size:.9rem; padding:.5rem 1rem; border:1px solid var(--line,#ddd); border-radius:8px; background:var(--surface,#fff); color:var(--ink,#171614); cursor:pointer; }
.btn:hover { border-color: var(--accent,#1d9bb8); color: var(--accent,#1d9bb8); }
.btn.ghost { background:none; }
.err { color:#b3261e; min-height:1.2em; }
#login { min-height:100vh; display:grid; place-items:center; }
.login-card { max-width:28rem; text-align:center; padding:2rem; border:1px solid var(--line,#ddd); border-radius:12px; background:var(--surface,#fff); }
#topbar { display:flex; align-items:center; gap:1rem; padding:.6rem 1rem; border-bottom:1px solid var(--line,#ddd); position:sticky; top:0; background:var(--bg); z-index:5; }
#topbar .spacer { flex:1; }
.brand { font-family:var(--font-mono,monospace); font-weight:700; }
.who { color:var(--muted,#666); font-size:.85rem; }
.save-status { font-size:.85rem; color:var(--muted,#666); }
.save-status[data-state="ok"] { color:#1a7f37; }
.save-status[data-state="error"] { color:#b3261e; }
.layout { display:grid; grid-template-columns: 14rem 1fr; min-height: calc(100vh - 49px); }
#collections { border-right:1px solid var(--line,#ddd); padding:1rem .5rem; display:flex; flex-direction:column; gap:.25rem; }
#collections button { text-align:left; padding:.5rem .75rem; border:0; background:none; border-radius:8px; cursor:pointer; font:inherit; color:var(--ink); }
#collections button[aria-current="true"] { background:var(--surface,#fff); border:1px solid var(--line,#ddd); }
#panel { padding:1.5rem; max-width:48rem; }
.field { margin-bottom:1rem; display:flex; flex-direction:column; gap:.3rem; }
.field > label { font-size:.85rem; color:var(--muted,#666); font-family:var(--font-mono,monospace); }
.field input[type=text], .field input:not([type]), .field textarea, .field select { width:100%; padding:.5rem; border:1px solid var(--line,#ddd); border-radius:8px; background:var(--surface,#fff); color:var(--ink); font:inherit; }
.field textarea { min-height:6rem; resize:vertical; }
fieldset { border:1px solid var(--line,#ddd); border-radius:10px; margin:0 0 1rem; padding:1rem; }
legend { font-family:var(--font-mono,monospace); font-size:.8rem; color:var(--muted,#666); padding:0 .4rem; }
.list-item { border:1px dashed var(--line,#ddd); border-radius:10px; padding:1rem; margin-bottom:.75rem; position:relative; }
.row-controls { display:flex; gap:.4rem; margin-bottom:.5rem; }
.thumb { max-width:120px; max-height:80px; border:1px solid var(--line,#ddd); border-radius:6px; display:block; }
@media (max-width:700px){ .layout{ grid-template-columns:1fr; } #collections{ flex-direction:row; flex-wrap:wrap; border-right:0; border-bottom:1px solid var(--line,#ddd);} }
```

- [ ] **Step 3: Manual verification**
Run: `python -m http.server 8000`, open `http://localhost:8000/admin/`. Expected: login card renders (app hidden); styles load; no console errors except `app.js` not yet wiring data (built next). (After Task 9 `app.js` controls the hidden toggling.)

- [ ] **Step 4: Commit**
```bash
git add admin/index.html admin/admin.css
git commit -m "feat(admin): shell HTML and styles (login + app layout)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Form renderer + block editor + media (`admin/forms.js`, `admin/blocks-editor.js`, `admin/media.js`)

**Files:**
- Create: `admin/forms.js`, `admin/blocks-editor.js`, `admin/media.js`

**Interfaces:**
- Consumes: `buildFormModel`/`modelToData` (forms-model), `blockTypesForScope`/`fieldsForBlock`/`newBlock` (blocks-model), `validateImage`/`sanitizeFilename` (lib).
- Produces: `forms.js` → `renderForm(container, collection, model, ctx)` (builds DOM inputs bound to `model` in place — edits mutate `model`), where `ctx = { registry, onImagePick(field, setValue) }`. `blocks-editor.js` → `renderBlocks(container, blocks, scope, registry)` (mutates `blocks` array). `media.js` → `pickAndUpload(client, file)->Promise<path>` (validates, uploads to `assets/`, returns the path) and `attachImageField(inputEl, field, model, client)`.

This task is DOM-heavy and verified manually; the pure logic it relies on is already tested. Implement straightforwardly:
- `renderForm` walks `collection.fields` (single) or renders a list editor over `model[listKey]` (list), creating labeled inputs per field type: `string`→text input, `text`→textarea, `boolean`→checkbox, `select`→`<select>` from `options`, `object`→`<fieldset>` recursing, `list`→repeatable items (Add/Remove/Move-up/down) of sub-fields or a single `itemField`, `image`→text input + thumbnail + "Upload" button (calls `media.attachImageField`), `blocks`→delegates to `blocks-editor.renderBlocks`.
- All inputs write back into the bound `model` object on `input`/`change`.
- `blocks-editor.renderBlocks` shows existing blocks (each a `.list-item` with a type label, its registry fields as inputs, and Remove/Move controls), plus an "Add block" `<select>` of `blockTypesForScope(...)` → `newBlock(...)` appended.
- `media.pickAndUpload`: read file via `FileReader` as data URL → strip prefix to base64 → `validateImage({type:file.type,size:file.size})` (throw on error) → `client.putBinary('assets/'+sanitizeFilename(file.name), base64, existingSha||null, 'admin: upload '+name)` → return path.

- [ ] **Step 1: Implement `admin/blocks-editor.js`**
```js
import { blockTypesForScope, fieldsForBlock, newBlock } from './blocks-model.js';

export function renderBlocks(container, blocks, scope, registry) {
  container.innerHTML = '';
  const list = document.createElement('div');
  blocks.forEach((block, i) => list.appendChild(blockItem(blocks, i, scope, registry, () => renderBlocks(container, blocks, scope, registry))));
  container.appendChild(list);
  const add = document.createElement('select');
  add.innerHTML = `<option value="">+ Add block…</option>` +
    blockTypesForScope(registry, scope).map(t => `<option value="${t.type}">${t.label}</option>`).join('');
  add.addEventListener('change', () => { if (add.value) { blocks.push(newBlock(registry, add.value)); renderBlocks(container, blocks, scope, registry); } });
  container.appendChild(add);
}
function blockItem(blocks, i, scope, registry, rerender) {
  const block = blocks[i];
  const wrap = document.createElement('div'); wrap.className = 'list-item';
  const ctrls = document.createElement('div'); ctrls.className = 'row-controls';
  ctrls.innerHTML = `<strong>${block.type}</strong>`;
  const mk = (label, fn) => { const b=document.createElement('button'); b.type='button'; b.className='btn ghost'; b.textContent=label; b.onclick=()=>{fn();rerender();}; return b; };
  ctrls.append(
    mk('↑', () => { if (i>0) [blocks[i-1],blocks[i]]=[blocks[i],blocks[i-1]]; }),
    mk('↓', () => { if (i<blocks.length-1) [blocks[i+1],blocks[i]]=[blocks[i],blocks[i+1]]; }),
    mk('Remove', () => blocks.splice(i,1)) );
  wrap.appendChild(ctrls);
  for (const f of fieldsForBlock(registry, block.type)) {
    const field = document.createElement('div'); field.className='field';
    const lab = document.createElement('label'); lab.textContent = f.label || f.name; field.appendChild(lab);
    if (f.type === 'list') {
      const ta = document.createElement('textarea'); ta.value = (block[f.name]||[]).join('\n');
      ta.addEventListener('input', () => block[f.name] = ta.value.split('\n').filter(Boolean));
      field.appendChild(ta);
    } else if (f.type === 'code' || f.type === 'text') {
      const ta = document.createElement('textarea'); ta.value = block[f.name]||'';
      ta.addEventListener('input', () => block[f.name] = ta.value); field.appendChild(ta);
    } else {
      const inp = document.createElement('input'); inp.type='text'; inp.value = block[f.name]||'';
      inp.addEventListener('input', () => block[f.name] = inp.value); field.appendChild(inp);
    }
    wrap.appendChild(field);
  }
  return wrap;
}
```

- [ ] **Step 2: Implement `admin/media.js`**
```js
import { validateImage, sanitizeFilename } from './lib.js';

export function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject; r.readAsDataURL(file);
  });
}
export async function pickAndUpload(client, file) {
  const v = validateImage({ type: file.type, size: file.size });
  if (!v.ok) throw new Error(v.error);
  const base64 = await readFileBase64(file);
  const path = 'assets/' + sanitizeFilename(file.name);
  let sha = null; try { const ex = await client.getFile(path); sha = ex.sha; } catch (_) {}
  await client.putBinary(path, base64, sha, 'admin: upload ' + sanitizeFilename(file.name));
  return path;
}
export function attachImageField(inputEl, model, fieldName, client, thumbEl) {
  const picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'image/*'; picker.style.display='none';
  picker.addEventListener('change', async () => {
    if (!picker.files[0]) return;
    try { const path = await pickAndUpload(client, picker.files[0]); inputEl.value = path; model[fieldName] = path; if (thumbEl){ thumbEl.src = '../'+path; thumbEl.hidden=false; } }
    catch (e) { alert('Upload failed: ' + e.message); }
  });
  return picker;
}
```

- [ ] **Step 3: Implement `admin/forms.js`** (DOM renderer)
```js
function fieldEl(field, model, ctx) {
  const wrap = document.createElement('div'); wrap.className = 'field';
  const id = 'f_' + Math.random().toString(36).slice(2);
  if (field.type === 'object') {
    const fs = document.createElement('fieldset'); const lg = document.createElement('legend'); lg.textContent = field.label; fs.appendChild(lg);
    model[field.name] = model[field.name] || {};
    field.fields.forEach(sub => fs.appendChild(fieldEl(sub, model[field.name], ctx)));
    return fs;
  }
  if (field.type === 'list') { return listEl(field, model, ctx); }
  if (field.type === 'blocks') {
    const fs = document.createElement('fieldset'); const lg=document.createElement('legend'); lg.textContent=field.label; fs.appendChild(lg);
    const host = document.createElement('div'); fs.appendChild(host);
    model[field.name] = Array.isArray(model[field.name]) ? model[field.name] : [];
    ctx.renderBlocks(host, model[field.name], field.scope, ctx.registry);
    return fs;
  }
  const lab = document.createElement('label'); lab.textContent = field.label + (field.required?' *':''); lab.htmlFor = id; wrap.appendChild(lab);
  let input;
  if (field.type === 'text') { input = document.createElement('textarea'); }
  else if (field.type === 'boolean') { input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!model[field.name]; }
  else if (field.type === 'select') { input = document.createElement('select'); input.innerHTML = field.options.map(o=>`<option value="${o.value}">${o.label}</option>`).join(''); input.value = model[field.name] ?? ''; }
  else { input = document.createElement('input'); input.type = 'text'; }
  input.id = id;
  if (field.type !== 'boolean' && field.type !== 'select') input.value = model[field.name] ?? '';
  const evt = field.type === 'boolean' ? 'change' : 'input';
  input.addEventListener(evt, () => { model[field.name] = field.type==='boolean'? input.checked : input.value; });
  wrap.appendChild(input);
  if (field.type === 'image') {
    const thumb = document.createElement('img'); thumb.className='thumb'; thumb.hidden = !model[field.name]; if (model[field.name]) thumb.src = '../'+model[field.name];
    const btn = document.createElement('button'); btn.type='button'; btn.className='btn ghost'; btn.textContent='Upload image';
    const picker = ctx.attachImageField(input, model, field.name, ctx.client, thumb);
    btn.onclick = () => picker.click();
    wrap.append(btn, picker, thumb);
  }
  return wrap;
}
function listEl(field, model, ctx) {
  const fs = document.createElement('fieldset'); const lg=document.createElement('legend'); lg.textContent=field.label; fs.appendChild(lg);
  model[field.name] = Array.isArray(model[field.name]) ? model[field.name] : [];
  const host = document.createElement('div');
  const rerender = () => {
    host.innerHTML = '';
    model[field.name].forEach((item, i) => {
      const box = document.createElement('div'); box.className='list-item';
      const ctrls = document.createElement('div'); ctrls.className='row-controls';
      const mk=(t,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=t;b.onclick=()=>{fn();rerender();};return b;};
      ctrls.append(mk('↑',()=>{if(i>0)[model[field.name][i-1],model[field.name][i]]=[model[field.name][i],model[field.name][i-1]];}),
                   mk('↓',()=>{if(i<model[field.name].length-1)[model[field.name][i+1],model[field.name][i]]=[model[field.name][i],model[field.name][i+1]];}),
                   mk('Remove',()=>model[field.name].splice(i,1)));
      box.appendChild(ctrls);
      if (field.itemField) { // primitive list (tags)
        const inp=document.createElement('input'); inp.type='text'; inp.value=item??''; inp.addEventListener('input',()=>model[field.name][i]=inp.value); box.appendChild(inp);
      } else {
        field.fields.forEach(sub => box.appendChild(fieldEl(sub, item, ctx)));
      }
      host.appendChild(box);
    });
  };
  rerender();
  const add = document.createElement('button'); add.type='button'; add.className='btn'; add.textContent='+ Add';
  add.onclick = () => { model[field.name].push(field.itemField ? '' : {}); rerender(); };
  fs.append(host, add);
  return fs;
}
export function renderForm(container, collection, model, ctx) {
  container.innerHTML = '';
  if (collection.kind === 'single') collection.fields.forEach(f => container.appendChild(fieldEl(f, model, ctx)));
  else container.appendChild(listEl({ name: collection.listKey, label: collection.label, type:'list', fields: collection.itemFields }, model, ctx));
}
```

- [ ] **Step 4: Manual verification (deferred to Task 10)** — these modules are exercised once `app.js` wires them. Confirm `npm test` still passes (no test regressions; these are DOM modules).
Run: `npm test` → all pass.

- [ ] **Step 5: Commit**
```bash
git add admin/forms.js admin/blocks-editor.js admin/media.js
git commit -m "feat(admin): form renderer, block editor, and media upload (DOM)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: App wiring (`admin/app.js`)

**Files:**
- Create: `admin/app.js`

**Interfaces:**
- Consumes: everything above. Orchestrates: token check → login/app view; load `blocks-registry.json`; build sidebar from `COLLECTIONS`; on select, `getFile` → `buildFormModel` → `renderForm`; Save → validate → `modelToData` → `serializeJson` → `putFile(sha)` → update sha + status; conflict + permission error handling; sign out.

- [ ] **Step 1: Implement `admin/app.js`**
```js
import { COLLECTIONS, getCollection } from './schema.js';
import { buildFormModel, modelToData } from './forms-model.js';
import { validateModel } from './validate.js';
import { serializeJson } from './lib.js';
import { createClient } from './github.js';
import { getToken, signIn, signOut } from './auth.js';
import { renderForm } from './forms.js';
import { renderBlocks } from './blocks-editor.js';
import { attachImageField } from './media.js';

const $ = (id) => document.getElementById(id);
let client = null, registry = null, current = null, model = null, sha = null, dirty = false;

function showLogin() { $('login').hidden = false; $('app').hidden = true; }
function showApp() { $('login').hidden = true; $('app').hidden = false; }
function setStatus(msg, state) { const el=$('save-status'); el.textContent=msg||''; el.dataset.state = state||''; }

async function boot() {
  $('signin').onclick = async () => { try { await signIn(); location.reload(); } catch(e){ $('login-error').textContent = e.message; } };
  $('signout').onclick = () => { signOut(); location.reload(); };
  const token = getToken();
  if (!token) return showLogin();
  client = createClient({ token });
  try { registry = (await client.getFile('data/blocks-registry.json')).content; registry = JSON.parse(registry); }
  catch (e) { $('login-error').textContent = 'Failed to load registry: '+e.message; return showLogin(); }
  showApp();
  buildSidebar();
  selectCollection(COLLECTIONS[0].name);
}

function buildSidebar() {
  const nav = $('collections'); nav.innerHTML='';
  COLLECTIONS.forEach(c => { const b=document.createElement('button'); b.textContent=c.label; b.onclick=()=>{ if(guard()) selectCollection(c.name); }; b.dataset.name=c.name; nav.appendChild(b); });
}
function markActive(name) { $('collections').querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(b.dataset.name===name))); }
function guard() { if (dirty && !confirm('Discard unsaved changes?')) return false; dirty=false; return true; }

async function selectCollection(name) {
  current = getCollection(name); markActive(name); setStatus('Loading…');
  try {
    const file = await client.getFile(current.file);
    sha = file.sha;
    const data = file.content ? JSON.parse(file.content) : (current.kind==='list'? {[current.listKey]:[]} : {});
    model = buildFormModel(current, data);
    const ctx = { registry, client, renderBlocks, attachImageField };
    renderForm($('panel'), current, model, ctx);
    $('panel').addEventListener('input', () => { dirty=true; }, { once:true });
    setStatus('');
  } catch (e) { setStatus('Load failed: '+e.message, 'error'); }
}

$('save').onclick = async () => {
  if (!current) return;
  const errs = validateModel(current, model);
  if (errs.length) { setStatus(errs[0].path+': '+errs[0].message, 'error'); return; }
  setStatus('Saving…'); $('save').disabled = true;
  try {
    const out = serializeJson(modelToData(current, model));
    const res = await client.putFile(current.file, out, sha, 'admin: update '+current.name);
    sha = res.content.sha; dirty = false; setStatus('Published ✓', 'ok');
  } catch (e) {
    if (e.conflict) setStatus('Conflict: file changed on GitHub. Reload the section to get the latest before saving.', 'error');
    else if (e.forbidden) setStatus('This GitHub account has no write access to the repo.', 'error');
    else setStatus('Save failed: '+e.message, 'error');
  } finally { $('save').disabled = false; }
};

window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue=''; } });
boot();
```

- [ ] **Step 2: Manual verification (local, read path)**
Run: `python -m http.server 8000`, open `http://localhost:8000/admin/`.
- Without a token: login card shows.
- To test the authed path locally without the deployed OAuth, temporarily set a token in DevTools: `sessionStorage.gh_token='<a GitHub PAT with repo scope>'` then reload. Expected: app view, sidebar of 7 collections, selecting one loads its data into the form; editing fields updates; blocks add/remove; image upload commits to `assets/` and shows the path.
- **Save test (use a throwaway first):** edit `summary`, Save → expect "Published ✓" and a new commit on `main` (verify on GitHub). Then revert if it was a test edit.
- Conflict test: edit the same file on GitHub, then Save in admin → expect the conflict message.
Remove the temporary PAT from sessionStorage when done.

- [ ] **Step 3: Commit**
```bash
git add admin/app.js
git commit -m "feat(admin): app wiring — auth, collections, load/edit/save, conflicts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Remove Decap config + README note + final verification

**Files:**
- Remove: `admin/config.yml`
- Modify: `README.md`

- [ ] **Step 1: Confirm no references to Decap remain**
Run: `grep -rn "decap\|config.yml\|netlify-cms" admin/ index.html README.md || echo "clean"`
Expected: `clean` (new admin/index.html no longer loads Decap).

- [ ] **Step 2: Remove Decap config**
```bash
git rm admin/config.yml
```

- [ ] **Step 3: Add admin note to `README.md`** — append:
```markdown
## Admin (content manager)

A custom, no-build admin lives at `/admin/`. Sign in with GitHub (you must have write access to this repo); it reads and writes `data/*.json` and uploads images to `assets/` via the GitHub Contents API, committing directly to `main` (which redeploys the site). The OAuth token is held in `sessionStorage` for the session only. Block editing is generated from `data/blocks-registry.json`.
```

- [ ] **Step 4: Full verification**
Run: `npm test` → all pass (site + admin pure-logic suites).
Run: `node -e "JSON.parse(require('fs').readFileSync('data/blocks-registry.json','utf8')); console.log('registry ok')"`.
Manual: load `/admin/`, confirm login + (with token) load/edit/save/upload/conflict per Task 10; confirm `/admin/` is `noindex`; confirm the public site is unaffected.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "chore(admin): remove Decap config; document custom admin in README

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (against spec)

**Spec coverage:**
- §3 architecture / file list → Tasks 1–11 create every listed file. ✓
- §4 auth (popup, sessionStorage, origin check, callback format) → Task 7 (+ auth.js origin check, callback message). ✓
- §5 GitHub flow (getFile/putFile/putBinary, sha, 409 conflict, JSON style) → Tasks 6, 10; `serializeJson` (Task 1). ✓
- §6 schema-driven forms (all 7 collections + cluster/tags/graph; block sub-forms from registry) → Tasks 2, 3, 5, 9. ✓
- §7 images (validate, base64, upload, picker) → Tasks 1 (validate), 9 (media). ✓
- §8 UX (login/app, sidebar, per-collection save states, unsaved guard, theming) → Tasks 8, 10. ✓
- §9 testing (pure units; manual flows; lean budget) → unit tests Tasks 1–6; manual Tasks 7–11. ✓
- §10 risks (token storage, conflict, registry drift, image cap, callback) → addressed in Tasks 1,6,7,9,10. ✓
- §11 deliverables (admin app, callback, removed Decap, tests, README) → Tasks 7,11. ✓

**Placeholder scan:** No TBD/"handle errors" placeholders; DOM tasks carry real code + explicit manual steps (the agreed hybrid methodology). No silent gaps.

**Type consistency:** `getFile`→`{content,sha}`, `putFile(path,contentString,sha,message)`, `putBinary(path,base64,sha,message)` consistent across Tasks 6/9/10; `buildFormModel`/`modelToData(collection, …)` consistent Tasks 3/10; `renderForm(container,collection,model,ctx)` with `ctx={registry,client,renderBlocks,attachImageField}` consistent Tasks 9/10; `blockTypesForScope/fieldsForBlock/newBlock(registry,…)` consistent Tasks 5/9; `validateModel(collection,model)` consistent Tasks 4/10. ✓
