import { loadData } from './data.js';
import { mountSections, renderPanel } from './render.js';
import { initTheme } from './theme.js';
import { initA11y } from './a11y.js';
import { initMotion } from './motion.js';
import { detect, chooseInitialMode } from './capabilities.js';

const $ = (id) => document.getElementById(id);
let model = null, world = null, caps = null, a11y = null;

function setMode(mode, announce) {
  document.body.dataset.mode = mode;
  const btn = document.querySelector('[data-mode-toggle]');
  if (btn) { btn.textContent = mode === 'explore' ? 'Read / CV' : 'Explore'; btn.setAttribute('aria-pressed', String(mode === 'explore')); }
  $('explore')?.setAttribute('aria-hidden', String(mode !== 'explore'));
  if (mode === 'explore') { ensureWorld(); world && world.start && world.start(); }
  else { world && world.stop && world.stop(); }
  if (announce && a11y) a11y.announce(mode === 'explore' ? '3D explore mode' : 'Reading mode');
}

async function ensureWorld() {
  if (world || !caps.webgl) return;
  try {
    const { createWorld } = await import('./scene/world.js');
    world = await createWorld($('scene-canvas'), model, {
      reducedMotion: caps.reducedMotion, lowPower: caps.lowPower, onSelectEntity: openPanel
    });
  } catch (err) {
    console.error('3D failed to load; staying in Read mode', err);
    caps.webgl = false; setMode('read');
  }
}

function openPanel(node) {
  if (!node?.ref) return;
  const { section, index } = node.ref;
  const kindMap = { projects:'projects', experience:'experience', education:'education' };
  const item = model[section]?.[index];
  if (!item || !kindMap[section]) return;
  $('panel-body').innerHTML = renderPanel(item, kindMap[section], model.settings?.statuses || {});
  const panel = $('panel'); panel.hidden = false; $('panel-close').focus();
}
function closePanel() { const p = $('panel'); if (p) { p.hidden = true; world && world.resetView && world.resetView(); } }

async function start() {
  a11y = initA11y();
  initTheme({ announce: a11y.announce, defaultTheme: 'auto' });
  caps = detect();
  try {
    model = await loadData();
    document.title = model.settings?.siteTitle || document.title;
    mountSections(model);          // Read view
    initMotion();
    // toggles
    document.querySelector('[data-mode-toggle]')?.addEventListener('click', () => {
      setMode(document.body.dataset.mode === 'explore' ? 'read' : 'explore', true);
    });
    $('panel-close')?.addEventListener('click', () => { closePanel(); });
    document.querySelectorAll('[data-goto-read]').forEach(el => el.addEventListener('click', () => setMode('read', true)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
    setMode(chooseInitialMode(caps), false);
  } catch (err) {
    console.error('Failed to load portfolio data', err);
    setMode('read');
    $('summary')?.querySelector('.section-body')?.insertAdjacentHTML('afterbegin', '<p role="alert">Content failed to load. Please refresh.</p>');
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
