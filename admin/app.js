import { COLLECTIONS, getCollection, TIMELINE_KINDS } from './schema.js';
import { buildFormModel, modelToData } from './forms-model.js';
import { validateModel } from './validate.js';
import { serializeJson } from './lib.js';
import { createClient } from './github.js';
import { getToken, signIn, signOut } from './auth.js';
import { renderForm } from './forms.js';
import { renderBlocks } from './blocks-editor.js';
import { pickAndUpload } from './media.js';
import { buildTimeline } from '../js/timeline.js';
import { resolveEntry, newRecordFor, placeRecord, locate } from './timeline-edit.js';
import { renderNav } from './nav.js';

const $ = (id) => document.getElementById(id);
let client = null, registry = null, current = null;

// The four files the timeline composes from, plus everywhere else the
// timeline's own entries also live (projects, under Selected work). Every
// collection keeps exactly one model and one dirty flag here, keyed by name
// — opening a project from the path and from Selected work must land on the
// same in-memory record, or an edit made in one view disappears the moment
// the other one saves.
const models = {};
const shas = {};
const dirty = {};
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

/** Loads every collection's file, plus the block registry, in one pass —
 *  not just the four the timeline draws from. The live preview this admin is
 *  getting next needs every collection's data to render the page, and the
 *  timeline's own four files must be the very same in-memory objects the
 *  forms edit (see the `models` comment above). One loader that fetches
 *  everything keeps those two needs from drifting into two loaders that
 *  disagree; a per-section lazy fetch would only reintroduce that split. */
async function loadAll() {
  const [registryFile, ...files] = await Promise.all([
    client.getFile('data/blocks-registry.json'),
    ...COLLECTIONS.map((c) => client.getFile(c.file)),
  ]);
  registry = JSON.parse(registryFile.content);
  COLLECTIONS.forEach((c, i) => {
    const file = files[i];
    shas[c.name] = file.sha;
    const data = file.content ? JSON.parse(file.content) : (c.kind === 'list' ? { [c.listKey]: [] } : {});
    models[c.name] = buildFormModel(c, data);
    dirty[c.name] = false;
  });
}

async function boot() {
  $('signin').onclick = async () => { try { await signIn(); location.reload(); } catch(e){ $('login-error').textContent = e.message; } };
  $('signout').onclick = () => { signOut(); location.reload(); };
  const token = getToken();
  if (!token) return showLogin();
  client = createClient({ token });
  try { await loadAll(); }
  catch (e) { $('login-error').textContent = 'Failed to load content: '+e.message; return showLogin(); }
  showApp();
  (async () => {
    try {
      const r = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + getToken(), Accept: 'application/vnd.github+json' } });
      if (r.ok) { const u = await r.json(); document.getElementById('who').textContent = u.login ? '@' + u.login : ''; }
    } catch(_) {}
  })();
  $('panel').addEventListener('input', () => { if (current) dirty[current.name] = true; });
  buildNav();
  openCollection('profile');
}

/** Builds the timeline fresh from the four collections' own live models —
 *  not a separate fetch — so an edit already sitting in memory (a changed
 *  date, a newly added entry) shows up in the nav without a reload. */
function buildNav() {
  const entries = buildTimeline({
    experience: models.experience, education: models.education,
    projects: models.projects, milestones: models.milestones,
  }).flatMap((g) => g.entries);
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
 *  real risk, and it already covers every collection at once. */
function handleSelect(item) {
  if (item.source) {
    const { collection, record } = resolveEntry(item, models);
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
  const list = top.querySelector('[data-path="roles"] .list');
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
  setStatus('');
  const ctx = {
    registry, client, renderBlocks,
    // Task 10 replaces this with attachPhoto, which derives web-sized copies.
    uploadImage: async (file, record, field) => {
      record[field.name] = await pickAndUpload(client, file);
    },
    onError: (e) => setStatus('Upload failed: ' + e.message, 'error'),
  };
  renderForm($('panel'), current, models[current.name], ctx);
  markActive();
}

$('save').onclick = async () => {
  if (!current) return;
  const name = current.name;
  const errs = validateModel(current, models[name]);
  if (errs.length) { setStatus(errs[0].path+': '+errs[0].message, 'error'); return; }
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
