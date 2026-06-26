export function chooseTheme(stored, prefersDark) {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}
export function nextTheme(cur) { return cur === 'dark' ? 'light' : 'dark'; }

export function initTheme({ announce = () => {}, defaultTheme = 'auto' } = {}) {
  const root = document.documentElement;
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  let theme = chooseTheme(localStorage.getItem('theme') || defaultTheme, mql.matches);
  const apply = (t) => { root.setAttribute('data-theme', t); };
  apply(theme);
  const btn = document.querySelector('[data-theme-toggle]');
  if (btn) {
    btn.addEventListener('click', () => {
      theme = nextTheme(theme);
      localStorage.setItem('theme', theme);
      apply(theme);
      announce(`${theme} theme enabled`);
    });
  }
  return { get: () => theme };
}
