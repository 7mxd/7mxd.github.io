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
import { resolveEntry, newRecordFor, placeRecord, locate } from './timeline-edit.js';
import { renderNav } from './nav.js';
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
// Collection name (or '*registry*') -> error message, for a file that failed
// to fetch or to parse. loadAll() never lets one bad file take the other
// eleven down with it; this is how the gap left in its place gets surfaced
// instead of silently editing (and risking saving over) an empty stand-in.
const loadErrors = {};
// Which specific path entry (if any) is the open one, for aria-current.
// Null when the open view is a whole-collection section rather than one row.
let activeEntryId = null;

// Interface labels: what kind of thing a row is, not anything Ahmed wrote.
// buildTimeline() only stamps the coarse kind (role/education/project/
// milestone) onto a composed entry — the finer milestone kind (certificate,
// award, volunteering) lives on the record behind it. Resolving every
// milestone row once, here, when the nav is (re)built is cheap — a find over
// well under thirty records — and keeps nav.js from needing to know that a
// milestone's real kind lives one hop away in a different file.
const KIND_LABELS = { role: 'Job', education: 'Education', project: 'Project' };
const MILESTONE_LABELS = { certification: 'Certificate', award: 'Award', volunteering: 'Volunteering' };

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

function setMobileView(view) {
  document.body.dataset.mobileView = view;
  $('view-form-btn').setAttribute('aria-pressed', String(view === 'form'));
  $('view-preview-btn').setAttribute('aria-pressed', String(view === 'preview'));
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
    dirty[current.name] = true;
    // A collection whose file failed to load is an empty stand-in — the
    // save handler below already refuses to write it back. Feeding its
    // edits to the preview would let the owner watch a fabricated record
    // fill in as though it were the real page, so it's left out here too;
    // the iframe keeps showing whatever it last rendered instead.
    if (!loadErrors[current.name]) preview.update(current.name, modelToData(current, models[current.name]));
  });
  $('view-form-btn').onclick = () => setMobileView('form');
  $('view-preview-btn').onclick = () => setMobileView('preview');
  setMobileView('form');
  buildNav();
  openCollection('profile');
  const failed = Object.keys(loadErrors);
  if (failed.length) {
    const names = failed.map((n) => (n === '*registry*' ? 'the block registry' : (getCollection(n)?.label || n)));
    setStatus(`Could not load: ${names.join(', ')}. Everything else is still editable.`, 'error');
  }
}

/** The display label for one row's kind. A milestone's own kind
 *  (certification/award/volunteering) only lives on the record, not on the
 *  entry buildTimeline composed, so labelling it precisely means resolving
 *  it — safe to do here even for an entry whose collection failed to load
 *  (resolveEntry then throws and this just falls back to "Milestone" rather
 *  than surfacing an error a user didn't ask for by looking at the nav). */
function kindLabelFor(entry) {
  if (entry.kind !== 'milestone') return KIND_LABELS[entry.kind] || entry.kind;
  try {
    const { record } = resolveEntry(entry, models);
    return MILESTONE_LABELS[record.kind] || 'Milestone';
  } catch (e) {
    return 'Milestone';
  }
}

/** Builds the timeline fresh from the four collections' own live models —
 *  not a separate fetch — so an edit already sitting in memory (a changed
 *  date, a newly added entry) shows up in the nav without a reload. */
function buildNav() {
  const entries = buildTimeline({
    experience: models.experience, education: models.education,
    projects: models.projects, milestones: models.milestones,
  }).flatMap((g) => g.entries).map((entry) => ({ ...entry, kindLabel: kindLabelFor(entry) }));
  const nav = renderNav(document, {
    sections: REMAINING_SECTIONS, entries,
    onSelect: handleSelect,
    onAdd: handleAdd,
  });
  const mount = $('collections');
  mount.innerHTML = '';
  mount.appendChild(nav);
  markActive();
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
    scrollToRecord(collection, record);
  } else {
    activeEntryId = null;
    openCollection(item.name);
  }
}

function handleAdd(kindKey) {
  const kind = TIMELINE_KINDS.find((k) => k.key === kindKey);
  if (!kind) return;
  const record = newRecordFor(kindKey, {});
  placeRecord(kindKey, record, models);
  dirty[kind.collection] = true;
  activeEntryId = null;
  openCollection(kind.collection);
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
  nodeFor(collectionName, record)?.scrollIntoView({ block: 'center' });
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
        record[field.name] = await pickAndUpload(client, file);
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

$('save').onclick = async () => {
  if (!current) return;
  const name = current.name;
  if (loadErrors[name]) {
    setStatus(`Cannot save ${current.label} — it failed to load, so this is an empty stand-in. Reload the page after fixing the file on GitHub.`, 'error');
    return;
  }
  const errs = validateModel(current, models[name]);
  if (errs.length) {
    showErrors(document, $('panel'), errs);
    setStatus(errs.length === 1 ? '1 problem to fix' : `${errs.length} problems to fix`, 'error');
    return;
  }
  showErrors(document, $('panel'), []);
  setStatus('Saving…'); $('save').disabled = true;
  try {
    const out = serializeJson(modelToData(current, models[name]));
    const res = await client.putFile(current.file, out, shas[name], 'admin: update '+name);
    shas[name] = res.content.sha; dirty[name] = false; setStatus('Published ✓', 'ok');
    // A save to any of the four timeline files can change a date, a title or
    // an order — anything The path's own ordering and labels depend on — so
    // it is rebuilt from the models saved, not just cleared of the dirty flag.
    if (TIMELINE_COLLECTIONS.has(name)) buildNav();
  } catch (e) {
    if (e.conflict) setStatus('Conflict: file changed on GitHub. Reload the section to get the latest before saving.', 'error');
    else if (e.forbidden) setStatus('This GitHub account has no write access to the repo.', 'error');
    else setStatus('Save failed: '+e.message, 'error');
  } finally { $('save').disabled = false; }
};

window.addEventListener('beforeunload', (e) => {
  if (Object.values(dirty).some(Boolean)) { e.preventDefault(); e.returnValue=''; }
});
boot();
