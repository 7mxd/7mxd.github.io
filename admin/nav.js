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

/** The "unsaved changes" mark, built hidden on every row and revealed by
 *  markUnsaved below.
 *
 *  A word, not a dot and not a colour: twelve collections share one Save
 *  button, so which sections still hold unpublished work has to be legible
 *  before anything is pressed, to a screen reader as well as to an eye. The
 *  text is inside the button, so it is part of the button's accessible name.
 *  It is toggled with the `hidden` attribute rather than a class, which is
 *  also why admin.css gives .nav-dirty no `display` of its own — an
 *  unconditional one would out-cascade the user agent's [hidden] rule and the
 *  mark would never go away. */
function dirtyMark(doc) {
  const mark = el(doc, 'span', { className: 'nav-dirty', textContent: 'Unsaved' });
  mark.hidden = true;
  return mark;
}

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
    const meta = el(doc, 'span', { className: 'nav-entry-meta', textContent: `${formatDate(entry)} · ${kindLabel}` });
    meta.appendChild(dirtyMark(doc));
    btn.append(meta, el(doc, 'span', { className: 'nav-entry-title', textContent: entry.title }));
    btn.dataset.entryId = entry.id;
    // Which file this row lives in, so markUnsaved can find every row that a
    // given collection's unsaved edits belong to without re-resolving it.
    if (entry.collection) btn.dataset.collection = entry.collection;
    btn.setAttribute('aria-current', 'false');
    btn.addEventListener('click', () => onSelect(entry));
    li.appendChild(btn);
    list.appendChild(li);
  }
  group.appendChild(list);

  // Choosing a kind states an intent; a separate button commits it.
  //
  // These used to be the same act: `change` on the select called onAdd
  // directly. On Windows, arrow-keying a closed <select> fires `change` on
  // every option it passes, so reaching Volunteering past Experience,
  // Education, Project and Certificate created four blank records in four
  // different collections — each of which then failed validation and blocked
  // Save for every section, with no indication of where they had come from.
  const add = el(doc, 'div', { className: 'nav-add' });
  // A <label> wrapping its control needs no id to point at — the browser
  // already treats the select as the label's accessible control. The button
  // stays outside it, or clicking the button would activate the label and
  // throw focus back into the select.
  const lab = el(doc, 'label', { className: 'nav-add-label' });
  lab.appendChild(el(doc, 'span', { textContent: 'Add entry' }));
  const select = el(doc, 'select');
  select.appendChild(el(doc, 'option', { value: '', textContent: 'Choose a kind…', selected: true, disabled: true }));
  for (const kind of TIMELINE_KINDS) {
    select.appendChild(el(doc, 'option', { value: kind.key, textContent: kind.label }));
  }
  lab.appendChild(select);
  const commit = el(doc, 'button', { type: 'button', className: 'btn nav-add-commit', textContent: 'Add entry' });
  commit.disabled = true;
  select.addEventListener('change', () => { commit.disabled = !select.value; });
  commit.addEventListener('click', () => {
    if (!select.value) return;
    const kind = select.value;
    select.value = '';
    commit.disabled = true;
    onAdd(kind);
  });
  add.append(lab, commit);
  group.appendChild(add);

  return group;
}

function sectionsGroup(doc, sections, onSelect) {
  const group = el(doc, 'div', { className: 'nav-group' });
  const list = el(doc, 'ul', { className: 'nav-list' });
  for (const section of sections) {
    const li = el(doc, 'li');
    const btn = el(doc, 'button', { type: 'button', className: 'nav-section' });
    btn.append(doc.createTextNode(section.label), dirtyMark(doc));
    btn.dataset.sectionName = section.name;
    btn.dataset.collection = section.name;
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

/** Reveals the "Unsaved" mark on every row whose collection has unpublished
 *  edits. `isDirty` is called with a collection name.
 *
 *  Switching sections is frictionless and warns about nothing, so before this
 *  the only trace of an edit in a section you were no longer looking at was
 *  the preview — which reads every model and therefore showed the change as
 *  though it were already live. Nothing said otherwise, and the browser's own
 *  unload warning is dismissed by someone who did just press Save. */
export function markUnsaved(root, isDirty) {
  for (const btn of root.querySelectorAll('[data-collection]')) {
    const mark = btn.querySelector('.nav-dirty');
    if (mark) mark.hidden = !isDirty(btn.dataset.collection);
  }
}
