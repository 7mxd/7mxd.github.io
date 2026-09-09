// test/admin-entry-urls.test.js
//
// The admin is one HTML file served at two URLs. Vercel answers both /admin
// and /admin/ with it and redirects neither, so every reference in it has to
// name the same file from both. A document-relative "app.js" does not: from
// /admin/ it is /admin/app.js, from /admin it is /app.js, which 404s.
//
// That is not a broken link, it is a blank page. admin/index.html ships both
// #login and #app with the hidden attribute set and app.js is what removes it
// from one of them, so the module failing to load leaves nothing on screen at
// all — no error, no card, no clue. The stylesheets resolve either way (../
// clamps at the root), which is why the page still painted the site's ground
// and looked like a white page rather than an unstyled one.
//
// It shipped the day the site moved off GitHub Pages, which had redirected
// /admin to /admin/ and hidden the fault for as long as the admin existed.
// The whole suite passed throughout. Hence a test at the level the bug lives
// at: resolution, not spelling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');

const ORIGIN = 'https://www.7mxd.me';

// Everything the document fetches or links to, minus what carries its own
// origin or addresses this same page (absolute, data:, mailto:, #fragment) —
// those cannot be re-based and so cannot break this way.
const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u));

test('the reference scan actually found the admin\'s assets', () => {
  // Guards the regex above: a parse that silently matched nothing would make
  // every assertion below vacuously true, which is the failure mode a test
  // like this one dies of.
  assert.ok(
    refs.length >= 4,
    `only ${refs.length} re-basable references found in admin/index.html; the scan is wrong`,
  );
});

test('every asset the admin loads resolves to one file from /admin and /admin/', () => {
  for (const ref of refs) {
    const slashed = new URL(ref, `${ORIGIN}/admin/`).href;
    const bare = new URL(ref, `${ORIGIN}/admin`).href;
    assert.equal(
      bare,
      slashed,
      `"${ref}" loads ${slashed} from /admin/ but ${bare} from /admin — one of them is a 404`,
    );
  }
});

test('the stylesheet and the module still point at real files in admin/', () => {
  // The cheap way to pass the test above is to delete the references, so pin
  // that both are present and name the directory they actually live in.
  const resolved = refs.map((r) => new URL(r, `${ORIGIN}/admin/`).pathname);
  assert.ok(resolved.includes('/admin/admin.css'), 'admin.css is no longer loaded');
  assert.ok(resolved.includes('/admin/app.js'), 'app.js is no longer loaded');
});
