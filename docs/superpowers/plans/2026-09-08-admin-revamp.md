# Admin Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin at `admin/` able to create and edit every shape the site
can render, organised around the timeline rather than the JSON files, wearing the
site's own design, with a live preview — and make sign-in work again.

**Architecture:** The admin keeps its schema-driven, one-collection-one-commit
shape. Three structural changes: it loads the site's own `tokens.css` and
`base.css` so it cannot drift from the design again; one field vocabulary and one
field renderer replace two divergent copies; and navigation is built from
`buildTimeline()`'s output rather than from the file list, with each composed
entry carrying `source: { collection, id }` so the admin can resolve it back to a
record without reimplementing composition.

**Tech Stack:** Vanilla ES modules, no build step, no dependencies. Node's
built-in test runner. GitHub Contents API. Canvas API for image processing.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-revamp-design.md`

## Global Constraints

- No build step, no bundler, no runtime dependencies. ES modules loaded directly.
- `admin/admin.css` declares **no colour, no font family, and no font size** of
  its own. Every such value is `var(--token)`.
- Admin tests run in Node with **no DOM**. Any logic that must be tested lives in
  a pure function; DOM construction stays a thin uncovered layer.
- The site's CSS+JS budget: **36 KB gzipped, 100 KB uncompressed**, measured over
  `css/` and `js/` only, enforced by `test/budget.test.js`. `admin/` is excluded.
- Content is data: copy lives in `data/*.json`. Structural interface labels
  ("Add entry", "Save") live in code.
- WCAG AA. The admin inherits the site's focus rings, `prefers-contrast` and
  `prefers-reduced-motion` handling by loading its stylesheets.
- Every record in `data/*.json` has a unique `id`, including roles nested inside
  companies. The plan relies on this; Task 2 asserts it.
- Never commit a photograph original. Derivatives only, to
  `assets/photos/derived/`.
- Commit after every task. Run `npm test` before each commit.

---

## File Structure

| File | Responsibility |
|---|---|
| `admin/fields.js` | **new.** Pure read/write of a field's value, plus a thin DOM renderer built on it. The single field vocabulary. |
| `admin/forms.js` | Collection form. Loses its private field rendering, gains `fields.js`. |
| `admin/blocks-editor.js` | Block list. Loses its private field rendering, gains `fields.js`. |
| `admin/schema.js` | Collection declarations. Gains milestones, metrics, and `TIMELINE_KINDS`. |
| `admin/nav.js` | **new.** Builds the section list and the composed path list. |
| `admin/timeline-edit.js` | **new.** Resolves a timeline entry to its record; creates a new record for a chosen kind. |
| `admin/preview.js` | **new.** The iframe, the data merge, the debounced re-render. |
| `admin/photos.js` | **new.** EXIF orientation, resize, encode, commit, dimensions. |
| `admin/media.js` | Shrinks to the SVG and non-photo upload path. |
| `admin/validate.js` | Gains list-of-scalars validation. |
| `admin/auth.js` | Distinguishes a discarded message from a closed popup. |
| `admin/admin.css` | Layout only. |
| `js/timeline.js` | Gains `source` on every composed entry. |
| `data/blocks-registry.json` | Field declarations migrate to the shared vocabulary. |
| `api/callback.js`, `vercel.json` | Origin literals. |

---

### Task 1: Sign-in works, and fails loudly

**Files:**
- Modify: `api/callback.js` (the `postMessage` target, line 56)
- Modify: `vercel.json` (both `Access-Control-Allow-Origin` values)
- Modify: `admin/auth.js`
- Test: `test/admin-auth.test.js` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `classifyAuthMessage(event, expectedOrigin)` from `admin/auth.js`,
  returning `{ ok: true, token }` or `{ ok: false, reason, detail }` where
  `reason` is one of `'wrong-origin' | 'not-oauth' | 'no-token'`.

- [ ] **Step 1: Write the failing test**

```js
// test/admin-auth.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAuthMessage } from '../admin/auth.js';

const ORIGIN = 'https://7mxd-oauth.vercel.app';
const good = { type: 'oauth:success', token: 'abc', provider: 'github' };

test('a message from the OAuth origin with a token succeeds', () => {
  assert.deepEqual(
    classifyAuthMessage({ origin: ORIGIN, data: good }, ORIGIN),
    { ok: true, token: 'abc' },
  );
});

test('a message from another origin is named, not ignored', () => {
  // The whole outage: the callback posted to https://7mxd.github.io while the
  // admin ran on www.7mxd.me, and this path silently returned.
  const r = classifyAuthMessage({ origin: 'https://evil.example', data: good }, ORIGIN);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'wrong-origin');
  assert.equal(r.detail, 'https://evil.example');
});

test('a message that is not an oauth success is reported', () => {
  const r = classifyAuthMessage({ origin: ORIGIN, data: { type: 'other' } }, ORIGIN);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-oauth');
});

test('an oauth success with no token is reported', () => {
  const r = classifyAuthMessage(
    { origin: ORIGIN, data: { type: 'oauth:success', provider: 'github' } }, ORIGIN);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-token');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `classifyAuthMessage` is not exported from `admin/auth.js`.

- [ ] **Step 3: Implement**

In `admin/auth.js`, add above `signIn`:

```js
/** Why a message did or did not complete sign-in.
 *
 *  Pulled out as a pure function because the failure it exists to surface —
 *  a message from an origin we are not listening to — is exactly the one the
 *  old code returned silently from, and a silent branch cannot be tested. */
export function classifyAuthMessage(event, expectedOrigin) {
  if (event.origin !== expectedOrigin) {
    return { ok: false, reason: 'wrong-origin', detail: event.origin };
  }
  const d = event.data;
  if (!d || d.type !== 'oauth:success' || d.provider !== 'github') {
    return { ok: false, reason: 'not-oauth', detail: d && d.type };
  }
  if (!d.token) return { ok: false, reason: 'no-token', detail: null };
  return { ok: true, token: d.token };
}

const MESSAGES = {
  'wrong-origin': (o) => `Sign-in replied from ${o}, which this page does not trust. `
    + 'The OAuth callback and the site must be on the same origin.',
  'not-oauth': () => 'Sign-in returned an unexpected message.',
  'no-token': () => 'Sign-in succeeded but returned no token.',
};
```

Replace the body of `onMessage` with:

```js
    function onMessage(e) {
      const r = classifyAuthMessage(e, OAUTH_BASE);
      if (!r.ok) {
        // A message from a wrong origin used to return silently here, which is
        // why a broken deploy looked identical to the user closing the popup.
        if (r.reason !== 'wrong-origin') return;
        clearInterval(poll);
        window.removeEventListener('message', onMessage);
        popup.close();
        reject(new Error(MESSAGES[r.reason](r.detail)));
        return;
      }
      clearInterval(poll);
      window.removeEventListener('message', onMessage);
      setToken(r.token);
      resolve(r.token);
    }
```

- [ ] **Step 4: Change the two origin literals**

In `api/callback.js`, line 56:

```js
    if (window.opener) window.opener.postMessage(data, "https://www.7mxd.me");
```

In `vercel.json`, both occurrences:

```json
{ "key": "Access-Control-Allow-Origin", "value": "https://www.7mxd.me" }
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS, count increases by 4.

- [ ] **Step 6: Commit**

```bash
git add api/callback.js vercel.json admin/auth.js test/admin-auth.test.js
git commit -m "fix(admin): point OAuth at www.7mxd.me, and name the failure when it does not land"
```

**Note for the executor:** sign-in cannot be verified end to end until Ahmed
redeploys Vercel. Do not block on it; the rest of the plan does not depend on a
working login.

---

### Task 2: Timeline entries carry where they came from

**Files:**
- Modify: `js/timeline.js`
- Test: `test/timeline.test.js`

