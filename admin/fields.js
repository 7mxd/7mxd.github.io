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
        // A scalar item has no name of its own to key a record by, so the
        // list itself is the record and the index is the key: writeField
        // sets items[i] directly, with no intermediate holder to go stale.
        row.appendChild(renderField(doc, { ...field.itemField, name: String(i), label: '' }, items, ctx));
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
