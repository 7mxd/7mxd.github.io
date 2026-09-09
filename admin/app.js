import { COLLECTIONS, getCollection, TIMELINE_KINDS } from './schema.js';
import { buildFormModel, modelToData } from './forms-model.js';
import { validateModel } from './validate.js';
import { serializeJson } from './lib.js';
import { createClient } from './github.js';
import { getToken, signIn, signOut } from './auth.js';
import { renderForm, showErrors } from './forms.js';
import { renderBlocks } from './blocks-editor.js';
import { pickAndUpload } from './media.js';
import { attachPhoto } from './photos.js';
import { buildTimeline } from '../js/timeline.js';
import { kindLabel } from '../js/render.js';
import { resolveEntry, newRecordFor, placeRecord, locate } from './timeline-edit.js';
import { renderNav, markUnsaved } from './nav.js';
import { createPreview } from './preview.js';

const $ = (id) => document.getElementById(id);
let client = null, registry = null, current = null, preview = null;

// The four files the timeline composes from, plus everywhere else the
// timeline's own entries also live (projects, under Selected work). Every
// collection keeps exactly one model and one dirty flag here, keyed by name
// — opening a project from the path and from Selected work must land on the
// same in-memory record, or an edit made in one view disappears the moment
// the other one saves.
const models = {};
const shas = {};
const dirty = {};
// Bumped on every edit to a collection (the panel's own `input` listener
// below, plus handleAdd — the two places `models` is mutated outside a load).
// The save loop reads it before serializing a collection and again after its
// PUT resolves: an edit typed during that await bumps it, and a serial that
// moved says the snapshot just written is already stale, so the dirty flag
// must survive the clear that would otherwise follow.
const editSerial = {};
// Collection name (or '*registry*') -> error message, for a file that failed
// to fetch or to parse. loadAll() never lets one bad file take the other
// eleven down with it; this is how the gap left in its place gets surfaced
// instead of silently editing (and risking saving over) an empty stand-in.
const loadErrors = {};
// Which specific path entry (if any) is the open one, for aria-current.
// Null when the open view is a whole-collection section rather than one row.
let activeEntryId = null;

// Structural interface labels, not content: "Selected work" and "About" are
// how the nav names these sections, distinct from the panel legend text
// admin/schema.js's `label` still supplies (e.g. "Projects"). The four
// timeline files (education, experience, projects, milestones) are not
// listed here — they are reached through The path instead, except projects,
// which the spec keeps in both places on purpose.
const REMAINING_SECTIONS = [
  { name: 'projects', label: 'Selected work' },
  { name: 'profile', label: 'Profile' },
  { name: 'summary', label: 'About' },
  { name: 'skills', label: 'Skills' },
  { name: 'metrics', label: 'Numbers' },
  { name: 'settings', label: 'Settings' },
];

const TIMELINE_COLLECTIONS = new Set(['experience', 'education', 'projects', 'milestones']);

function showLogin() { $('login').hidden = false; $('app').hidden = true; }
function showApp() { $('login').hidden = true; $('app').hidden = false; }
function setStatus(msg, state) { const el=$('save-status'); el.textContent=msg||''; el.dataset.state = state||''; }

/** The empty stand-in for a collection whose file failed to load — the same
 *  shape selectCollection already used for a brand-new (404) file, so the
 *  rest of the app (renderForm, validateModel, buildTimeline) sees an
 *  ordinary empty collection rather than undefined. */
function emptyModel(c) { return c.kind === 'list' ? { [c.listKey]: [] } : {}; }

/** Loads every collection's file, plus the block registry, in one pass —
 *  not just the four the timeline draws from. The live preview this admin is
 *  getting next needs every collection's data to render the page, and the
 *  timeline's own four files must be the very same in-memory objects the
 *  forms edit (see the `models` comment above). One loader that fetches
 *  everything keeps those two needs from drifting into two loaders that
 *  disagree; a per-section lazy fetch would only reintroduce that split.
 *
 *  It settles rather than rejects: before this task, one file's fetch failed
 *  in isolation and only the registry gated boot at all. A bare Promise.all
 *  over twelve files would regress that — one malformed file (a network
 *  failure, or JSON a hand edit broke) would reject the whole batch, boot's
 *  catch would bounce the owner back to the sign-in screen, and nothing
 *  would be editable. So every file gets its own try/catch: a failure
 *  records itself in `loadErrors` and the collection gets an empty stand-in
 *  instead of stopping the other eleven. */