**Interfaces:**
- Produces: every entry from `buildTimeline()` carries
  `source: { collection: 'experience'|'education'|'projects'|'milestones', id: string }`.

- [ ] **Step 1: Write the failing test**

Append to `test/timeline.test.js`:

```js
test('every composed entry says which file and record it came from', () => {
  // The admin resolves a timeline row back to the record behind it. Without
  // this it would have to reimplement composition, which is the drift the
  // shared-code rule exists to prevent.
  const groups = buildTimeline(REAL);
  const entries = groups.flatMap((g) => g.entries);
  assert.ok(entries.length > 0);
  const collections = new Set(['experience', 'education', 'projects', 'milestones']);
  for (const e of entries) {
    assert.ok(e.source, `${e.id} has no source`);
    assert.ok(collections.has(e.source.collection), `${e.id}: ${e.source.collection}`);
    assert.equal(e.source.id, e.id, `${e.id}: source.id must address the record`);
  }
});

test('no two records share an id, so source.id addresses exactly one', () => {
  const groups = buildTimeline(REAL);
  const ids = groups.flatMap((g) => g.entries).map((e) => e.source.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id across the timeline');
});
```

`REAL` is the real data. If `test/timeline.test.js` does not already load it, add
at the top of the file:

```js
import { readFileSync } from 'node:fs';
const load = (n) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), 'utf8'));
const REAL = {
  experience: load('experience'), education: load('education'),
  projects: load('projects'), milestones: load('milestones'),
};
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `undefined has no source`.

- [ ] **Step 3: Implement**

In `js/timeline.js`, add `source` to the `entry()` shape:

```js
    workRefTitle: null,
    /** Which file and record this row was composed from. The admin needs it to
     *  open the right form; the site ignores it. */
    source: fields.source ?? null,
    note: fields.note ?? '',
```

Then set it in each `from*` function, alongside the existing `id`:

- `fromExperience`: `source: { collection: 'experience', id: role.id },`
- `fromEducation`: `source: { collection: 'education', id: item.id },`
- `fromProjects`: `source: { collection: 'projects', id: item.id },`
- `fromMilestones`: `source: { collection: 'milestones', id: item.id },`

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Check the budget did not break**

Run:

```bash
python -c "import os,gzip; raw=g=0
for d in ('css','js'):
    for f in os.listdir(d):
        if f.endswith(('.css','.js')):
            b=open(os.path.join(d,f),'rb').read(); raw+=len(b); g+=len(gzip.compress(b,9))
print(f'wire {g/1024:.2f} of 36  parse {raw/1024:.2f} of 100')"
```

Expected: wire under 36. It was 34.2 before this change. If it exceeds 36, do not
proceed — report it, because the fix is to trim a comment elsewhere and that is a
decision, not a mechanical step.

- [ ] **Step 6: Commit**

```bash
git add js/timeline.js test/timeline.test.js
git commit -m "feat(timeline): each composed entry records the file and record behind it"
```

---

### Task 3: One field vocabulary in the block registry

**Files:**
- Modify: `data/blocks-registry.json`
- Test: `test/admin-schema.test.js`

**Interfaces:**
- Produces: every `select` in the registry declares `options: [{label, value}]`;
  every `list` declares either `itemField` (scalars) or `fields` (records).

- [ ] **Step 1: Write the failing test**

Append to `test/admin-schema.test.js`:

```js
import { readFileSync } from 'node:fs';
const REGISTRY = JSON.parse(
  readFileSync(new URL('../data/blocks-registry.json', import.meta.url), 'utf8'));

function registryFields() {
  return Object.entries(REGISTRY)
    .filter(([k]) => !k.startsWith('_'))
    .flatMap(([type, v]) => (v.fields || []).map((f) => ({ type, f })));
}

test('every registry select declares {label, value} options', () => {
  // The callout tone dropdown rendered empty because the registry wrote plain
  // strings while admin/schema.js wrote objects, and one renderer read .value
  // off both.
  for (const { type, f } of registryFields()) {
    if (f.type !== 'select') continue;
    assert.ok(Array.isArray(f.options), `${type}.${f.name} has no options`);
    for (const o of f.options) {
      assert.equal(typeof o, 'object', `${type}.${f.name} option is not an object`);
      assert.ok(o.label && o.value, `${type}.${f.name} option missing label or value`);
    }
  }
});

test('every registry list says whether it holds scalars or records', () => {
  // benchmark.rows are records and coursework.items are strings, and both said
  // only "list". One renderer assumed strings and destroyed the records.
  for (const { type, f } of registryFields()) {
    if (f.type !== 'list') continue;
    const scalars = Boolean(f.itemField);
    const records = Array.isArray(f.fields);
    assert.ok(scalars !== records,
      `${type}.${f.name} must declare exactly one of itemField or fields`);
  }
});

