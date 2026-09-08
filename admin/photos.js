/** Everything tools/process_photos.py does, in the browser, so a photograph can
 *  be added from a phone with no developer step.
 *
 *  The original is deliberately not committed. It costs the Python tool the
 *  ability to regenerate an admin-added photograph if the sizes ever change;
 *  it saves uploading four megabytes over mobile data before a save completes.
 *  That is a UX decision before it is a storage one. */
import { sanitizeFilename } from './lib.js';

export const CAPS = [1600, 800];
export const QUALITY = 0.82;

/** Scale so the long edge meets the cap, never enlarging. */
export function targetSize(width, height, cap) {
  // A zero, negative, or non-finite dimension means the file was never really
  // decoded as an image — the realistic cause is a file that isn't actually a
  // photograph, or one the browser couldn't decode. That number would
  // otherwise flow straight into the width/height attributes the browser
  // reserves layout space with, shipping exactly the layout shift the five
  // required fields exist to prevent.
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('This file has no usable image dimensions. It may not really be a '
      + 'photograph, or this browser could not decode it — try a different file.');
  }
  const long = Math.max(width, height);
  if (long <= cap) return { width, height };
  const scale = cap / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function derivedPaths(filename) {
  const stripped = sanitizeFilename(filename).replace(/\.[^.]+$/, '');
  // A filename that is punctuation only (no letter or digit survives
  // sanitizeFilename's slugging — "!!!.jpg", "...jpg", "----.jpg") used to
  // strip down to an empty slug, so every such photograph wrote the same
  // bare "-1600.jpg" and silently overwrote whichever one uploaded last.
  // Falling back to a fixed name removes the empty-string case; attachPhoto's
  // own collision handling is what keeps two *different* fallback uploads
  // from then colliding with each other, the same as any other repeated slug.
  const slug = stripped || 'photo';
  return {
    slug,
    large: `assets/photos/derived/${slug}-1600.jpg`,
    small: `assets/photos/derived/${slug}-800.jpg`,
  };
}

/** Apply the EXIF rotation to the pixels before anything else touches them.
 *  Stripping metadata first is exactly the bug tools/process_photos.py carried
 *  until September 2026: it rebuilt from raw pixels and threw the orientation
 *  tag away with everything else, so a portrait phone photo shipped sideways. */
async function bitmapUpright(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (_) {
    // Feature-detect rather than ship a sideways photograph silently.
    const bmp = await createImageBitmap(file);
    bmp.__orientationUnknown = true;
    return bmp;
  }
}

async function encode(bitmap, cap) {
  const { width, height } = targetSize(bitmap.width, bitmap.height, cap);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  // Re-encoding through a canvas drops every metadata block, which is the same
  // guarantee the Python tool gets by rebuilding from raw pixels.
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
  return { blob, width, height };
}

const toBase64 = (buf) => {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

async function pathExists(client, path) {
  try { await client.getFile(path); return true; } catch (_) { return false; }
}

/** derivedPaths is a pure function of the filename alone, so two different
 *  photographs that happen to share a filename — an ordinary thing for a
 *  camera to do, and the admin's own test fixture (`IMG_2481 (1).HEIC`) is
 *  that shape — resolve to the same slug and would otherwise silently
 *  overwrite each other's derivatives. Telling "the owner re-uploading a
 *  replacement into this exact field" apart from "an unrelated photo that
 *  happens to collide" needs the record being edited and the server's
 *  existing files, so it lives here rather than in derivedPaths. */
async function resolvePaths(file, record, client) {
  const candidate = derivedPaths(file.name);
  // The record already points at this exact path: the owner is replacing the
  // photo in this field, which is what "re-upload" means. Overwrite it.
  if (record.src === candidate.large) return candidate;
  // Nobody's using this slug yet — safe to claim it as-is.
  if (!(await pathExists(client, candidate.large))) return candidate;
  // The slug is taken by something else. Do not overwrite a stranger's
  // photograph; find the first numbered variant that's free and use it for
  // both derivatives, so the pair stays together under one new slug.
  let n = 2;
  for (;;) {
    const slug = `${candidate.slug}-${n}`;
    const large = `assets/photos/derived/${slug}-1600.jpg`;
    if (!(await pathExists(client, large))) {
      return { slug, large, small: `assets/photos/derived/${slug}-800.jpg` };
    }
    n += 1;
  }
}

export async function attachPhoto(file, record, field, client) {
  const bitmap = await bitmapUpright(file);
  if (bitmap.__orientationUnknown) {
    throw new Error('This browser cannot read the photo\'s rotation. '
      + 'Rotate it in Photos first, then upload.');
  }
  const paths = await resolvePaths(file, record, client);
  const large = await encode(bitmap, CAPS[0]);
  const small = await encode(bitmap, CAPS[1]);

  for (const [path, out] of [[paths.large, large], [paths.small, small]]) {
    let sha = null;
    try { sha = (await client.getFile(path)).sha; } catch (_) { sha = null; }
    const b64 = toBase64(await out.blob.arrayBuffer());
    await client.putBinary(path, b64, sha, `admin: add ${path.split('/').pop()}`);
  }

  // The site requires all five; typing them by hand is how they go wrong.
  record.src = paths.large;
  record.srcSmall = paths.small;
  record.width = large.width;
  record.height = large.height;
  record.widthSmall = small.width;
  return paths.large;
}