async function loadAll() {
  const results = await Promise.allSettled([
    client.getFile('data/blocks-registry.json'),
    ...COLLECTIONS.map((c) => client.getFile(c.file)),
  ]);
  const [registryResult, ...fileResults] = results;
  try {
    if (registryResult.status !== 'fulfilled') throw registryResult.reason;
    registry = JSON.parse(registryResult.value.content);
  } catch (e) {
    registry = {};
    loadErrors['*registry*'] = e.message || String(e);
  }
  COLLECTIONS.forEach((c, i) => {
    const result = fileResults[i];
    try {
      if (result.status !== 'fulfilled') throw result.reason;
      const file = result.value;
      shas[c.name] = file.sha;
      const data = file.content ? JSON.parse(file.content) : emptyModel(c);
      models[c.name] = buildFormModel(c, data);
    } catch (e) {
      models[c.name] = buildFormModel(c, emptyModel(c));
      loadErrors[c.name] = e.message || String(e);
    }
    dirty[c.name] = false;
    editSerial[c.name] = 0;
  });
}

/** The full ten-key site dataset js/data.js's validateSiteData names
 *  (profile, summary, settings, experience, education, projects,
 *  milestones, metrics, skills, registry), assembled from every
 *  collection's own live model — the same objects the forms edit, kept in
 *  `models` above — plus the block registry. Nothing here is fetched again:
 *  loadAll() already put everything in memory, so the preview reads exactly
 *  what the forms are editing and can never see a stale copy of it. */
function buildPreviewBase() {
  const data = { registry };
  for (const c of COLLECTIONS) data[c.name] = modelToData(c, models[c.name]);
  return data;
}

// Below the 700px breakpoint the rail, the form and the preview each take the
// whole screen and this says which one is showing. The rail is in the group
// because at phone width it was a permanent 41% of the viewport above a
// squeezed form — see the media query in admin/admin.css. Above the
// breakpoint the toggle is display:none and this attribute changes nothing.
const MOBILE_VIEWS = [['path', 'view-path-btn'], ['form', 'view-form-btn'], ['preview', 'view-preview-btn']];

function setMobileView(view) {
  document.body.dataset.mobileView = view;
  for (const [name, id] of MOBILE_VIEWS) $(id).setAttribute('aria-pressed', String(view === name));
}

async function boot() {
  $('signin').onclick = async () => { try { await signIn(); location.reload(); } catch(e){ $('login-error').textContent = e.message; } };
  $('signout').onclick = () => { signOut(); location.reload(); };
  const token = getToken();
  if (!token) return showLogin();
  client = createClient({ token });
  // loadAll() no longer throws — a failed file becomes a loadErrors entry
  // and an empty stand-in, not a reason to bounce the owner to sign-in.
  await loadAll();
  showApp();
  (async () => {
    try {
      const r = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + getToken(), Accept: 'application/vnd.github+json' } });
      if (r.ok) { const u = await r.json(); document.getElementById('who').textContent = u.login ? '@' + u.login : ''; }
    } catch(_) {}
  })();
  preview = createPreview($('preview'), buildPreviewBase);
  $('panel').addEventListener('input', () => {
    if (!current) return;
    editSerial[current.name] = (editSerial[current.name] || 0) + 1;
    if (!dirty[current.name]) { dirty[current.name] = true; refreshDirtyMarks(); }
    // A collection whose file failed to load is an empty stand-in — the
    // save handler below already refuses to write it back. Feeding its
    // edits to the preview would let the owner watch a fabricated record
    // fill in as though it were the real page, so it's left out here too;
    // the iframe keeps showing whatever it last rendered instead.
    if (!loadErrors[current.name]) preview.update(current.name, modelToData(current, models[current.name]));
  });
  for (const [name, id] of MOBILE_VIEWS) $(id).onclick = () => setMobileView(name);
  setMobileView('form');
  buildNav();
  openCollection('profile');
  const failed = Object.keys(loadErrors);
  if (failed.length) {
    const names = failed.map((n) => (n === '*registry*' ? 'the block registry' : (getCollection(n)?.label || n)));
    setStatus(`Could not load: ${names.join(', ')}. Everything else is still editable.`, 'error');
  }
}

