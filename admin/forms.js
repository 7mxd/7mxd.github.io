import { renderField, blankValue, moveItem, drawFields, ownsRecord, destinationIndex, focusAfterMutation, rowsOf, announceRemoval } from './fields.js';

/** What to call a record on its collapsed header.
 *
 *  The editor used to name nothing: every record in a collection rendered as
 *  an unlabelled bordered box, so a collapsed list would have been a stack of
 *  identical empty bars. These are the fields that actually carry a record's
 *  identity across the six list collections, in the order a reader would pick
 *  one. `id` is last because it is a URL slug, not prose, and the numbered
 *  fallback is what a brand-new blank record gets until it is typed into. */
const NAME_KEYS = ['title', 'role', 'company', 'institution', 'label', 'name', 'id'];

export function recordName(record, collectionLabel, index) {
  for (const k of NAME_KEYS) {
    const v = record?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return `${collectionLabel} ${index + 1}`;
}

/** Which records are open, remembered across a reload and a collection switch.
 *
 *  Keyed by the record's own id where it has one, so reordering a list does
 *  not hand one record another's open state. Storage can throw (a private
 *  window, site data blocked), and an editor that will not render because it
 *  could not remember a disclosure state is worse than one that forgets, so
 *  every access is guarded and failure means "closed". */
const OPEN_KEY = 'admin:open';
function openSet() {
  try { return new Set(JSON.parse(sessionStorage.getItem(OPEN_KEY) || '[]')); }
  catch { return new Set(); }
}
function persistOpen(set) {
  try { sessionStorage.setItem(OPEN_KEY, JSON.stringify([...set])); } catch { /* not fatal */ }
}
export function openToken(collectionName, record, index) {
  const id = typeof record?.id === 'string' && record.id ? record.id : `#${index}`;
  return `${collectionName}/${id}`;
}

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
function itemBox(items, itemFields, i, ctx, collection, host, rerender, listKey) {
  const collectionLabel = collection.label;
  // A <details> rather than a hand-rolled toggle: it is keyboard operable and
  // announces its own expanded state with no script, it survives
  // prefers-reduced-motion because it animates nothing, and it costs a tag
  // instead of a state machine. The fields live in a body element rather than
  // directly under the <details> so drawFields, which clears `:scope > .field`
  // off the host it is given, can never reach the summary above them.
  const box = document.createElement('details'); box.className = 'list-item record';
  const head = document.createElement('summary'); head.className = 'row-controls record-head';
  const name = document.createElement('strong'); name.className = 'record-name';
  name.textContent = recordName(items[i], collectionLabel, i);
  head.appendChild(name);
  const mk = (text, label, act, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost'; b.textContent = text;
    b.dataset.act = act;
    b.setAttribute('aria-label', `${label} ${collectionLabel} ${i + 1}`);
    b.addEventListener('click', (e) => {
      // Inside a <summary>, a click that reaches the browser's default action
      // toggles the disclosure. Reordering a record must not also close it.
      e.preventDefault(); e.stopPropagation();
      fn(); rerender(); host.dispatchEvent(new Event('input', { bubbles: true }));
      // rerender() rebuilt every record, so the clicked button is gone and
      // focus is on <body>. Put it on the same control in the row that now
      // holds the reader's place.
      focusAfterMutation(rowsOf(host), destinationIndex(act, i, items.length), act,
        host.parentElement?.querySelector('.list-add'));
    });
    return b;
  };
  head.append(
    mk('↑', 'Move up', 'up', () => moveItem(items, i, i - 1)),
    mk('↓', 'Move down', 'down', () => moveItem(items, i, i + 1)),
    mk('Remove', 'Remove', 'remove', () => {
      const [gone] = items.splice(i, 1);
      announceRemoval(host, { list: items, index: i, item: gone, label: collectionLabel });
    }));
  box.appendChild(head);
  const body = document.createElement('div'); body.className = 'record-body';
  box.appendChild(body);

  const token = openToken(collection.name, items[i], i);
  box.dataset.open = token;
  box.open = openSet().has(token);
  box.addEventListener('toggle', () => {
    const set = openSet();
    if (box.open) set.add(token); else set.delete(token);
    persistOpen(set);
  });
  // The header is the only view of a record while it is closed, so it tracks
  // the field it is named after instead of freezing at render time.
  box.addEventListener('input', () => {
    name.textContent = recordName(items[i], collectionLabel, i);
  });

  const prefix = `${listKey}[${i}]`;
  // Redrawable, because picking a photograph writes five fields at once and
  // only one of them belongs to the control that did it — see fields.js's
  // ownsRecord. A record here is a whole project or company, so the group
  // holding its photograph rows answers first and this never runs for an
  // upload; it is here for the case where a top-level record carries an
  // image field of its own.
  const redraw = () => drawFields(document, body, itemFields, items[i], ctx, prefix);
  redraw();
  // Attached to the <details>, not the body: a rewrite bubbles up from a field
  // and this is the group that answers for the whole record. It redraws the
  // body, so the summary and its controls are never rebuilt underneath focus.
  ownsRecord(box, items[i], redraw);
  return box;
}

function listCollection(collection, model, ctx) {
  const fs = document.createElement('fieldset');
  const lg = document.createElement('legend'); lg.textContent = collection.label; fs.appendChild(lg);
  const items = Array.isArray(model[collection.listKey]) ? model[collection.listKey] : (model[collection.listKey] = []);
  const host = document.createElement('div');
  const rerender = () => {
    host.innerHTML = '';
    items.forEach((_, i) => host.appendChild(itemBox(items, collection.itemFields, i, ctx, collection, host, rerender, collection.listKey)));
  };
  rerender();

  // One control for the whole list, because the reason to collapse records is
  // to see the list, and doing that a record at a time defeats the point.
  const bulk = document.createElement('button');
  bulk.type = 'button'; bulk.className = 'btn ghost bulk-toggle';
  const syncBulk = () => {
    const open = [...host.querySelectorAll(':scope > details')].filter((d) => d.open).length;
    const shut = open === 0;
    bulk.textContent = shut ? 'Expand all' : 'Collapse all';
    bulk.setAttribute('aria-label', `${shut ? 'Expand' : 'Collapse'} all ${collection.label} records`);
  };
  bulk.addEventListener('click', () => {
    const shouldOpen = bulk.textContent === 'Expand all';
    for (const d of host.querySelectorAll(':scope > details')) d.open = shouldOpen;
    syncBulk();
  });
  host.addEventListener('toggle', syncBulk, true);
  syncBulk();

  const add = document.createElement('button');
  add.type = 'button'; add.className = 'btn list-add'; add.textContent = 'Add';
  add.setAttribute('aria-label', `Add ${collection.label}`);
  add.addEventListener('click', () => {
    items.push(blankValue({ type: 'object', fields: collection.itemFields }));
    rerender();
    // A record you just created is one you are about to type into.
    const last = host.lastElementChild;
    if (last && 'open' in last) last.open = true;
    syncBulk();
    host.dispatchEvent(new Event('input', { bubbles: true }));
  });
  lg.appendChild(bulk);
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
    // A record can be collapsed, and a message inside a closed <details> is
    // not rendered at all: without this, Save would report "3 problems to fix"
    // and point at nothing, and the focus below would land on a hidden control
    // and silently stay where it was. Every ancestor is opened, not just the
    // nearest, because a nested list inside a record is two deep.
    for (let n = field.parentElement; n; n = n.parentElement) {
      if (n.tagName === 'DETAILS') n.open = true;
    }
    if (!first) first = control || field;
  }
  if (first) first.focus?.();
  return errors.length;
}
