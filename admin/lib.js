const IMG_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
// A phone photograph is routinely 3-5 MB and the old 2 MB cap rejected them —
// including the 2.1 MB Honors Day picture added in September 2026. The
// committed output is bounded by the resize, not by the source, so the input
// limit only needs to stop something absurd.
const MAX_IMG = 12 * 1024 * 1024;

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
/** What a field's `accept` (admin/schema.js) means, on both sides of the file
 *  dialog: the filter the dialog itself uses, the MIME types accepted back
 *  from it, and what to call the button.
 *
 *  Declared together on purpose. Settings' CV field has said `accept: '.pdf'`
 *  since the schema was written and nothing read it — the picker hardcoded
 *  `image/*`, so the dialog would not offer a PDF at all, and this function
 *  refused `application/pdf` even if one arrived. The CV button is on the
 *  hero, and the requirement was that everything on the page be editable, so
 *  it could not be replaced without a developer. Splitting the dialog filter
 *  from the allowlist is what let the two drift; keeping them in one table is
 *  what stops a field offering a file it then refuses. */
const UPLOAD_RULES = {
  '.pdf': { accept: '.pdf,application/pdf', types: ['application/pdf'], allowed: 'PDF', button: 'Upload PDF' },
};
const IMAGE_RULE = { accept: 'image/*', types: IMG_TYPES, allowed: 'PNG, JPEG, SVG, WebP', button: 'Upload image' };

export function uploadRule(accept) { return UPLOAD_RULES[accept] || IMAGE_RULE; }

export function validateUpload({ type, size }, accept) {
  const rule = uploadRule(accept);
  if (!rule.types.includes(type)) return { ok: false, error: `Unsupported type ${type}. Allowed: ${rule.allowed}.` };
  if (size > MAX_IMG) return { ok: false, error: `File too large (max ${MAX_IMG / (1024 * 1024)}MB).` };
  return { ok: true };
}
