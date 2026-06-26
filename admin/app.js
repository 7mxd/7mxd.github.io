import { COLLECTIONS, getCollection } from './schema.js';
import { buildFormModel, modelToData } from './forms-model.js';
import { validateModel } from './validate.js';
import { serializeJson } from './lib.js';
import { createClient } from './github.js';
import { getToken, signIn, signOut } from './auth.js';
import { renderForm } from './forms.js';
import { renderBlocks } from './blocks-editor.js';
import { attachImageField } from './media.js';

const $ = (id) => document.getElementById(id);
let client = null, registry = null, current = null, model = null, sha = null, dirty = false;

function showLogin() { $('login').hidden = false; $('app').hidden = true; }
function showApp() { $('login').hidden = true; $('app').hidden = false; }
function setStatus(msg, state) { const el=$('save-status'); el.textContent=msg||''; el.dataset.state = state||''; }

async function boot() {
  $('signin').onclick = async () => { try { await signIn(); location.reload(); } catch(e){ $('login-error').textContent = e.message; } };
  $('signout').onclick = () => { signOut(); location.reload(); };
  const token = getToken();
  if (!token) return showLogin();
  client = createClient({ token });
  try { registry = (await client.getFile('data/blocks-registry.json')).content; registry = JSON.parse(registry); }
  catch (e) { $('login-error').textContent = 'Failed to load registry: '+e.message; return showLogin(); }
  showApp();
  $('panel').addEventListener('input', () => { dirty = true; });
  buildSidebar();
  selectCollection(COLLECTIONS[0].name);
}

function buildSidebar() {
  const nav = $('collections'); nav.innerHTML='';
  COLLECTIONS.forEach(c => { const b=document.createElement('button'); b.textContent=c.label; b.onclick=()=>{ if(guard()) selectCollection(c.name); }; b.dataset.name=c.name; nav.appendChild(b); });
}
function markActive(name) { $('collections').querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(b.dataset.name===name))); }
function guard() { if (dirty && !confirm('Discard unsaved changes?')) return false; dirty=false; return true; }

async function selectCollection(name) {
  current = getCollection(name); markActive(name); setStatus('Loading…');
  try {
    const file = await client.getFile(current.file);
    sha = file.sha;
    const data = file.content ? JSON.parse(file.content) : (current.kind==='list'? {[current.listKey]:[]} : {});
    model = buildFormModel(current, data);
    const ctx = { registry, client, renderBlocks, attachImageField };
    renderForm($('panel'), current, model, ctx);
    setStatus('');
    dirty = false;
  } catch (e) { setStatus('Load failed: '+e.message, 'error'); }
}

$('save').onclick = async () => {
  if (!current) return;
  const errs = validateModel(current, model);
  if (errs.length) { setStatus(errs[0].path+': '+errs[0].message, 'error'); return; }
  setStatus('Saving…'); $('save').disabled = true;
  try {
    const out = serializeJson(modelToData(current, model));
    const res = await client.putFile(current.file, out, sha, 'admin: update '+current.name);
    sha = res.content.sha; dirty = false; setStatus('Published ✓', 'ok');
  } catch (e) {
    if (e.conflict) setStatus('Conflict: file changed on GitHub. Reload the section to get the latest before saving.', 'error');
    else if (e.forbidden) setStatus('This GitHub account has no write access to the repo.', 'error');
    else setStatus('Save failed: '+e.message, 'error');
  } finally { $('save').disabled = false; }
};

window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue=''; } });
boot();
