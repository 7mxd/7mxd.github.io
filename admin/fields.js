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
  if (field.type === 'blocks') return Array.isArray(v) ? v : blankValue(field);
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

const el = (doc, tag, props = {}) => Object.assign(doc.createElement(tag), props);
const bump = (node) => node.dispatchEvent(new Event('input', { bubbles: true }));

// A module-level counter, not an id keyed off the field name: a later task
// renders a second document for a live preview, and a fixed id per field
// name would collide the moment both documents exist at once.
let uid = 0;
const nextId = () => 'field-' + (++uid);

// object, list and blocks hand back a fieldset or a bare container, not a
// single labelable element — a `<label for>` pointed at one does nothing a
// screen reader honours, so those three never get an id to point at.
const GROUP_TYPES = new Set(['object', 'list', 'blocks']);

/** A labelled control for one field. `ctx` carries { doc, client, registry,
 *  renderBlocks, uploadImage } — everything a field might need and nothing it
 *  builds itself.
 *
 *  `field.label === ''` means "no caption for this control" (the scalar rows
 *  inside a list of strings, which would otherwise show their own index as a
 *  label) — distinct from `field.label` simply absent, which falls back to
 *  `field.name`. Whenever a caption is shown for an atomic control, the
 *  control gets a generated id and the label points at it with `htmlFor`, so
 *  the caption is the control's accessible name and not just nearby text.
 *
 *  `pathPrefix` composes the full address `validateModel` reports errors
 *  against — `items[0].roles[2].title` — so a save error can be shown beside
 *  the control that caused it rather than as one path string in the save
 *  bar. It is a trailing parameter, not a `ctx` entry: `ctx` is shared
 *  across the whole form, and a prefix is only ever right for one branch of
 *  it. A field's own name is joined to it with a dot; a scalar list item
 *  has no name of its own (its name IS the index — see listControl), and a
 *  purely numeric name is the sign of that, so it joins with brackets
 *  instead and appends nothing further. */
export function renderField(doc, field, record, ctx, pathPrefix = '') {
  const wrap = el(doc, 'div', { className: 'field' });
  const labelText = field.label === '' ? null : (field.label || field.name);
  const id = (field.type !== 'boolean' && !GROUP_TYPES.has(field.type) && labelText != null)
    ? nextId() : null;
  // A group type names itself with the <legend> inside its own <fieldset>
  // (groupSet below), so it must not also get a <label> here. It used to get
  // both: Settings showed nine captions twice over, six of them nested two
  // deep, and Profile — the first screen the admin opens — showed four. The
  // stray <label> was not merely redundant either, since a group is not a
  // single labelable element and the label pointed at no control at all.
  if (id) {
    const label = el(doc, 'label', { textContent: labelText });
    label.htmlFor = id;
    wrap.appendChild(label);
  }
  const path = composePath(pathPrefix, field.name);
  wrap.appendChild(controlFor(doc, field, record, ctx, id, path));
  wrap.dataset.path = path;
  return wrap;
}

/** `prefix` is empty at the top of a form, a record path (`items[0]`) one
 *  level into a list, or a nested field path (`items[0].roles[2]`) deeper
 *  still. `name` is either an ordinary field name or, for a scalar list
 *  item, the stringified index that already stands for the whole path
 *  segment — brackets close it off there instead of a dot opening onto it. */
function composePath(prefix, name) {
  if (!prefix) return name;
  return /^\d+$/.test(name) ? `${prefix}[${name}]` : `${prefix}.${name}`;
}

/** The shell a group of controls names itself with. <fieldset>/<legend> is the
 *  only markup that names a group of controls programmatically, which is why
 *  all three group types use it and why none of them takes a <label>. The
 *  object branch already did; list and blocks returned a bare container and
 *  leaned on renderField's stray label, so making them consistent is what
 *  lets that label go. This is also the shape the pre-branch renderer had —
 *  see `git show 9987494:admin/forms.js` — before object grew a duplicate. */
function groupSet(doc, field) {
  const set = el(doc, 'fieldset');
  const caption = field.label === '' ? null : (field.label || field.name);
  if (caption != null) set.appendChild(el(doc, 'legend', { textContent: caption }));
  return set;
}

function controlFor(doc, field, record, ctx, id, path) {
  switch (field.type) {
    case 'text': case 'code': {
      const ta = el(doc, 'textarea', { value: readField(field, record) });
      if (id) ta.id = id;
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
      if (id) inp.id = id;
      inp.addEventListener('input', () => writeField(field, record, inp.value));
      return inp;
    }
    case 'select': {
      const sel = el(doc, 'select');
      if (id) sel.id = id;
      for (const o of field.options || []) {
        sel.appendChild(el(doc, 'option', { value: o.value, textContent: o.label }));
      }
      sel.value = readField(field, record);
      sel.addEventListener('change', () => { writeField(field, record, sel.value); bump(sel); });
      return sel;
    }
    case 'image': return imageControl(doc, field, record, ctx, id);
    case 'object': {
      const set = groupSet(doc, field);
      const value = readField(field, record);
      record[field.name] = value;
      for (const f of field.fields || []) set.appendChild(renderField(doc, f, value, ctx, path));
      return set;
    }
    case 'list': {
      const set = groupSet(doc, field);
      set.appendChild(listControl(doc, field, record, ctx, path));
      return set;
    }
    case 'blocks': {
      const set = groupSet(doc, field);
      const host = el(doc, 'div');
      record[field.name] = readField(field, record);
      ctx.renderBlocks(host, record[field.name], field.scope, ctx.registry, ctx);
      set.appendChild(host);
      return set;
    }
    default: {
      const inp = el(doc, 'input', { type: 'text', value: readField(field, record) });
      if (id) inp.id = id;
      inp.addEventListener('input', () => writeField(field, record, inp.value));
      return inp;
    }
  }
}

/** Add, remove and reorder at every level, for scalars and records alike.
 *  Order is content here: it decides which photograph leads a gallery and takes
 *  the wide slot, and which skills come first in their row.
 *
 *  This is the one place that knows a list index, so it is the one place
 *  that composes `[i]` onto a path: a record item's fields carry on from
 *  `${path}[${i}]` same as any nested field, but a scalar item has no field
 *  of its own to append — `${path}[${i}]` already IS its whole leaf path. */
function listControl(doc, field, record, ctx, path) {
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
        // A scalar item has no name of its own to key a record by, so the
        // list itself is the record and the index is the key: writeField
        // sets items[i] directly, with no intermediate holder to go stale.
        // The same numeric name tells composePath this is a bracketed leaf,
        // not a dotted field, when renderField stamps its data-path.
        row.appendChild(renderField(doc, { ...field.itemField, name: String(i), label: '' }, items, ctx, path));
      } else {
        for (const f of field.fields || []) row.appendChild(renderField(doc, f, item, ctx, `${path}[${i}]`));
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

function imageControl(doc, field, record, ctx, id) {
  const host = el(doc, 'div');
  const inp = el(doc, 'input', { type: 'text', value: readField(field, record) });
  if (id) inp.id = id;
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
