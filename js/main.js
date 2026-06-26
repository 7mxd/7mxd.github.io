import { loadData } from './data.js';
import { mountSections } from './render.js';
import { initTheme } from './theme.js';
import { initA11y } from './a11y.js';
import { initMotion } from './motion.js';

async function start() {
  const a11y = initA11y();
  initTheme({ announce: a11y.announce });
  try {
    const model = await loadData();
    document.title = model.settings?.siteTitle || document.title;
    mountSections(model);
    initMotion();
    window.__model = model; // consumed by graph init in a later task
    document.dispatchEvent(new CustomEvent('model:ready', { detail: model }));
  } catch (err) {
    console.error('Failed to load portfolio data', err);
    document.getElementById('summary')?.insertAdjacentHTML('afterbegin',
      '<p role="alert">Content failed to load. Please refresh.</p>');
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
