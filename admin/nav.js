/** The admin's own navigation: a list of what is actually on the timeline,
 *  in the order the timeline itself puts it, instead of a list of files.
 *
 *  Pure DOM construction, deliberately uncovered by tests (see
 *  admin/timeline-edit.js's header for why) — the logic worth testing, what
 *  a click resolves to and what "Add entry" produces, lives there. `doc` is
 *  threaded through rather than reading `document` directly so a later live
 *  preview can render this same nav into a second document. */
import { TIMELINE_KINDS } from './schema.js';

const el = (doc, tag, props = {}) => Object.assign(doc.createElement(tag), props);

function formatDate(entry) {
  if (!entry.badge) return String(entry.year ?? '');
  return entry.badge.month ? `${entry.badge.month} ${entry.badge.year}` : entry.badge.year;
}

/** Two lines per row, not one run-on string: a meta line (date, kind — muted,
 *  small) and the title beneath it (ink, the size an ordinary button reads
 *  at). Nineteen-plus same-weight, same-colour, middot-separated fragments
 *  read as a wall of text with nothing to scan by; splitting date/kind from
 *  title, and never accenting the meta line, gives a reader something to
 *  anchor on without putting the accent anywhere the site's own palette rule
 *  reserves for ink (dates and entry titles are ink there too).
 *
 *  Nothing here decides what "kind" a row is — `entry.kindLabel` is expected
 *  to already be the display string (app.js computes it, resolving a
 *  milestone's own record for "Certificate"/"Award"/"Volunteering" where
 *  buildTimeline's composed entry only ever says "milestone"), so this stays
 *  a plain map from entry to markup with no knowledge of collections. */
function pathGroup(doc, entries, onSelect, onAdd) {
  const group = el(doc, 'div', { className: 'nav-group' });
  group.appendChild(el(doc, 'h2', { className: 'nav-heading', textContent: 'The path' }));

  const list = el(doc, 'ul', { className: 'nav-list' });
  for (const entry of entries) {
    const li = el(doc, 'li');
    const btn = el(doc, 'button', { type: 'button', className: 'nav-entry' });
    const kindLabel = entry.kindLabel || entry.kind;
    btn.append(
      el(doc, 'span', { className: 'nav-entry-meta', textContent: `${formatDate(entry)} · ${kindLabel}` }),
      el(doc, 'span', { className: 'nav-entry-title', textContent: entry.title }));
    btn.dataset.entryId = entry.id;
    btn.setAttribute('aria-current', 'false');
    btn.addEventListener('click', () => onSelect(entry));
    li.appendChild(btn);
    list.appendChild(li);
  }
  group.appendChild(list);

  // A <label> wrapping its control needs no id to point at — the browser
  // already treats the select as the label's accessible control.
  const add = el(doc, 'label', { className: 'nav-add' });
  add.appendChild(el(doc, 'span', { textContent: 'Add entry' }));
  const select = el(doc, 'select');
  select.appendChild(el(doc, 'option', { value: '', textContent: 'Choose a kind…', selected: true, disabled: true }));
  for (const kind of TIMELINE_KINDS) {
    select.appendChild(el(doc, 'option', { value: kind.key, textContent: kind.label }));
  }
  select.addEventListener('change', () => {
    if (!select.value) return;
    onAdd(select.value);
    select.value = '';
  });
  add.appendChild(select);
  group.appendChild(add);

  return group;
}

function sectionsGroup(doc, sections, onSelect) {
  const group = el(doc, 'div', { className: 'nav-group' });
  const list = el(doc, 'ul', { className: 'nav-list' });
  for (const section of sections) {
    const li = el(doc, 'li');
    const btn = el(doc, 'button', { type: 'button', className: 'nav-section', textContent: section.label });
    btn.dataset.sectionName = section.name;
    btn.setAttribute('aria-current', 'false');
    btn.addEventListener('click', () => onSelect(section));
    li.appendChild(btn);
    list.appendChild(li);
  }
  group.appendChild(list);
  return group;
}

/** Draws the nav into a fragment: The path (every timeline entry, in site
 *  order, plus Add entry) followed by the sections that aren't on it.
 *  `onSelect` is called with whichever item was clicked — a timeline entry
 *  (carrying `.source`) or a section descriptor (`{ name, label }`); telling
 *  those apart and opening the right collection is app.js's job, since
 *  that's also where resolveEntry and the one-model-per-collection state
 *  live. `onAdd` is called with a TIMELINE_KINDS key. */
export function renderNav(doc, { sections, entries, onSelect, onAdd }) {
  const frag = doc.createDocumentFragment();
  frag.appendChild(pathGroup(doc, entries, onSelect, onAdd));
  frag.appendChild(sectionsGroup(doc, sections, onSelect));
  return frag;
}
