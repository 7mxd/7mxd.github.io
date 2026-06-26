export function initA11y() {
  const live = document.createElement('div');
  live.setAttribute('aria-live', 'polite');
  live.className = 'sr-only';
  document.body.appendChild(live);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') document.documentElement.classList.add('using-keyboard');
  });
  window.addEventListener('mousedown', () => {
    document.documentElement.classList.remove('using-keyboard');
  });
  return { announce: (msg) => { live.textContent = ''; live.textContent = msg; } };
}