test('benchmark rows declare the record the site actually renders', () => {
  const rows = REGISTRY.benchmark.fields.find((f) => f.name === 'rows');
  const names = rows.fields.map((f) => f.name).sort();
  assert.deepEqual(names, ['highlight', 'label', 'value']);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `callout.tone option is not an object`.

- [ ] **Step 3: Migrate the registry**

In `data/blocks-registry.json`:

`callout` → `tone`:

```json
{ "name": "tone", "type": "select", "label": "Tone", "required": true,
  "options": [
    { "label": "Note", "value": "note" },
    { "label": "Tip", "value": "tip" },
    { "label": "Warning", "value": "warning" } ] }
```

`benchmark` → `rows`:

```json
{ "name": "rows", "type": "list", "label": "Rows", "required": true,
  "fields": [
    { "name": "label", "type": "string", "label": "Label", "required": true },
    { "name": "value", "type": "string", "label": "Value", "required": true },
    { "name": "highlight", "type": "boolean", "label": "This is my result" } ] }
```

`coursework` → `items`:

```json
{ "name": "items", "type": "list", "label": "Courses", "required": true,
  "itemField": { "name": "item", "type": "string", "label": "Course" } }
```

- [ ] **Step 4: Verify the site is unaffected**

Run: `npm test`
Expected: PASS, including `render.test.js`. `js/data.js` validates only that the
registry is an object and `js/blocks.js` dispatches on a block's `type`, so
declaration changes cannot reach the page — this step proves it rather than
assuming it.

- [ ] **Step 5: Commit**

```bash
git add data/blocks-registry.json test/admin-schema.test.js
git commit -m "fix(registry): one field vocabulary, so a list says what it holds"
```

---

### Task 4: One field renderer, with the value logic pure

**Files:**
- Create: `admin/fields.js`
- Test: `test/admin-fields.test.js` (create)

**Interfaces:**
- Produces, from `admin/fields.js`:
  - `readField(field, record)` → the value a control should display.
  - `writeField(field, record, raw)` → mutates `record`, returns the written value.
  - `blankValue(field)` → the empty value for a newly added field or list item.
  - `moveItem(list, from, to)` → reorders in place, returns the list.
  - `renderField(doc, field, record, ctx)` → an `HTMLElement`. Thin; uses the above.

- [ ] **Step 1: Write the failing test**

```js
// test/admin-fields.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readField, writeField, blankValue, moveItem } from '../admin/fields.js';

test('a number field writes a Number, never the input string', () => {
  // Image width and height become HTML attributes the browser reserves space
  // with; a string there ships width="0" and reintroduces layout shift.
  const rec = {};
  writeField({ name: 'width', type: 'number' }, rec, '1600');
  assert.strictEqual(rec.width, 1600);
  writeField({ name: 'width', type: 'number' }, rec, '');
  assert.strictEqual(rec.width, '');
});

test('a boolean field writes a Boolean', () => {
  const rec = {};
  writeField({ name: 'primary', type: 'boolean' }, rec, true);
  assert.strictEqual(rec.primary, true);
});

test('a list of scalars round-trips through text', () => {
  const field = { name: 'items', type: 'list', itemField: { name: 'item', type: 'string' } };
  const rec = { items: ['Topology', 'Optimization'] };
  assert.deepEqual(readField(field, rec), ['Topology', 'Optimization']);
  writeField(field, rec, ['Topology', 'Optimization', 'Real Analysis']);
  assert.deepEqual(rec.items, ['Topology', 'Optimization', 'Real Analysis']);
});

test('a list of records survives a read and a write unchanged', () => {
  // THE regression guard. The old editor rendered any list as
  // rows.join('\n') and wrote back value.split('\n'), which replaced the
  // benchmark table with three literal "[object Object]" strings.
  const field = {
    name: 'rows', type: 'list',
    fields: [
      { name: 'label', type: 'string' },
      { name: 'value', type: 'string' },
      { name: 'highlight', type: 'boolean' },
    ],
  };
  const rows = [
    { label: 'Competition winner, 1993', value: '0.028' },
    { label: 'This work, iterative KRLS', value: '0.043', highlight: true },
  ];
  const rec = { rows };
  assert.deepEqual(readField(field, rec), rows);
  writeField(field, rec, readField(field, rec));
  assert.deepEqual(rec.rows, rows);
  assert.equal(JSON.stringify(rec.rows).includes('[object Object]'), false);
});

test('blankValue matches the shape the field declares', () => {
  assert.deepEqual(blankValue({ type: 'list', fields: [{ name: 'a', type: 'string' }] }), []);
  assert.deepEqual(blankValue({ type: 'list', itemField: { type: 'string' } }), []);
  assert.deepEqual(blankValue({ type: 'object', fields: [{ name: 'url', type: 'string' }] }), { url: '' });
  assert.strictEqual(blankValue({ type: 'boolean' }), false);
  assert.strictEqual(blankValue({ type: 'number' }), '');
  assert.strictEqual(blankValue({ type: 'string' }), '');
});

test('a new record in a list of records has every declared key', () => {
  const field = { type: 'list', fields: [
    { name: 'label', type: 'string' }, { name: 'highlight', type: 'boolean' } ] };
  assert.deepEqual(blankValue(field.fields ? { type: 'object', fields: field.fields } : {}),
    { label: '', highlight: false });
});

test('moveItem reorders and clamps', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 3), ['a', 'b', 'c']);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — cannot find `../admin/fields.js`.

- [ ] **Step 3: Implement the pure half**

```js
// admin/fields.js
/** The one field vocabulary, shared by the collection form and the block editor.
 *
 *  The value logic is pure and the DOM layer is thin, deliberately: admin tests
 *  run in Node with no DOM, and the defect this file exists to kill — a list of
 *  records flattened to "[object Object]" — lives entirely in the value logic.
 *  A bug that cannot be tested is a bug that comes back.
 */

/** The empty value for a field, matching the shape it declares. */
export function blankValue(field) {
  switch (field.type) {
    case 'list': return [];
    case 'object': {
      const out = {};
      for (const f of field.fields || []) out[f.name] = blankValue(f);
      return out;
    }
    case 'boolean': return false;
    case 'blocks': return [];
    default: return '';
  }
}

/** What a control should display for this field. Never stringifies a record. */
export function readField(field, record) {
  const v = record ? record[field.name] : undefined;
  if (field.type === 'list') return Array.isArray(v) ? v : [];
  if (field.type === 'object') return v && typeof v === 'object' ? v : blankValue(field);
  if (field.type === 'boolean') return Boolean(v);
  return v ?? '';
}

/** Write a value back, coerced to the type the field declares. */
export function writeField(field, record, raw) {
  let value = raw;
  if (field.type === 'number') value = raw === '' || raw == null ? '' : Number(raw);
  else if (field.type === 'boolean') value = Boolean(raw);
  else if (field.type === 'list') value = Array.isArray(raw) ? raw : [];
  record[field.name] = value;
  return value;
}

/** Reorder in place. Out-of-range targets are a no-op rather than an error:
 *  the up control on the first row and the down control on the last one are
 *  ordinary clicks, not mistakes. */
export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length || from < 0 || from >= list.length) return list;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return list;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Implement the DOM layer**

Append to `admin/fields.js`:

```js
const el = (doc, tag, props = {}) => Object.assign(doc.createElement(tag), props);
const bump = (node) => node.dispatchEvent(new Event('input', { bubbles: true }));

/** A labelled control for one field. `ctx` carries { doc, client, registry,
 *  renderBlocks, uploadImage } — everything a field might need and nothing it
 *  builds itself. */
export function renderField(doc, field, record, ctx) {
  const wrap = el(doc, 'div', { className: 'field' });
  if (field.type !== 'boolean') {
    wrap.appendChild(el(doc, 'label', { textContent: field.label || field.name }));
  }
  wrap.appendChild(controlFor(doc, field, record, ctx));
  wrap.dataset.path = field.name;
  return wrap;
}

function controlFor(doc, field, record, ctx) {
  switch (field.type) {
    case 'text': case 'code': {
      const ta = el(doc, 'textarea', { value: readField(field, record) });
      ta.addEventListener('input', () => writeField(field, record, ta.value));
      return ta;
    }
    case 'boolean': {
      const label = el(doc, 'label', { className: 'check' });
      const box = el(doc, 'input', { type: 'checkbox', checked: readField(field, record) });
      box.addEventListener('change', () => { writeField(field, record, box.checked); bump(box); });
      label.append(box, doc.createTextNode(' ' + (field.label || field.name)));
      return label;
    }
    case 'number': {
      const inp = el(doc, 'input', { type: 'number', value: readField(field, record) });
      inp.addEventListener('input', () => writeField(field, record, inp.value));
      return inp;
    }
    case 'select': {
      const sel = el(doc, 'select');
      for (const o of field.options || []) {
        sel.appendChild(el(doc, 'option', { value: o.value, textContent: o.label }));
      }
      sel.value = readField(field, record);
      sel.addEventListener('change', () => { writeField(field, record, sel.value); bump(sel); });
      return sel;
    }
    case 'image': return imageControl(doc, field, record, ctx);
    case 'object': {
      const set = el(doc, 'fieldset');
      set.appendChild(el(doc, 'legend', { textContent: field.label || field.name }));
      const value = readField(field, record);
      record[field.name] = value;
      for (const f of field.fields || []) set.appendChild(renderField(doc, f, value, ctx));
      return set;
    }
    case 'list': return listControl(doc, field, record, ctx);
    case 'blocks': {
      const host = el(doc, 'div');
      record[field.name] = readField(field, record);
      ctx.renderBlocks(host, record[field.name], field.scope, ctx.registry, ctx);
      return host;
    }
    default: {
      const inp = el(doc, 'input', { type: 'text', value: readField(field, record) });
      inp.addEventListener('input', () => writeField(field, record, inp.value));
      return inp;
    }
  }
}

/** Add, remove and reorder at every level, for scalars and records alike.
 *  Order is content here: it decides which photograph leads a gallery and takes
 *  the wide slot, and which skills come first in their row. */
function listControl(doc, field, record, ctx) {
  const host = el(doc, 'div', { className: 'list' });
  const items = readField(field, record);
  record[field.name] = items;

  const draw = () => {
    host.innerHTML = '';
    items.forEach((item, i) => {
      const row = el(doc, 'div', { className: 'list-item' });
      const ctrls = el(doc, 'div', { className: 'row-controls' });
      const btn = (text, label, fn) => {
        const b = el(doc, 'button', { type: 'button', className: 'btn ghost', textContent: text });
        b.setAttribute('aria-label', `${label} ${field.label || field.name} ${i + 1}`);
        b.addEventListener('click', () => { fn(); draw(); bump(host); });
        return b;
      };
      ctrls.append(
        btn('↑', 'Move up', () => moveItem(items, i, i - 1)),
        btn('↓', 'Move down', () => moveItem(items, i, i + 1)),
        btn('Remove', 'Remove', () => items.splice(i, 1)));
      row.appendChild(ctrls);

      if (field.itemField) {
        const holder = { value: item };
        row.appendChild(renderField(doc, { ...field.itemField, name: 'value', label: '' }, holder, ctx));
        holder.onChange = null;
        row.addEventListener('input', () => { items[i] = holder.value; }, true);
      } else {
        for (const f of field.fields || []) row.appendChild(renderField(doc, f, item, ctx));
      }
      host.appendChild(row);
    });

    const add = el(doc, 'button', { type: 'button', className: 'btn', textContent: 'Add' });
    add.addEventListener('click', () => {
      items.push(field.itemField
        ? blankValue(field.itemField)
        : blankValue({ type: 'object', fields: field.fields || [] }));
      draw(); bump(host);
    });
    host.appendChild(add);
  };
  draw();
  return host;
}

function imageControl(doc, field, record, ctx) {
  const host = el(doc, 'div');
  const inp = el(doc, 'input', { type: 'text', value: readField(field, record) });
  inp.addEventListener('input', () => writeField(field, record, inp.value));
  const thumb = el(doc, 'img', { className: 'thumb' });
  thumb.hidden = !record[field.name];
  if (record[field.name]) thumb.src = '../' + record[field.name];
  const picker = el(doc, 'input', { type: 'file', accept: 'image/*' });
  picker.hidden = true;
  const btn = el(doc, 'button', { type: 'button', className: 'btn ghost', textContent: 'Upload image' });
  btn.addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    if (!picker.files[0] || !ctx.uploadImage) return;
    try {
      await ctx.uploadImage(picker.files[0], record, field);
      inp.value = record[field.name] || '';
      if (record[field.name]) { thumb.src = '../' + record[field.name]; thumb.hidden = false; }
      bump(host);
    } catch (e) { ctx.onError?.(e); }
  });
  host.append(inp, btn, picker, thumb);
  return host;
}
```

- [ ] **Step 6: Run the tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add admin/fields.js test/admin-fields.test.js
git commit -m "feat(admin): one field renderer, with the value logic pure and tested"
```

---

### Task 5: The form and the block editor use it

**Files:**
- Modify: `admin/forms.js`
- Modify: `admin/blocks-editor.js`
- Modify: `admin/app.js` (the `ctx` it builds)
- Test: `test/admin-fields.test.js` (extend)

**Interfaces:**
- Consumes: `renderField`, `blankValue`, `moveItem` from Task 4.
- Produces: `renderForm(container, collection, model, ctx)` unchanged in
  signature; `renderBlocks(container, blocks, scope, registry, ctx)` unchanged in
  signature.

- [ ] **Step 1: Write the failing test**

Append to `test/admin-fields.test.js`:

```js
import { fieldsForBlock, newBlock } from '../admin/blocks-model.js';
import { readFileSync } from 'node:fs';
const REGISTRY = JSON.parse(
  readFileSync(new URL('../data/blocks-registry.json', import.meta.url), 'utf8'));

test('a new benchmark block starts with the shape its rows declare', () => {
  const block = newBlock(REGISTRY, 'benchmark');
  assert.deepEqual(block.rows, []);
  const rows = fieldsForBlock(REGISTRY, 'benchmark').find((f) => f.name === 'rows');
  assert.deepEqual(blankValue({ type: 'object', fields: rows.fields }),
    { label: '', value: '', highlight: false });
});

test('every field type in the registry is one the renderer implements', () => {
  const IMPLEMENTED = new Set(['string', 'text', 'code', 'url', 'number',
    'boolean', 'select', 'image', 'object', 'list', 'blocks']);
  for (const [type, entry] of Object.entries(REGISTRY)) {
    if (type.startsWith('_')) continue;
    for (const f of entry.fields || []) {
      assert.ok(IMPLEMENTED.has(f.type), `${type}.${f.name} is type ${f.type}`);
    }
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `newBlock` gives `rows: ''` because `blocks-model.js` only
special-cases `list` by the old rule.

- [ ] **Step 3: Fix `newBlock` to use the shared blank**

In `admin/blocks-model.js`:

```js
import { blankValue } from './fields.js';

export function newBlock(registry, type) {
  const block = { type };
  for (const f of fieldsForBlock(registry, type)) block[f.name] = blankValue(f);
  return block;
}
```

- [ ] **Step 4: Rewrite `blocks-editor.js` to delegate**

Replace the whole per-field `if/else` chain in `blockItem` with:

```js
  for (const f of fieldsForBlock(registry, block.type)) {
    wrap.appendChild(renderField(document, f, block, ctx));
  }
```

and add at the top:

```js
import { renderField, moveItem } from './fields.js';
```

Replace the two swap expressions in the up/down controls with `moveItem`:

```js
    mk('↑', () => moveItem(blocks, i, i - 1)),
    mk('↓', () => moveItem(blocks, i, i + 1)),
```

- [ ] **Step 5: Rewrite `forms.js` to delegate**

`forms.js` keeps only: the collection shape (single vs list), the per-item
add/remove/reorder controls for `collection.itemFields`, and the call to
`renderField` per field. Delete its private field switch, its `itemField`
handling and its image upload copy — `fields.js` owns all three now.

- [ ] **Step 6: Build the shared ctx in `app.js`**

```js
    const ctx = {
      registry, client, renderBlocks,
      uploadImage: (file, record, field) => attachPhoto(file, record, field, client),
      onError: (e) => setStatus('Upload failed: ' + e.message, 'error'),
    };
```

`attachPhoto` arrives in Task 10. Until then, import the existing
`pickAndUpload` and set `record[field.name]` from it, so the app stays runnable
between tasks.

- [ ] **Step 7: Run the tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add admin/forms.js admin/blocks-editor.js admin/blocks-model.js admin/app.js test/admin-fields.test.js
git commit -m "refactor(admin): one renderer serves the form and the block editor"
```

---

### Task 6: Milestones and metrics become editable

**Files:**
- Modify: `admin/schema.js`
- Test: `test/admin-roundtrip.test.js` (no change needed; it iterates COLLECTIONS)

**Interfaces:**
- Produces: `COLLECTIONS` gains `milestones` and `metrics`;
  `UNMANAGED_DATA_FILES` keeps only `blocks-registry.json`.

- [ ] **Step 1: Write the failing test**

Append to `test/admin-schema.test.js`:

```js
test('every data file is managed except the registry, which is schema', () => {
  const files = readdirSync(new URL('../data/', import.meta.url))
    .filter((f) => f.endsWith('.json'));
  const managed = new Set(COLLECTIONS.map((c) => c.file.replace('data/', '')));
  const unmanaged = files.filter((f) => !managed.has(f));
  assert.deepEqual(unmanaged.sort(), ['blocks-registry.json'],
    'a content file nobody can edit is the defect this revamp exists to remove');
});
```

Add `readdirSync` to the `node:fs` import.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `['blocks-registry.json','metrics.json','milestones.json']`.

- [ ] **Step 3: Declare the two collections**

In `admin/schema.js`, after the `skills` collection:

```js
  { name:'milestones', file:'data/milestones.json', label:'Milestones', kind:'list', listKey:'items', itemFields:[
    { name:'id', label:'Id (timeline key)', type:'string', required:true },
    { name:'kind', label:'Kind', type:'select', options:[
      {label:'Certification', value:'certification'},
      {label:'Award', value:'award'},
      {label:'Volunteering', value:'volunteering'} ] },
    { name:'date', label:'Date (YYYY-MM)', type:'string', required:true },
    { name:'title', label:'Title', type:'string', required:true },
    { name:'org', label:'Organisation', type:'string' },
    { name:'note', label:'Note', type:'text' },
    orderField,
    { name:'link', label:'Verification link', type:'object', fields:[
      { name:'url', label:'URL', type:'string' },
      { name:'label', label:'Label', type:'string' } ] },
    imagesField ] },

  { name:'metrics', file:'data/metrics.json', label:'Numbers', kind:'list', listKey:'items', itemFields:[
    { name:'value', label:'Value', type:'string', required:true },
    { name:'label', label:'What it counts', type:'string', required:true } ] },
```

And shrink the unmanaged list:

```js
export const UNMANAGED_DATA_FILES = ['blocks-registry.json'];
```

Update the comment above it: it currently says milestones and metrics are the
first item of the admin revamp. They are now managed; the registry stays out
because it is the schema, not content.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS. `admin-roundtrip.test.js` now covers both new collections and
will fail if any declared field is missing — that is the point.

- [ ] **Step 5: Commit**

```bash
git add admin/schema.js test/admin-schema.test.js
git commit -m "feat(admin): milestones and metrics become editable"
```

---

### Task 7: The completeness rule, as a test

**Files:**
- Test: `test/admin-completeness.test.js` (create)

**Interfaces:**
- Consumes: `COLLECTIONS` from `admin/schema.js`, the registry, the real data.

- [ ] **Step 1: Write the test**

```js
// test/admin-completeness.test.js
//
// Ahmed's requirement was "all items should be editable through the admin
// page". This is that sentence as a test: it walks the real content files and
// fails if anything in them has no declared editor. It is the difference
// between "everything is touchable" being true by construction and being true
// because somebody checked once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLLECTIONS } from '../admin/schema.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const REGISTRY = load('data/blocks-registry.json');

/** Every key path present in a record, as dotted names. Array indices collapse
 *  to `[]` because the schema declares one field for a whole list. */
function keyPaths(value, prefix = '') {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((v) => keyPaths(v, prefix)))];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      [prefix ? `${prefix}.${k}` : k, ...keyPaths(v, prefix ? `${prefix}.${k}` : k)]);
  }
  return [];
}

