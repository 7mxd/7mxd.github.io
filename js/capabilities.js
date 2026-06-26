export function chooseInitialMode(caps) {
  if (!caps || !caps.webgl) return 'read';
  if (caps.lowPower) return 'read';
  return 'explore';
}
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (_) { return false; }
}
export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function isLowPower() {
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return mem <= 2 || cores <= 2 || (coarse && mem <= 4 && cores <= 4);
}
export function detect() {
  return { webgl: hasWebGL(), lowPower: isLowPower(), reducedMotion: prefersReducedMotion() };
}
