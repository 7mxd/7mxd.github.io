import { loadSiteData } from './data.js';
import { buildTimeline } from './timeline.js';
import { initTheme } from './theme.js';
import { renderAll } from './render.js';

/** Mark keyboard users so focus rings appear only when they are useful. */
function trackKeyboardUse(doc) {
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') doc.documentElement.classList.add('using-keyboard');
  });
  doc.addEventListener('pointerdown', () => {
    doc.documentElement.classList.remove('using-keyboard');
  });
}

function initMobileNav(doc) {
  const toggle = doc.querySelector('.nav-menu-toggle');
  const links = doc.getElementById('nav-links');
  if (!toggle || !links) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    links.classList.toggle('is-open', open);
    doc.body.classList.toggle('nav-open', open);
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });
  links.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
}

async function boot() {
  initTheme(document, window.localStorage, window.matchMedia('(prefers-color-scheme: dark)'));
  trackKeyboardUse(document);
  initMobileNav(document);

  try {
    const data = await loadSiteData();
    renderAll(document, data, buildTimeline(data));
  } catch (error) {
    console.error(error);
    const main = document.getElementById('main');
    if (main) {
      main.innerHTML = '<p class="load-error">The page content could not be loaded. Please refresh.</p>';
    }
  } finally {
    // Marks the moment this page's own first render — success or failure —
    // has landed. The admin's live preview (admin/preview.js) loads this
    // same page in an iframe and must not paint an edit before this point,
    // or this render would land after it and silently overwrite it.
    document.documentElement.dataset.rendered = 'true';
    document.dispatchEvent(new Event('site:rendered'));
  }
}

boot();
