import { loadData } from './data.js';
import { mountSections } from './render.js';
import { initTheme } from './theme.js';
import { initA11y } from './a11y.js';
import { initMotion } from './motion.js';
import { initGraph } from './graph-view.js';

async function start() {
  const a11y = initA11y();
  // Apply theme immediately (before data fetch) to avoid a flash of the wrong theme.
  // settings.theme defaults to 'auto', so localStorage + prefers-color-scheme are authoritative here.
  initTheme({ announce: a11y.announce, defaultTheme: 'auto' });
  try {
    const model = await loadData();
    document.title = model.settings?.siteTitle || document.title;
    mountSections(model);
    initMotion();
    initGraph(model, document.getElementById('graph-canvas'));
  } catch (err) {
    console.error('Failed to load portfolio data', err);
    document.getElementById('summary')?.insertAdjacentHTML('afterbegin',
      '<p role="alert">Content failed to load. Please refresh.</p>');
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