/** Every key path the schema declares, in the same notation. */
function declaredPaths(fields, prefix = '') {
  return fields.flatMap((f) => {
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    if (f.type === 'object') return [path, ...declaredPaths(f.fields || [], path)];
    if (f.type === 'list' && Array.isArray(f.fields)) return [path, ...declaredPaths(f.fields, path)];
    if (f.type === 'blocks') return [path];
    return [path];
  });
}

for (const collection of COLLECTIONS) {
  test(`${collection.name}: every key in the file has a declared editor`, () => {
    const data = load(collection.file);
    const records = collection.kind === 'list' ? (data[collection.listKey] || []) : [data];
    const fields = collection.kind === 'list' ? collection.itemFields : collection.fields;
    const declared = new Set(declaredPaths(fields));

    const present = [...new Set(records.flatMap((r) => keyPaths(r)))];
    // `blocks` contents are declared by the registry, not the schema.
    const missing = present.filter((p) => !declared.has(p) && !p.startsWith('blocks.') && p !== 'type');
    assert.deepEqual(missing, [],
      `${collection.file} has keys the admin cannot edit: ${missing.join(', ')}`);
  });
}

test('every block type in the registry can be held by some collection', () => {
  const scopes = new Set();
  for (const c of COLLECTIONS) {
    const fields = c.kind === 'list' ? c.itemFields : c.fields;
    for (const f of fields) if (f.type === 'blocks') scopes.add(f.scope);
    // Nested: experience declares blocks inside roles.
    for (const f of fields) {
      if (f.type === 'list' && Array.isArray(f.fields)) {
        for (const g of f.fields) if (g.type === 'blocks') scopes.add(g.scope);
      }
    }
  }
  for (const [type, entry] of Object.entries(REGISTRY)) {
    if (type.startsWith('_')) continue;
    const reachable = (entry.scope || []).some((s) => scopes.has(s));
    assert.ok(reachable, `block type "${type}" has no collection that can hold it`);
  }
});

