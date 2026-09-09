/** The one field vocabulary, shared by the collection form and the block editor.
 *
 *  The value logic is pure and the DOM layer is thin, deliberately: admin tests
 *  run in Node with no DOM, and the defect this file exists to kill — a list of
 *  records flattened to "[object Object]" — lives entirely in the value logic.
 *  A bug that cannot be tested is a bug that comes back.
 */
import { uploadRule } from './lib.js';

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
    // A <select> shows nothing at all for a value no option carries, and the
    // blank value for a select is the empty string, which no option carries.
    // So a new milestone's Kind and a new skills category's Display type
    // rendered blank, and cleanObject then dropped the key on save — a
    // milestone with no kind, a category with no type. A new record starts on
    // a real option instead. (Only new records: this is blankValue, which
    // builds what Add creates. buildFormModel, which reads an existing file,
    // is deliberately untouched — inventing a value there would write it into
    // a file that never had it.)
    case 'select': return field.options?.[0]?.value ?? '';
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

// Picking a photograph writes five fields at once — src, srcSmall, width,
// height and widthSmall, all of them by admin/photos.js's attachPhoto — but a
// control can only ever refresh itself. Its four siblings were built in the
// same render pass with the values they had then, so without this they keep
// showing blank, or the previous photograph's numbers, while the path and
// thumbnail update beside them. Filling them in by hand is the natural
// response to that, and it is exactly how a wrong `width` attribute ships and
// how the correct value gets overwritten.
//
// An event rather than a callback on `ctx`: ctx is one object shared by the
// entire form, so a callback on it could only ever mean "re-render
// everything" and would have no way to know which of the four nesting levels
// the control sits at. The group that has to redraw is whichever one is
// nearest the control, and that is precisely what an event that bubbles finds
// for free — the same reason bump() below already dispatches a bubbling
// `input` rather than calling back.
const REWROTE = 'field:rewrote';

/** Say that fields other than the control's own were just written. */
function announceRewrite(node, record) {
  node.dispatchEvent(new CustomEvent(REWROTE, { bubbles: true, detail: { record } }));
}

/** Marks `host` as the group that draws `record`'s fields: a rewrite from
 *  inside it redraws all of them, and the innermost such group stops the
 *  event, so a photograph row inside a project redraws the row and not the
 *  whole project. Focus is put back where it was — an upload driven from the
 *  keyboard must not drop focus at the top of the document. */
export function ownsRecord(host, record, draw) {
  host.addEventListener(REWROTE, (event) => {
    if (event.detail?.record !== record) return;
    event.stopPropagation();
    const active = host.ownerDocument?.activeElement;
    const path = host.contains?.(active) ? active.closest('.field')?.dataset.path : null;
    draw();
    if (!path) return;
    host.querySelector(`[data-path="${CSS.escape(path)}"]`)
      ?.querySelector('input:not([type="file"]), textarea, select')?.focus();
  });
}

/** Redraw one record's fields inside the group that owns them, leaving
 *  whatever the caller put there first (a row-controls strip, a legend)
 *  alone. */