/** Builds the timeline fresh from the four collections' own live models —
 *  not a separate fetch — so an edit already sitting in memory (a changed
 *  date, a newly added entry) shows up in the nav without a reload. */
function buildNav() {
  const entries = buildTimeline({
    experience: models.experience, education: models.education,
    projects: models.projects, milestones: models.milestones,
  }).flatMap((g) => g.entries).map((entry) => ({
    ...entry,
    // js/render.js's kindLabel reads milestoneKind straight off the composed
    // entry now, so no per-row lookup back into `models` is needed here.
    kindLabel: kindLabel(entry),
    // Which file the row's record lives in, so the nav can mark every row
    // belonging to a collection with unsaved edits.
    collection: entry.source?.collection,
  }));
  const nav = renderNav(document, {
    sections: REMAINING_SECTIONS, entries,
    onSelect: handleSelect,
    onAdd: handleAdd,
  });
  const mount = $('collections');
  mount.innerHTML = '';
  mount.appendChild(nav);
  markActive();
  refreshDirtyMarks();
}

/** Which sections hold unpublished work, shown on the rail. Called whenever a
 *  dirty flag actually changes rather than on every keystroke: the marks are
 *  toggled in place on the existing buttons, so this costs a querySelectorAll
 *  over ~25 rows and never rebuilds the nav or moves its scroll. */
function refreshDirtyMarks() {
  markUnsaved($('collections'), (name) => !!dirty[name]);
}

function markActive() {
  $('collections').querySelectorAll('[data-entry-id]').forEach((b) => {
    b.setAttribute('aria-current', String(b.dataset.entryId === activeEntryId));
  });
  $('collections').querySelectorAll('[data-section-name]').forEach((b) => {
    b.setAttribute('aria-current', String(!activeEntryId && current && b.dataset.sectionName === current.name));
  });
}

/** A path entry click: resolveEntry finds the record, this opens its file
 *  and scrolls to it. A section click: just opens that collection's form.
 *  Nothing here can lose unsaved work — switching does not re-fetch, it
 *  reveals the same cached model the previous view was editing — so unlike
 *  the old per-file sidebar, there is no discard-changes prompt to guard the
 *  switch with. beforeunload below is where losing unsaved work is still a
 *  real risk, and it already covers every collection at once.
 *
 *  resolveEntry throws for a ghost entry — stale data, or a record a hand
 *  edit deleted straight out of the JSON file. Left uncaught, that throw
 *  happens inside this click handler: a console error and nothing the owner
 *  ever sees, which is exactly the silent failure this task exists to
 *  prevent. Caught here and named on the status line instead. */
function handleSelect(item) {
  if (item.source) {
    let resolved;
    try {
      resolved = resolveEntry(item, models);
    } catch (e) {
      setStatus(`Could not open "${item.title}": ${e.message}`, 'error');
      return;
    }
    const { collection, record } = resolved;
    activeEntryId = item.id;
    openCollection(collection);
    // Before scrollToRecord, not after: at phone width the rail is a full
    // screen of its own, so picking something on it has to hand the screen
    // back to the form — and a panel still display:none has no geometry to
    // scroll. Above the breakpoint both are visible and this changes nothing.
    setMobileView('form');
    scrollToRecord(collection, record);
  } else {
    activeEntryId = null;
    openCollection(item.name);
    setMobileView('form');
  }
}

function handleAdd(kindKey) {
  const kind = TIMELINE_KINDS.find((k) => k.key === kindKey);
  if (!kind) return;
  const record = newRecordFor(kindKey, {});
  placeRecord(kindKey, record, models);
  editSerial[kind.collection] = (editSerial[kind.collection] || 0) + 1;
  dirty[kind.collection] = true;
  activeEntryId = null;
  openCollection(kind.collection);
  setMobileView('form');
  focusRecord(kind.collection, record);
  buildNav();
}

/** The DOM node forms.js built for one record, found the same way
 *  timeline-edit.js's `locate` addresses it in the model: by position, since
 *  document order mirrors array order at every level forms.js and fields.js
 *  render lists in. */
