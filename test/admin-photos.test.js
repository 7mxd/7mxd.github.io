import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  targetSize, derivedPaths,
  slugOfLargePath, sameSlugFamily, resolvePaths, MAX_SLUG_VARIANTS,
} from '../admin/photos.js';

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
// here just removes the empty-string case; resolvePaths's own collision
// handling, covered below, is what keeps two different fallback uploads from
// then colliding with each other.
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

// The collision logic: what stops a second photograph that happens to share a
// filename from silently overwriting the first one's derivatives. It took two
// fix rounds, and in between it carried a defect that would have looped
// against the GitHub API on every first upload and overwritten a photograph on
// a network error — and the fix shipped with no regression guard of any kind.
//
// The stub matches admin/github.js's real getFile contract exactly: a MISSING
// file RESOLVES with a null sha, and it throws only for a genuine failure. An
// earlier stub that had this backwards is precisely what let that defect
// through, so this one is written from the real implementation.
function stubClient(takenPaths, { throwOn } = {}) {
  const asked = [];
  return {
    asked,
    async getFile(path) {
      asked.push(path);
      if (throwOn && throwOn.test(path)) throw new Error('502 from the harness');
      return takenPaths.has(path) ? { content: 'x', sha: 'sha-' + path } : { content: null, sha: null };
    },
  };
}
const large = (slug) => `assets/photos/derived/${slug}-1600.jpg`;
const small = (slug) => `assets/photos/derived/${slug}-800.jpg`;
const file = (name) => ({ name });

test('a first upload of a new name claims the plain slug', async () => {
  const client = stubClient(new Set());
  const paths = await resolvePaths(file('honors day.jpg'), { src: '' }, client);
  assert.deepEqual(paths, { slug: 'honors-day', large: large('honors-day'), small: small('honors-day') });
  assert.deepEqual(client.asked, [large('honors-day')], 'probed the wrong path, or probed in a loop');
});

test('the same record re-uploading keeps its own path and asks the server nothing', async () => {
  // Replacing the photograph in a field is not a collision with anything.
  const client = stubClient(new Set([large('honors-day')]));
  const record = { src: large('honors-day') };
  const paths = await resolvePaths(file('Honors Day.jpg'), record, client);
  assert.deepEqual(paths, { slug: 'honors-day', large: large('honors-day'), small: small('honors-day') });
  assert.deepEqual(client.asked, [], 'a replace should not probe for a free name at all');
});

test('a record already living on a -2 variant stays on it', async () => {
  // Recomputing from the filename alone would only ever produce the
  // unsuffixed candidate, which a stale collision may still have taken —
  // bumping this record to yet another suffix and orphaning the pair it has.
  const client = stubClient(new Set([large('honors-day'), large('honors-day-2')]));
  const record = { src: large('honors-day-2') };
  const paths = await resolvePaths(file('honors-day.jpg'), record, client);
  assert.equal(paths.slug, 'honors-day-2');
  assert.equal(paths.small, small('honors-day-2'));
  assert.deepEqual(client.asked, []);
});

test('a different photograph whose name is taken gets the next variant', async () => {
  const client = stubClient(new Set([large('honors-day')]));
  const paths = await resolvePaths(file('honors-day.jpg'), { src: '' }, client);
  assert.deepEqual(paths, { slug: 'honors-day-2', large: large('honors-day-2'), small: small('honors-day-2') });
});

test('a third photograph of the same name goes past the -2 that already exists', async () => {
  const client = stubClient(new Set([large('honors-day'), large('honors-day-2')]));
  const paths = await resolvePaths(file('honors-day.jpg'), { src: '' }, client);
  assert.equal(paths.slug, 'honors-day-3');
});

test('a getFile that fails stops the upload rather than claiming the path', async () => {
  // The defect that shipped once: reading a thrown error as "free" resumes the
  // overwriting this whole check exists to prevent. A network blip must not
  // cost a photograph.
  const client = stubClient(new Set([large('honors-day')]), { throwOn: /honors-day/ });
  await assert.rejects(
    () => resolvePaths(file('honors-day.jpg'), { src: '' }, client),
    (e) => /honors-day-1600\.jpg/.test(e.message) && /502/.test(e.message),
  );
});

test('the variant search has a ceiling and says so', async () => {
  const taken = new Set([large('honors-day')]);
  for (let n = 2; n <= MAX_SLUG_VARIANTS; n += 1) taken.add(large(`honors-day-${n}`));
  const client = stubClient(taken);
  await assert.rejects(
    () => resolvePaths(file('honors-day.jpg'), { src: '' }, client),
    new RegExp(`-${MAX_SLUG_VARIANTS}`),
  );
});

test('a slug that merely starts with another is not a variant of it', async () => {
  // "photobooth" is its own photograph, not photo-2. sameSlugFamily only ever
  // matches the exact slug or a numeric suffix on it.
  assert.equal(sameSlugFamily('photo', 'photo'), true);
  assert.equal(sameSlugFamily('photo-2', 'photo'), true);
  assert.equal(sameSlugFamily('photobooth', 'photo'), false);
  assert.equal(sameSlugFamily('photo-booth', 'photo'), false);
  assert.equal(sameSlugFamily('photo', 'photobooth'), false);

  // And end to end: a record holding photobooth, uploading photo.jpg, must be
  // treated as a new photograph rather than as a replace of its own file.
  const client = stubClient(new Set([large('photobooth')]));
  const paths = await resolvePaths(file('photo.jpg'), { src: large('photobooth') }, client);
  assert.equal(paths.slug, 'photo');
  assert.deepEqual(client.asked, [large('photo')]);
});

test('slugOfLargePath reads a committed derivative path and nothing else', () => {
  assert.equal(slugOfLargePath(large('honors-day')), 'honors-day');
  assert.equal(slugOfLargePath(small('honors-day')), null, 'the small derivative is not the key');
  assert.equal(slugOfLargePath('assets/photos/honors-day-1600.jpg'), null, 'wrong directory');
  assert.equal(slugOfLargePath(''), null);
  assert.equal(slugOfLargePath(undefined), null);
});