test('every block field declared in the registry appears in real data or is optional', () => {
  // A declared field nobody uses is not a defect; a USED field nobody declared
  // is, because it is what the save silently drops.
  const files = ['data/projects.json', 'data/experience.json', 'data/education.json'];
  const used = new Map();
  for (const f of files) {
    const data = load(f);
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      if (node.type && REGISTRY[node.type]) {
        const set = used.get(node.type) || new Set();
        Object.keys(node).forEach((k) => k !== 'type' && set.add(k));
        used.set(node.type, set);
      }
      Object.values(node).forEach(walk);
    };
    walk(data);
  }
  for (const [type, keys] of used) {
    const declared = new Set((REGISTRY[type].fields || []).map((f) => f.name));
    const missing = [...keys].filter((k) => !declared.has(k));
    assert.deepEqual(missing, [], `block "${type}" uses undeclared fields: ${missing.join(', ')}`);
  }
});
```

- [ ] **Step 2: Run it**

Run: `npm test`
Expected: it may FAIL, and that is the point — every failure is a real key the
admin cannot edit. Fix each by adding the field to `admin/schema.js`, not by
loosening the test. Known candidates from the current data: `images.*` sub-keys
on milestones, and `link.*`. If a failure is genuinely not content — an internal
key the site computes — exclude it by name with a comment saying why.

- [ ] **Step 3: Commit**

```bash
git add test/admin-completeness.test.js admin/schema.js
git commit -m "test(admin): everything in the data files has an editor, proven by walking them"
```

---

### Task 8: The admin wears the site's design

**Files:**
- Modify: `admin/index.html`
- Rewrite: `admin/admin.css`
- Test: `test/admin-css-contract.test.js` (create)

**Interfaces:**
- Produces: an admin styled entirely from the site's tokens.

- [ ] **Step 1: Write the failing test**

```js
// test/admin-css-contract.test.js
//
// The admin drifted because it kept a private copy of a design language: it
// linked the site's tokens but asked for names the editorial revamp deleted, so
// every value fell through to a hardcoded fallback and the page rendered on
// cream, in teal, in monospace. Repainting it fixes today. This stops tomorrow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../admin/admin.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

test('the admin loads the site\'s own tokens and base stylesheet', () => {
  assert.match(html, /href="\.\.\/css\/tokens\.css"/);
  assert.match(html, /href="\.\.\/css\/base\.css"/);
  assert.ok(html.indexOf('tokens.css') < html.indexOf('base.css'), 'tokens must load first');
  assert.ok(html.indexOf('base.css') < html.indexOf('admin.css'), 'admin.css must load last');
});