function nodeFor(collectionName, record) {
  const loc = locate(collectionName, record, models);
  if (!loc) return null;
  const host = $('panel').querySelector('fieldset > div');
  const top = host?.children[loc.index];
  if (!top) return null;
  if (loc.roleIndex == null) return top;
  // `top` is already scoped to this one company, so its roles field's full
  // path (`items[3].roles`, now that fields.js's renderField stamps the
  // composed path rather than the bare field name) is matched by its
  // ending rather than re-deriving the exact prefix here.
  const list = top.querySelector('[data-path$=".roles"] .list');
  return list?.children[loc.roleIndex] || null;
}

function scrollToRecord(collectionName, record) {
  const node = nodeFor(collectionName, record);
  if (!node) return;
  // Records collapse, so the one the rail just asked for has to be opened
  // before it is scrolled to — otherwise picking an entry scrolls to a closed
  // header and looks like the click did nothing. Ancestors too: a role sits
  // inside a company's own disclosure.
  for (let n = node; n; n = n.parentElement) {
    if (n.tagName === 'DETAILS') n.open = true;
  }
  node.scrollIntoView({ block: 'center' });
}

function focusRecord(collectionName, record) {
  const node = nodeFor(collectionName, record);
  if (!node) return;
  node.scrollIntoView({ block: 'center' });
  node.querySelector('input, textarea, select')?.focus();
}

function openCollection(name) {
  current = getCollection(name);
  const ctx = {
    registry, client, renderBlocks,
    // A photograph's large source is always named `src` — in both
    // admin/schema.js's imageFields and the block registry's `image` block —
    // so route on the field name: `src` gets resized, uprighted, and has all
    // five fields (src, srcSmall, width, height, widthSmall) filled by
    // attachPhoto; everything else (a logo's default/light/dark, an SVG)
    // goes through pickAndUpload unchanged.
    uploadImage: async (file, record, field) => {
      if (field.name === 'src') {
        await attachPhoto(file, record, field, client);
      } else {
        // The field's own `accept` decides what pickAndUpload will take, so
        // Settings' CV field gets a PDF and everything else stays an image.
        record[field.name] = await pickAndUpload(client, file, field.accept);
      }
    },
    onError: (e) => setStatus('Upload failed: ' + e.message, 'error'),
  };
  renderForm($('panel'), current, models[current.name], ctx);
  // A collection whose file failed to load renders an empty form here —
  // say so every time it's opened, not just once at boot, and loudly enough
  // that saving it (which the button below refuses) reads as the wrong move.
  if (loadErrors[name]) {
    setStatus(`${current.label} failed to load (${loadErrors[name]}) — this is an empty stand-in, not the real file. Reload the page after fixing it; do not save.`, 'error');
  } else {
    setStatus('');
  }
  markActive();
}

const labelsOf = (cs) => cs.map((c) => c.label).join(', ');

function putErrorText(e) {
  if (e.conflict) return 'the file changed on GitHub — reload to get the latest before saving';
  if (e.forbidden) return 'this GitHub account has no write access to the repo';
  return e.message;
}

/** Save publishes every collection with unsaved edits, not just the open one.
 *
 *  Twelve models share one Save button and switching between them is
 *  frictionless, so binding the button to the open collection alone lost work
 *  in the most convincing way possible: edit the tagline in Profile, click a
 *  certificate on the path, fix a typo, press Save. Milestones publishes,
 *  Profile does not, nothing says so, and the preview — which reads every
 *  model — still shows the tagline change, so the strongest signal on the
 *  page says it is live. beforeunload is then dismissed by someone who did
 *  just save.
 *
 *  COLLECTIONS order, so a batch that fails partway is reproducible rather
 *  than dependent on which section was opened first. Everything is validated
 *  before anything is written: publishing four files and stopping at a fifth
 *  that never validated would leave the site half-updated. */
