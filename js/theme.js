/** Theme selection. The pure helpers are unit tested; initTheme wires the DOM. */

const THEMES = ['light', 'dark'];
const KEY = 'theme';

export function nextTheme(current) {
  return current === 'dark' ? 'light' : 'dark';
}

export function resolveTheme(stored, prefersDark) {
  if (THEMES.includes(stored)) return stored;
  return prefersDark ? 'dark' : 'light';
}

/** Announce the change so screen reader users hear it, matching prior behaviour. */
function announce(doc, theme) {
  const region = doc.getElementById('sr-status');
  if (region) region.textContent = `${theme} mode`;
}

export function initTheme(doc, storage, media) {
  const root = doc.documentElement;
  const button = doc.querySelector('.theme-toggle');

  const apply = (theme, { announceIt = false } = {}) => {
    root.setAttribute('data-theme', theme);
    if (button) button.setAttribute('aria-pressed', String(theme === 'dark'));
    if (announceIt) announce(doc, theme);
  };

  let stored = null;
  try { stored = storage.getItem(KEY); } catch { stored = null; }
  apply(resolveTheme(stored, media.matches));

  if (button) {
    button.addEventListener('click', () => {
      const theme = nextTheme(root.getAttribute('data-theme'));
      try { storage.setItem(KEY, theme); } catch { /* private mode */ }
      apply(theme, { announceIt: true });
    });
  }

  // Follow the system only while the visitor has expressed no preference.
  media.addEventListener('change', (event) => {
    let saved = null;
    try { saved = storage.getItem(KEY); } catch { saved = null; }
    if (!THEMES.includes(saved)) apply(event.matches ? 'dark' : 'light');
  });
}
