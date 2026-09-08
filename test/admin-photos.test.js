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

test('derived paths match where the site looks for photographs', () => {
  // js/data.js reads src and srcSmall as written; the site's photographs live
  // in assets/photos/derived with -1600 and -800 suffixes.
  assert.deepEqual(derivedPaths('IMG_2481 (1).HEIC'), {
    slug: 'img-2481-1',
    large: 'assets/photos/derived/img-2481-1-1600.jpg',
    small: 'assets/photos/derived/img-2481-1-800.jpg',
  });
});