export function drawFields(doc, host, fields, record, ctx, prefix) {
  for (const node of host.querySelectorAll(':scope > .field')) node.remove();
  for (const f of fields || []) host.appendChild(renderField(doc, f, record, ctx, prefix));
}

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
    // The pre-branch renderer appended " *" to a required caption and this
    // one dropped it, so nothing said which fields Save would refuse until it
    // refused. The asterisk is back, but it is not the signal: it is
    // aria-hidden, and the control below carries the `required` attribute,
    // which is what a screen reader actually announces. An asterisk alone is
    // a convention a sighted reader has learned, not information.
    if (field.required) {
      const star = el(doc, 'span', { className: 'req', textContent: '*' });
      star.setAttribute('aria-hidden', 'true');
      label.appendChild(star);
    }
    wrap.appendChild(label);
  }
  const path = composePath(pathPrefix, field.name);
  const control = controlFor(doc, field, record, ctx, id, path);
  // The half of the required marker a screen reader reads. Set on the element
  // rather than as aria-required so the browser exposes it natively; there is
  // no <form> around any of this, so it gates nothing and blocks no submit —
  // Save validates through admin/validate.js exactly as before. An image
  // field hands back a wrapper rather than a form control, so it sets this on
  // its own text input instead (see imageControl).
  if (field.required && id && 'required' in control) control.required = true;
  wrap.appendChild(control);
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
      // readField never returns null: a null object field reads as a blank
      // object so the controls below have somewhere to write. Assigning that
      // blank object straight back onto the record turned `"link": null` into
      // `{}` on the first render, before a single key was pressed —
      // cleanObject's null guard then never fired and the key was dropped from
      // the file on the next save, for the five milestones that carry it. So
      // the record is left exactly as it was, and the blank object is attached
      // only if something is actually typed into it: the first `input` from
      // anywhere inside this fieldset, which is also what every nested
      // control, checkbox, select, list and upload already dispatches.
      const value = readField(field, record);
      const attach = () => { if (record[field.name] !== value) record[field.name] = value; };
      set.addEventListener('input', attach);
      const draw = () => drawFields(doc, set, field.fields, value, ctx, path);
      draw();
      ownsRecord(set, value, draw);
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
  // A list of tags and a list of photographs are not the same shape of thing,
  // and rendering them identically is what made a one-word tag cost as much
  // vertical space as a whole record. Stamped rather than sniffed in CSS: a
  // `:has()` chain deep enough to tell them apart stops matching silently the
  // day the DOM shifts, and this branch is already here.
  host.dataset.item = field.itemField ? (field.itemField.type || 'string') : 'record';

  const draw = () => {
    host.innerHTML = '';
    // An empty list is a bordered box around a lone Add button. The stylesheet
    // flattens it, but only if something says it is empty.
    if (items.length) delete host.dataset.empty; else host.dataset.empty = 'true';
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

      if (field.itemField) {
        // A scalar item has no name of its own to key a record by, so the
        // list itself is the record and the index is the key: writeField
        // sets items[i] directly, with no intermediate holder to go stale.
        // The same numeric name tells composePath this is a bracketed leaf,
        // not a dotted field, when renderField stamps its data-path.
        const node = renderField(doc, { ...field.itemField, name: String(i), label: '' }, items, ctx, path);
        // `label: ''` means "draw no caption", which also means renderField
        // minted no id and no <label> — so these controls had no accessible
        // name at all, sitting beside buttons that did. The visible caption
        // stays suppressed; only the announced one is restored.
        node.querySelector('input:not([type="file"]), textarea, select')
          ?.setAttribute('aria-label', `${field.itemField.label || field.label || field.name} ${i + 1}`);
        // Control first, then its buttons. Reordering these two in CSS instead
        // would put the buttons before the input for anyone tabbing through,
        // which is a focus-order failure traded for a spacing win.
        row.append(node, ctrls);
      } else {
        row.appendChild(ctrls);
        const redraw = () => drawFields(doc, row, field.fields, item, ctx, `${path}[${i}]`);
        redraw();
        ownsRecord(row, item, redraw);
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

// Which committed paths can be shown as a picture. Settings' CV is a `.pdf`
// on an `image` field, and an <img> pointed at a PDF renders as a broken
// image — the browser's "this file is missing" icon, on a file that is
// perfectly fine and did upload. So the thumbnail follows the file, not the
// field type.
const RENDERABLE_IMAGE = /\.(png|jpe?g|svg|webp|gif|avif)$/i;

function imageControl(doc, field, record, ctx, id) {
  const host = el(doc, 'div');
  const rule = uploadRule(field.accept);
  const inp = el(doc, 'input', { type: 'text', value: readField(field, record) });
  if (id) inp.id = id;
  if (field.required) inp.required = true;
  inp.addEventListener('input', () => writeField(field, record, inp.value));
  const thumb = el(doc, 'img', { className: 'thumb' });
  const showThumb = () => {
    const value = record[field.name];
    const isImage = typeof value === 'string' && RENDERABLE_IMAGE.test(value);
    thumb.hidden = !isImage;
    if (isImage) thumb.src = '../' + value;
  };
  showThumb();
  // The field's own declared filter, so the dialog offers what the field
  // actually takes — the CV asks for a PDF and used to be handed an
  // image-only dialog it could not answer.
  const picker = el(doc, 'input', { type: 'file', accept: rule.accept });
  picker.hidden = true;
  const btn = el(doc, 'button', { type: 'button', className: 'btn ghost', textContent: rule.button });
  btn.addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    if (!picker.files[0] || !ctx.uploadImage) return;
    try {
      await ctx.uploadImage(picker.files[0], record, field);
      inp.value = record[field.name] || '';
      showThumb();
      // Order matters. `input` goes first, while this node is still in the
      // tree, so app.js's panel listener marks the collection dirty and feeds
      // the preview; the rewrite goes second, because the group that answers
      // it may replace this very node.
      bump(host);
      announceRewrite(host, record);
    } catch (e) { ctx.onError?.(e); }
  });
  host.append(inp, btn, picker, thumb);
  return host;
}