test('admin.css declares no colour of its own', () => {
  const hex = stripped.match(/#[0-9a-f]{3,8}\b/gi) || [];
  assert.deepEqual(hex, [], `hardcoded colours: ${hex.join(', ')}`);
  assert.equal(/\brgba?\(/.test(stripped), false, 'raw rgb() in admin.css');
});

test('admin.css declares no font family or size of its own', () => {
  for (const prop of ['font-family', 'font-size']) {
    const re = new RegExp(`${prop}\\s*:\\s*([^;}]+)`, 'g');
    for (const m of stripped.matchAll(re)) {
      assert.match(m[1].trim(), /^var\(--/, `${prop}: ${m[1].trim()} is not a token`);
    }
  }
});

test('no token name the site does not define', () => {
  const tokens = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
  const defined = new Set([...tokens.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...stripped.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]));
  const unknown = [...used].filter((n) => !defined.has(n) && !n.startsWith('admin-'));
  assert.deepEqual(unknown, [],
    `admin.css asks for tokens the site does not define: ${unknown.join(', ')}`);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL on all four — `base.css` is not linked, and `admin.css` is full of
hex, `monospace`, and `--bg`, `--surface`, `--line`, `--font-sans`, `--font-mono`.

- [ ] **Step 3: Load the site's stylesheets**

In `admin/index.html`:

```html
  <link rel="stylesheet" href="../css/tokens.css" />
  <link rel="stylesheet" href="../css/base.css" />
  <link rel="stylesheet" href="admin.css" />
```

Add the same pre-paint theme script the site uses, copied verbatim from
`index.html`, so the admin honours the stored theme and does not flash.

- [ ] **Step 4: Rewrite `admin.css`**

Layout only. Every colour is `var(--ground)`, `var(--ground-raised)`,
`var(--ink)`, `var(--ink-muted)`, `var(--accent)`, `var(--rule)`,
`var(--rule-accent)`, `var(--accent-plate)`. Every font is `var(--font-meta)` or
`var(--font-prose)`, every size `var(--text-xs|sm|base|lg)`, every space
`var(--space-N)`. Any admin-only value that is genuinely not a site concept —
the sidebar width, say — is declared as `--admin-*` on `:root` at the top of
`admin.css`, which the fourth test allows by prefix.

Elements to cover: `#login`, `.login-card`, `#topbar`, `.brand`, `.who`,
`.save-status` and its `ok`/`error` states, `.layout`, `#nav`, `#panel`,
`.field`, `fieldset`, `legend`, `.list`, `.list-item`, `.row-controls`,
`.thumb`, `.btn` and `.btn.ghost`, `.check`, `.err`, and the mobile breakpoint.

For the save-status states use `var(--accent-strong)` for success and the site's
error colour — if the site has none, add `--danger` and `--danger-strong` to
`css/tokens.css` with contrast verified against both grounds, and add them to
`test/tokens-contrast.test.js`'s checked list. Do not hardcode `#b3261e`.

- [ ] **Step 5: Verify by eye in both themes**

Serve and screenshot:

```bash
python -m http.server 8231 --directory .
```

Open `http://127.0.0.1:8231/admin/`, screenshot light and dark. Confirm: no
cream, no teal, no monospace, focus rings visible, and the sidebar readable at
390px.

- [ ] **Step 6: Run the tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add admin/index.html admin/admin.css test/admin-css-contract.test.js css/tokens.css test/tokens-contrast.test.js
git commit -m "feat(admin): wear the site's design, and a test so it cannot drift again"
```

---

### Task 9: Navigation follows the timeline, not the files

**Files:**
- Create: `admin/timeline-edit.js`
- Create: `admin/nav.js`
- Modify: `admin/schema.js` (add `TIMELINE_KINDS`)
- Modify: `admin/app.js`
- Test: `test/admin-timeline-edit.test.js` (create)

**Interfaces:**
- Produces, from `admin/timeline-edit.js`:
  - `resolveEntry(entry, data)` → `{ collection, record }` or throws.
  - `newRecordFor(kindKey, seed)` → a record matching the schema for that kind.
  - `TIMELINE_KINDS` from `admin/schema.js` → array of
    `{ key, label, collection, defaults }`.

- [ ] **Step 1: Write the failing test**

```js
// test/admin-timeline-edit.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTimeline } from '../js/timeline.js';
import { resolveEntry, newRecordFor } from '../admin/timeline-edit.js';
import { TIMELINE_KINDS, getCollection } from '../admin/schema.js';
import { validateModel } from '../admin/validate.js';

const load = (n) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), 'utf8'));
const DATA = {
  experience: load('experience'), education: load('education'),
  projects: load('projects'), milestones: load('milestones'),
};

test('every entry on the rail resolves to exactly one record', () => {
  // This is the promise the new navigation makes: click a row, get its record.
  const entries = buildTimeline(DATA).flatMap((g) => g.entries);
  assert.ok(entries.length >= 17);
  for (const e of entries) {
    const { collection, record } = resolveEntry(e, DATA);
    assert.equal(collection, e.source.collection, `${e.id} resolved to the wrong file`);
    assert.equal(record.id, e.source.id, `${e.id} resolved to the wrong record`);
  }
});

test('an entry whose record has vanished fails loudly', () => {
  const entries = buildTimeline(DATA).flatMap((g) => g.entries);
  const ghost = { ...entries[0], source: { collection: 'milestones', id: 'nope' } };
  assert.throws(() => resolveEntry(ghost, DATA), /nope/);
});

test('every add-entry kind produces a record its collection accepts', () => {
  for (const kind of TIMELINE_KINDS) {
    const record = newRecordFor(kind.key, { id: 'test-id', title: 'Test', date: '2026-01' });
    const collection = getCollection(kind.collection);
    assert.ok(collection, `${kind.key} names a collection that does not exist`);
    const model = collection.kind === 'list'
      ? { [collection.listKey]: [record] } : record;
    const errs = validateModel(collection, model);
    assert.deepEqual(errs, [], `${kind.key}: ${errs.map((e) => e.path).join(', ')}`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — cannot find `../admin/timeline-edit.js`.

- [ ] **Step 3: Declare the kinds in `admin/schema.js`**

```js
/** What "add an entry" offers, and where each one lands. The admin is organised
 *  around the timeline rather than the files, so this is the only place that
 *  knows a certificate lives in milestones.json and a job is a role nested
 *  inside a company. */
export const TIMELINE_KINDS = [
  { key:'job', label:'Job', collection:'experience', defaults:{} },
  { key:'education', label:'Education', collection:'education', defaults:{} },
  { key:'project', label:'Project', collection:'projects', defaults:{ timeline:true } },
  { key:'certification', label:'Certificate', collection:'milestones', defaults:{ kind:'certification' } },
  { key:'award', label:'Award', collection:'milestones', defaults:{ kind:'award' } },
  { key:'volunteering', label:'Volunteering', collection:'milestones', defaults:{ kind:'volunteering' } },
];
```

- [ ] **Step 4: Implement `admin/timeline-edit.js`**

```js
// admin/timeline-edit.js
/** The bridge between a row on the rail and the record behind it.
 *
 *  buildTimeline() composes entries from four files and stamps each with
 *  source: { collection, id }. This module does the reverse. It deliberately
 *  does not re-derive the composition: one implementation of "what is on the
 *  timeline" is the whole point. */
import { TIMELINE_KINDS, getCollection } from './schema.js';
import { blankValue } from './fields.js';

/** Every editable record in a collection, flattened. Experience is the only
 *  nested case: its rows are roles inside companies. */
export function recordsIn(collection, data) {
  if (collection === 'experience') {
    return (data.experience?.items || []).flatMap((c) => c.roles || []);
  }
  return data[collection]?.items || [];
}

export function resolveEntry(entry, data) {
  const { collection, id } = entry.source || {};
  if (!collection) throw new Error(`entry ${entry.id} carries no source`);
  const record = recordsIn(collection, data).find((r) => r.id === id);
  if (!record) throw new Error(`no record ${id} in ${collection}`);
  return { collection, record };
}

export function newRecordFor(kindKey, seed = {}) {
  const kind = TIMELINE_KINDS.find((k) => k.key === kindKey);
  if (!kind) throw new Error(`unknown timeline kind ${kindKey}`);
  const collection = getCollection(kind.collection);
  const fields = kind.collection === 'experience'
    ? collection.itemFields.find((f) => f.name === 'roles').fields
    : collection.itemFields;
  const record = {};
  for (const f of fields) record[f.name] = blankValue(f);
  return { ...record, ...kind.defaults, ...seed };
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS. If the third test fails, the seed is missing a field the schema
marks required — widen the seed in the test to include it and say why in a
comment, or drop `required` if it is not genuinely required.

- [ ] **Step 6: Build `admin/nav.js` and wire `app.js`**

`nav.js` exports `renderNav(doc, { sections, entries, onSelect, onAdd })` and
draws two groups: **The path**, listing each entry as
`<date> · <title> · <kind>` in the order `buildTimeline` returned, with an
**Add entry** control offering `TIMELINE_KINDS`; and the remaining sections —
Selected work, Profile, About, Skills, Numbers, Settings.

`app.js` loads all four timeline files on boot (it already loads one collection
at a time; add a `loadAll()` that fetches the four in parallel through the same
client), calls `buildTimeline`, and passes the entries to `renderNav`. Selecting
an entry calls `resolveEntry`, opens that collection, and scrolls the matching
list item into view. Adding an entry calls `newRecordFor`, pushes it onto the
collection's list, opens the form, and focuses the first field.

**Projects appear in both places.** Guard the shared-state risk from the spec:
`app.js` keeps exactly one `model` and one `dirty` flag, keyed by collection
name, so opening a project from the path and from Selected work opens the same
in-memory record. Never hold two models for one collection.

- [ ] **Step 7: Verify by hand, then commit**

Serve, sign in if possible, and confirm: the path lists every entry in site
order; clicking one opens its form; Add entry → Job creates a role.

```bash
git add admin/timeline-edit.js admin/nav.js admin/schema.js admin/app.js test/admin-timeline-edit.test.js
git commit -m "feat(admin): navigate by the timeline, not by the files"
```

---

### Task 10: Photographs, processed in the browser

**Files:**
- Create: `admin/photos.js`
- Modify: `admin/media.js`, `admin/lib.js`
- Test: `test/admin-photos.test.js` (create)

**Interfaces:**
- Produces, from `admin/photos.js`:
  - `targetSize(width, height, cap)` → `{ width, height }`, long edge capped.
  - `derivedPaths(filename)` → `{ slug, large, small }`.
  - `attachPhoto(file, record, field, client)` → commits both derivatives and
    writes `src`, `srcSmall`, `width`, `height`, `widthSmall` onto `record`.

- [ ] **Step 1: Write the failing test**

```js
// test/admin-photos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { targetSize, derivedPaths } from '../admin/photos.js';

test('the long edge is capped and the aspect ratio is kept', () => {
  assert.deepEqual(targetSize(4032, 3024, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(targetSize(3024, 4032, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(targetSize(738, 1600, 800), { width: 369, height: 800 });
});

test('an image already smaller than the cap is not enlarged', () => {
  assert.deepEqual(targetSize(600, 400, 1600), { width: 600, height: 400 });
});

test('derived paths match where the site looks for photographs', () => {
  // js/data.js reads src and srcSmall as written; the site's photographs live
  // in assets/photos/derived with -1600 and -800 suffixes.
  assert.deepEqual(derivedPaths('IMG_2481 (1).HEIC'), {
    slug: 'img-2481-1',
    large: 'assets/photos/derived/img-2481-1-1600.jpg',
    small: 'assets/photos/derived/img-2481-1-800.jpg',
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — cannot find `../admin/photos.js`.

- [ ] **Step 3: Implement the pure half**

```js
// admin/photos.js
/** Everything tools/process_photos.py does, in the browser, so a photograph can
 *  be added from a phone with no developer step.
 *
 *  The original is deliberately not committed. It costs the Python tool the
 *  ability to regenerate an admin-added photograph if the sizes ever change;
 *  it saves uploading four megabytes over mobile data before a save completes.
 *  That is a UX decision before it is a storage one. */
import { sanitizeFilename } from './lib.js';

export const CAPS = [1600, 800];
export const QUALITY = 0.82;

/** Scale so the long edge meets the cap, never enlarging. */
export function targetSize(width, height, cap) {
  const long = Math.max(width, height);
  if (long <= cap) return { width, height };
  const scale = cap / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function derivedPaths(filename) {
  const slug = sanitizeFilename(filename).replace(/\.[^.]+$/, '');
  return {
    slug,
    large: `assets/photos/derived/${slug}-1600.jpg`,
    small: `assets/photos/derived/${slug}-800.jpg`,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS. If `derivedPaths` fails, `sanitizeFilename` keeps the extension —
the `replace` above strips it; check the order.

- [ ] **Step 5: Implement the browser half**

Append to `admin/photos.js`:

```js
/** Apply the EXIF rotation to the pixels before anything else touches them.
 *  Stripping metadata first is exactly the bug tools/process_photos.py carried
 *  until September 2026: it rebuilt from raw pixels and threw the orientation
 *  tag away with everything else, so a portrait phone photo shipped sideways. */
async function bitmapUpright(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (_) {
    // Feature-detect rather than ship a sideways photograph silently.
    const bmp = await createImageBitmap(file);
    bmp.__orientationUnknown = true;
    return bmp;
  }
}

async function encode(bitmap, cap) {
  const { width, height } = targetSize(bitmap.width, bitmap.height, cap);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  // Re-encoding through a canvas drops every metadata block, which is the same
  // guarantee the Python tool gets by rebuilding from raw pixels.
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
  return { blob, width, height };
}

const toBase64 = (buf) => {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

export async function attachPhoto(file, record, field, client) {
  const bitmap = await bitmapUpright(file);
  if (bitmap.__orientationUnknown) {
    throw new Error('This browser cannot read the photo\'s rotation. '
      + 'Rotate it in Photos first, then upload.');
  }
  const paths = derivedPaths(file.name);
  const large = await encode(bitmap, CAPS[0]);
  const small = await encode(bitmap, CAPS[1]);

  for (const [path, out] of [[paths.large, large], [paths.small, small]]) {
    let sha = null;
    try { sha = (await client.getFile(path)).sha; } catch (_) { sha = null; }
    const b64 = toBase64(await out.blob.arrayBuffer());
    await client.putBinary(path, b64, sha, `admin: add ${path.split('/').pop()}`);
  }

  // The site requires all five; typing them by hand is how they go wrong.
  record.src = paths.large;
  record.srcSmall = paths.small;
  record.width = large.width;
  record.height = large.height;
  record.widthSmall = small.width;
  return paths.large;
}
```

- [ ] **Step 6: Raise the input cap and shrink `media.js`**

In `admin/lib.js`:

```js
// A phone photograph is routinely 3-5 MB and the old 2 MB cap rejected them —
// including the 2.1 MB Honors Day picture added in September 2026. The
// committed output is bounded by the resize, not by the source, so the input
// limit only needs to stop something absurd.
const MAX_IMG = 12 * 1024 * 1024;
```

In `admin/media.js`, keep `readFileBase64` and `pickAndUpload` for the SVG and
non-photograph path only, and add a guard at the top of `pickAndUpload`:

```js
  if (file.type !== 'image/svg+xml') {
    throw new Error('Photographs go through admin/photos.js, which resizes them.');
  }
```

- [ ] **Step 7: Verify by hand**

Sign in, open a milestone, upload a portrait photograph taken on a phone.
Confirm: two files appear under `assets/photos/derived/`, the thumbnail is
upright, and `width`/`height`/`widthSmall` are filled without typing.

- [ ] **Step 8: Commit**

```bash
git add admin/photos.js admin/media.js admin/lib.js test/admin-photos.test.js
git commit -m "feat(admin): add a photograph from a phone, rotation and sizes handled"
```

---

### Task 11: Errors appear at the field

**Files:**
- Modify: `admin/validate.js`
- Modify: `admin/forms.js`, `admin/app.js`
- Test: `test/admin-validate.test.js`

**Interfaces:**
- Produces: `validateModel` returns `{ path, message }` covering list-of-scalars;
  `renderForm` stamps `data-path` on every field wrapper; `showErrors(container,
  errors)` in `forms.js` renders each message against its control.

- [ ] **Step 1: Write the failing test**

Append to `test/admin-validate.test.js`:

```js
test('a required scalar missing from a list of scalars is reported with its index', () => {
  const collection = { kind: 'list', listKey: 'items', itemFields: [
    { name: 'tags', label: 'Tags', type: 'list',
      itemField: { name: 'tag', label: 'Tag', type: 'string', required: true } } ] };
  const errs = validateModel(collection, { items: [{ tags: ['ok', ''] }] });
  assert.equal(errs.length, 1);
  assert.equal(errs[0].path, 'items[0].tags[1]');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `checkFields` skips lists that declare `itemField`.

- [ ] **Step 3: Implement**

In `admin/validate.js`, inside `checkFields`, after the existing list branch:

```js
    if (f.type === 'list' && f.itemField && Array.isArray(v)) {
      v.forEach((item, i) => {
        if (f.itemField.required && (item === '' || item == null)) {
          errs.push({ path: `${path}[${i}]`, message: `${f.itemField.label} is required` });
        }
      });
    }
```

- [ ] **Step 4: Render errors at their controls**

`renderField` already stamps `data-path` with the field name. Extend `forms.js`
to compose full paths as it renders (`items[0].roles[2].title`) and add:

```js
/** Errors belong beside the control that caused them. The save bar used to show
 *  one path like `experience.items[0].roles[2].title` and leave the reader to
 *  find it. */
export function showErrors(container, errors) {
  container.querySelectorAll('.field-error').forEach((n) => n.remove());
  container.querySelectorAll('[aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
  let first = null;
  for (const err of errors) {
    const field = container.querySelector(`[data-path="${CSS.escape(err.path)}"]`);
    if (!field) continue;
    const msg = document.createElement('p');
    msg.className = 'field-error';
    msg.textContent = err.message;
    field.appendChild(msg);
    const control = field.querySelector('input, textarea, select');
    if (control) control.setAttribute('aria-invalid', 'true');
    if (!first) first = control || field;
  }
  if (first) first.focus?.();
  return errors.length;
}
```

In `app.js`'s save handler, replace the single-error status line with:

```js
  const errs = validateModel(current, model);
  if (errs.length) {
    showErrors($('panel'), errs);
    setStatus(errs.length === 1 ? '1 problem to fix' : `${errs.length} problems to fix`, 'error');
    return;
  }
  showErrors($('panel'), []);
```

Add `.field-error` to `admin.css` using `var(--danger)` from Task 8.

- [ ] **Step 5: Run the tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add admin/validate.js admin/forms.js admin/app.js admin/admin.css test/admin-validate.test.js
git commit -m "feat(admin): show each error at the field that caused it"
```

---

### Task 12: See it before publishing

**Files:**
- Create: `admin/preview.js`
- Modify: `admin/index.html`, `admin/app.js`, `admin/admin.css`
- Test: `test/admin-preview.test.js` (create)

**Interfaces:**
- Produces, from `admin/preview.js`:
  - `mergeForPreview(base, collectionName, data)` → a full site dataset with one
    collection replaced.
  - `createPreview(iframe, loadAll)` → `{ update(collectionName, data), destroy() }`.

- [ ] **Step 1: Write the failing test**

```js
// test/admin-preview.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeForPreview } from '../admin/preview.js';
import { buildTimeline } from '../js/timeline.js';

const load = (n) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), 'utf8'));
const BASE = {
  profile: load('profile'), summary: load('summary'), settings: load('settings'),
  experience: load('experience'), education: load('education'), projects: load('projects'),
  milestones: load('milestones'), metrics: load('metrics'), skills: load('skills'),
  registry: load('blocks-registry'),
};

test('merging replaces one collection and leaves the rest alone', () => {
  const edited = { items: [{ value: '99', label: 'edited' }] };
  const merged = mergeForPreview(BASE, 'metrics', edited);
  assert.deepEqual(merged.metrics, edited);
  assert.deepEqual(merged.profile, BASE.profile);
  assert.notStrictEqual(merged, BASE, 'must not mutate the base dataset');
});

test('a merged dataset still composes a timeline', () => {
  // The preview renders through the site's own pipeline; if the merge produced
  // something buildTimeline cannot read, the preview would show a blank page
  // and look like a rendering bug rather than a data one.
  const edited = JSON.parse(JSON.stringify(BASE.milestones));
  edited.items.push({ id: 'new', kind: 'award', date: '2026-03', title: 'New', images: [] });
  const merged = mergeForPreview(BASE, 'milestones', edited);
  const entries = buildTimeline(merged).flatMap((g) => g.entries);
  assert.ok(entries.some((e) => e.id === 'new'));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — cannot find `../admin/preview.js`.

- [ ] **Step 3: Implement**

```js
// admin/preview.js
/** The preview is the site.
 *
 *  js/render.js's renderAll(doc, data, timeline) takes any document, and the
 *  admin is same-origin with the site, so the preview is an <iframe src="/">
 *  re-rendered by the site's own renderer with the edited data. There is no
 *  second renderer to keep in step — which is the whole reason this is cheap
 *  enough to build. */
import { normalizeSiteImages } from '../js/data.js';
import { buildTimeline } from '../js/timeline.js';
import { renderAll } from '../js/render.js';

/** A full dataset with one collection swapped. Never mutates the base. */
export function mergeForPreview(base, collectionName, data) {
  return { ...base, [collectionName]: data };
}

export function createPreview(iframe, loadAll) {
  let base = null;
  let timer = null;
  let ready = false;

  iframe.addEventListener('load', () => { ready = true; });

  async function render(collectionName, data) {
    if (!ready || !iframe.contentDocument) return;
    if (!base) base = await loadAll();
    const merged = normalizeSiteImages(mergeForPreview(base, collectionName, data));
    renderAll(iframe.contentDocument, merged, buildTimeline(merged));
  }

  return {
    /** Debounced: typing should not re-render the whole page per keystroke. */
    update(collectionName, data) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        render(collectionName, data).catch(() => {
          // A merge the site cannot render leaves the last good frame on
          // screen. Showing a half-built record is worse than showing the
          // previous one.
        });
      }, 250);
    },
    /** Call when the edited collection changes, so the neighbours are refetched
     *  rather than previewed against a stale cache. */
    invalidate() { base = null; },
    destroy() { clearTimeout(timer); },
  };
}
```

- [ ] **Step 4: Wire it into the shell**

In `admin/index.html`, inside `.layout`, after `#panel`:

```html
      <aside id="preview-pane" aria-label="Preview">
        <iframe id="preview" src="/" title="Preview of the site"></iframe>
      </aside>
```

In `app.js`: build the preview once after boot, call `preview.update(current.name,
modelToData(current, model))` from the existing `panel` `input` listener, and
call `preview.invalidate()` in `selectCollection`.

In `admin.css`: three columns above the breakpoint (nav, panel, preview); below
it, a toggle that shows the form or the preview, one at a time, never both.

- [ ] **Step 5: Verify by hand**

Edit the availability line and watch the hero change without saving. Introduce a
validation error and confirm the last good render stays.

- [ ] **Step 6: Run the tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add admin/preview.js admin/index.html admin/app.js admin/admin.css test/admin-preview.test.js
git commit -m "feat(admin): preview the real page, rendered by the real renderer"
```

---

## Self-Review

**Spec coverage.** Every numbered section maps to a task: 2.1 and 6.2 → Task 1;
6.1 → Tasks 2 and 9; 2.3 and 6.4 → Tasks 3, 4, 5; 2.4 and 6.5 → Task 6; section
5 → Task 7; 2.2 and 6.3 → Task 8; 6.6 → Task 4's list control; 2.5 and 6.7 →
Task 10; 6.9 → Task 11; 6.8 → Task 12. Goals 1-7 are each covered.

**Ordering.** Task 4 precedes 5 because the renderer must exist before its
callers use it. Task 3 precedes 4 because the renderer's tests read the migrated
registry. Task 2 precedes 9 because navigation needs `source`. Task 8 precedes 11
because `.field-error` needs `--danger`. Task 6 precedes 7 because the
completeness test would otherwise fail on two collections by design.

**Known risk carried into execution.** Task 7 may fail on first run. That is
intended: each failure names a real key with no editor. The instruction is to add
the field, never to loosen the assertion.

**Verification that cannot be automated.** Sign-in end to end needs Ahmed's
Vercel redeploy. Canvas encoding needs a browser. Both are called out in their
tasks with a manual step.