$('save').onclick = async () => {
  // A collection whose file failed to load is an empty stand-in — writing it
  // back would replace the real file with nothing. It is refused, by name,
  // exactly as it was before, and left out of the batch.
  const blocked = COLLECTIONS.filter((c) => dirty[c.name] && loadErrors[c.name]);
  const targets = COLLECTIONS.filter((c) => dirty[c.name] && !loadErrors[c.name]);
  const blockedNote = blocked.length
    ? ` Cannot save ${labelsOf(blocked)} — the file failed to load, so it is an `
      + 'empty stand-in. Reload the page after fixing it on GitHub.'
    : '';
  if (!targets.length) {
    setStatus(blocked.length ? blockedNote.trim() : 'Nothing to publish — no unsaved changes.',
      blocked.length ? 'error' : '');
    return;
  }

  const failures = targets
    .map((c) => ({ c, errs: validateModel(c, models[c.name]) }))
    .filter((f) => f.errs.length);
  if (failures.length) {
    // Open the first collection that failed and show its errors at the
    // fields, the same as the single-collection flow did; name the rest, so
    // nothing is left to be discovered by pressing Save again.
    const [first, ...rest] = failures;
    if (current?.name !== first.c.name) { activeEntryId = null; openCollection(first.c.name); }
    // Save can be pressed from the Preview or Path view, not just Form — the
    // button isn't gated by the mobile toggle the way the panel is. Below
    // 700px the panel these errors attach to, and the control they focus, sit
    // in a view that's display:none until this switches it, same as
    // handleSelect and handleAdd already do before touching the panel.
    setMobileView('form');
    showErrors(document, $('panel'), first.errs);
    const n = first.errs.length;
    setStatus(`${n} problem${n === 1 ? '' : 's'} to fix in ${first.c.label}`
      + (rest.length ? `. Also to fix: ${labelsOf(rest.map((f) => f.c))}.` : '.'), 'error');
    return;
  }
  showErrors(document, $('panel'), []);

  setStatus(targets.length === 1 ? 'Saving…' : `Saving ${targets.length} sections…`);
  $('save').disabled = true;
  const saved = [];
  let failed = null;
  try {
    for (const c of targets) {
      try {
        // Captured before the write, not after: an edit landing during the
        // await below bumps this, and the write in flight was serialized from
        // the model as it stood before that edit — so the edit was never
        // sent. Clearing dirty on an unchanged serial would tell the rest of
        // the app the file is clean when the newest keystroke is still only
        // on screen.
        const serial = editSerial[c.name];
        const out = serializeJson(modelToData(c, models[c.name]));
        const res = await client.putFile(c.file, out, shas[c.name], 'admin: update ' + c.name);
        shas[c.name] = res.content.sha;
        if (editSerial[c.name] === serial) dirty[c.name] = false;
        saved.push(c);
      } catch (e) {
        // Stop rather than carry on: a conflict means the repo moved under
        // this session and a 403 means none of the remaining writes can
        // succeed either. What matters is that the owner is told exactly
        // which files went and which did not, never left to guess.
        failed = { c, e };
        break;
      }
    }
  } finally { $('save').disabled = false; }

  if (!failed) {
    // blockedNote already opens with its own leading space ("Cannot save…")
    // but no sentence before it ends in a terminator — labelsOf(saved) is
    // just a name list — so without this period the two run together as
    // "Published ✓ Profile Cannot save Summary — …".
    setStatus(`Published ✓ ${labelsOf(saved)}${blocked.length ? '.' : ''}${blockedNote}`, blocked.length ? 'error' : 'ok');
  } else {
    const remaining = targets.slice(targets.indexOf(failed.c) + 1);
    setStatus(
      (saved.length ? `Published ${labelsOf(saved)}. ` : '')
      + `${failed.c.label} failed: ${putErrorText(failed.e)}.`
      + (remaining.length ? ` Not published: ${labelsOf(remaining)}.` : '')
      + blockedNote,
      'error');
  }
  // A save to any of the four timeline files can change a date, a title or an
  // order — anything The path's own ordering and labels depend on — so the
  // nav is rebuilt from the models saved. buildNav refreshes the unsaved
  // marks on its way out; when nothing on the timeline moved, they are all
  // that needs updating.
  if (saved.some((c) => TIMELINE_COLLECTIONS.has(c.name))) buildNav();
  else refreshDirtyMarks();
};

window.addEventListener('beforeunload', (e) => {
  if (Object.values(dirty).some(Boolean)) { e.preventDefault(); e.returnValue=''; }
});
boot();
