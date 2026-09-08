import { test } from 'node:test';
import assert from 'node:assert/strict';
import { targetSize, derivedPaths } from '../admin/photos.js';

test('the long edge is capped and the aspect ratio is kept', () => {
  assert.deepEqual(targetSize(4032, 3024, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(targetSize(3024, 4032, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(targetSize(738, 1600, 800), { width: 369, height: 800 });
});

test('an image already smaller than the cap is not enlarged', () => {
  assert.deepEqual(targetSize(600, 400, 1600), { width: 600, height: 400 });
});

// A zero or non-finite dimension means the file was never really decoded as
// an image (a renamed non-image, or one the browser refused to decode). That
// number would otherwise flow straight into the width/height attributes the
// browser reserves layout space with — a zero there reintroduces exactly the
// layout shift the five required fields exist to prevent.
test('targetSize rejects a dimension that is not a positive finite number', () => {
  assert.throws(() => targetSize(0, 500, 1600), /image/i);
  assert.throws(() => targetSize(500, 0, 1600), /image/i);
  assert.throws(() => targetSize(-100, 500, 1600), /image/i);
  assert.throws(() => targetSize(NaN, 500, 1600), /image/i);
  assert.throws(() => targetSize(500, Infinity, 1600), /image/i);
});

test('derived paths match where the site looks for photographs', () => {
  // js/data.js reads src and srcSmall as written; the site's photographs live
  // in assets/photos/derived with -1600 and -800 suffixes.
  assert.deepEqual(derivedPaths('IMG_2481 (1).HEIC'), {
    slug: 'img-2481-1',
    large: 'assets/photos/derived/img-2481-1-1600.jpg',
    small: 'assets/photos/derived/img-2481-1-800.jpg',
  });
});

// A camera or screenshot filename that is punctuation only (no letter or
// digit survives sanitizeFilename's slugging) used to strip down to an empty
// slug, so every such upload wrote the same bare "-1600.jpg" — two of them
// silently overwrote each other. Falling back to a fixed, non-empty slug
// here just removes the empty-string case; attachPhoto's own collision
// handling (untestable here — it needs a client) is what keeps two different
// fallback uploads from then colliding with each other.
test('a punctuation-only filename falls back to a non-empty slug instead of an empty one', () => {
  for (const bad of ['!!!.jpg', '...jpg', '----.jpg']) {
    const paths = derivedPaths(bad);
    assert.notEqual(paths.slug, '');
    assert.deepEqual(paths, {
      slug: 'photo',
      large: 'assets/photos/derived/photo-1600.jpg',
      small: 'assets/photos/derived/photo-800.jpg',
    });
  }
});
