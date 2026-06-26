const IMG_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_IMG = 2 * 1024 * 1024;

export function toBase64(str) {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(str)));
}
export function fromBase64(b64) {
  const clean = String(b64).replace(/\s/g, '');
  if (typeof Buffer !== 'undefined') return Buffer.from(clean, 'base64').toString('utf8');
  return decodeURIComponent(escape(atob(clean)));
}
export function serializeJson(obj) { return JSON.stringify(obj, null, 2) + '\n'; }
export function sanitizeFilename(name) {
  const dot = String(name).lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return ext ? `${slug}.${ext}` : slug;
}
export function validateImage({ type, size }) {
  if (!IMG_TYPES.includes(type)) return { ok: false, error: `Unsupported type ${type}. Allowed: PNG, JPEG, SVG, WebP.` };
  if (size > MAX_IMG) return { ok: false, error: 'Image too large (max 2MB).' };
  return { ok: true };
}
