// test/admin-css-contract.test.js
//
// The admin drifted because it kept a private copy of a design language: it
// linked the site's tokens but asked for names the editorial revamp deleted, so
// every value fell through to a hardcoded fallback and the page rendered on
// cream, in teal, in monospace. Repainting it fixes today. This stops tomorrow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../admin/admin.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

// The order the cascade actually sees, read from the link tags themselves.
// Taken as raw substring positions instead, a comment that merely named one of
// these files counted as loading it, and the first such comment reported the
// stylesheets as loading in the wrong order.
const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)]
  .map((m) => (m[0].match(/href="([^"]+)"/) || [])[1])
  .filter(Boolean);

test('the admin loads the site\'s own tokens and base stylesheet', () => {
  assert.match(html, /href="\.\.\/css\/tokens\.css"/);
  assert.match(html, /href="\.\.\/css\/base\.css"/);
  const at = (name) => sheets.findIndex((h) => h.endsWith(name));
  assert.ok(at('tokens.css') !== -1 && at('base.css') !== -1 && at('admin.css') !== -1,
    `a stylesheet is missing; the admin links ${sheets.join(', ') || 'nothing'}`);
  assert.ok(at('tokens.css') < at('base.css'), 'tokens must load first');
  assert.ok(at('base.css') < at('admin.css'), 'admin.css must load last');
});

test('admin.css declares no colour of its own', () => {
  const hex = stripped.match(/#[0-9a-f]{3,8}\b/gi) || [];
  assert.deepEqual(hex, [], `hardcoded colours: ${hex.join(', ')}`);
  assert.equal(/\brgba?\(/.test(stripped), false, 'raw rgb() in admin.css');
});

test('admin.css declares no font family or size of its own', () => {
  for (const prop of ['font-family', 'font-size']) {
    const re = new RegExp(`${prop}\\s*:\\s*([^;}]+)`, 'g');
    for (const m of stripped.matchAll(re)) {
      assert.match(m[1].trim(), /^var\(--/, `${prop}: ${m[1].trim()} is not a token`);
    }
  }
});

test('no token name the site does not define', () => {
  const tokens = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
  const defined = new Set([...tokens.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...stripped.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]));
  const unknown = [...used].filter((n) => !defined.has(n) && !n.startsWith('admin-'));
  assert.deepEqual(unknown, [],
    `admin.css asks for tokens the site does not define: ${unknown.join(', ')}`);
});
