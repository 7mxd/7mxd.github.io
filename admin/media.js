import { validateImage, sanitizeFilename } from './lib.js';

// Every photograph on the site is one of these; every logo is a PNG and any
// future icon can be an SVG. Route those two through admin/photos.js instead,
// which resizes, uprights, and derives the five fields a photograph needs.
const PHOTO_TYPES = ['image/jpeg', 'image/heic', 'image/heif'];

export function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject; r.readAsDataURL(file);
  });
}
export async function pickAndUpload(client, file) {
  if (PHOTO_TYPES.includes(file.type)) {
    throw new Error('Photographs go through admin/photos.js, which resizes them.');
  }
  const v = validateImage({ type: file.type, size: file.size });
  if (!v.ok) throw new Error(v.error);
  const base64 = await readFileBase64(file);
  const path = 'assets/' + sanitizeFilename(file.name);
  let sha = null; try { const ex = await client.getFile(path); sha = ex.sha; } catch (_) {}
  await client.putBinary(path, base64, sha, 'admin: upload ' + sanitizeFilename(file.name));
  return path;
}
