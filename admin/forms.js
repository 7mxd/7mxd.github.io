import { renderField, blankValue, moveItem } from './fields.js';

/** One record in a list collection (e.g. an experience entry, a project):
 *  its own add/remove/reorder controls, then one renderField call per
 *  declared item field. The collection-level list isn't itself a `field` —
 *  `collection.itemFields` is a bare array of field defs keyed by
 *  `collection.listKey` on the model — so this stays here rather than
 *  folding into fields.js's own list handling for nested fields.
 *
 *  This is the collection's own list index, so this is where its path
 *  segment is composed: `${listKey}[${i}]`, matching what `validateModel`
 *  reports and what fields.js's own listControl does one level down for a
 *  nested list. */
function itemBox(items, itemFields, i, ctx, collectionLabel, host, rerender, listKey) {
  const box = document.createElement('div'); box.className = 'list-item';
  const ctrls = document.createElement('div'); ctrls.className = 'row-controls';
  const mk = (text, label, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost'; b.textContent = text;
    b.setAttribute('aria-label', `${label} ${collectionLabel} ${i + 1}`);
    b.addEventListener('click', () => { fn(); rerender(); host.dispatchEvent(new Event('input', { bubbles: true })); });
    return b;
  };
  ctrls.append(
    mk('↑', 'Move up', () => moveItem(items, i, i - 1)),
    mk('↓', 'Move down', () => moveItem(items, i, i + 1)),
    mk('Remove', 'Remove', () => items.splice(i, 1)));
  box.appendChild(ctrls);
  const prefix = `${listKey}[${i}]`;
  for (const f of itemFields) box.appendChild(renderField(document, f, items[i], ctx, prefix));
  return box;
}

function listCollection(collection, model, ctx) {
  const fs = document.createElement('fieldset');
  const lg = document.createElement('legend'); lg.textContent = collection.label; fs.appendChild(lg);
  const items = Array.isArray(model[collection.listKey]) ? model[collection.listKey] : (model[collection.listKey] = []);
  const host = document.createElement('div');
  const rerender = () => {
    host.innerHTML = '';
    items.forEach((_, i) => host.appendChild(itemBox(items, collection.itemFields, i, ctx, collection.label, host, rerender, collection.listKey)));
  };
  rerender();
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'btn'; add.textContent = 'Add';
  add.addEventListener('click', () => {
    items.push(blankValue({ type: 'object', fields: collection.itemFields }));
    rerender();
    host.dispatchEvent(new Event('input', { bubbles: true }));
  });
  fs.append(host, add);
  return fs;
}

export function renderForm(container, collection, model, ctx) {
  container.innerHTML = '';
  if (collection.kind === 'single') {
    for (const f of collection.fields) container.appendChild(renderField(document, f, model, ctx));
  } else {
    container.appendChild(listCollection(collection, model, ctx));
  }
}

/** Errors belong beside the control that caused them. The save bar used to show
 *  one path like `experience.items[0].roles[2].title` and leave the reader to
 *  find it. `doc` is a parameter rather than the global `document` for the
 *  same reason `renderField` takes one: a later task renders a second
 *  document for a live preview, and the global isn't safe to assume once
 *  that exists. An error whose path matches no control is silently dropped
 *  (a path composition bug would otherwise ship as a mysteriously blank
 *  error), so a wrong path here is worth chasing down, not shrugging off. */
export function showErrors(doc, container, errors) {
  container.querySelectorAll('.field-error').forEach((n) => n.remove());
  container.querySelectorAll('[aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
  let first = null;
  for (const err of errors) {
    const field = container.querySelector(`[data-path="${CSS.escape(err.path)}"]`);
    if (!field) continue;
    const msg = doc.createElement('p');
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
