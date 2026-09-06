// test/assets-brand.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const asset = (p) => new URL(`../${p}`, import.meta.url);
const readText = (p) => readFileSync(asset(p), 'utf8');

// Minimal PNG header reader: width, height, colour type.
function pngInfo(path) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', 'not a PNG');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colourType: buf.readUInt8(25), // 6 = RGBA, 2 = RGB
  };
}

test('one faithful mark serves both themes: no dark variant, no plate, no recolouring', () => {
  // The first attempt shipped a second file recoloured by pixel darkness, which
  // caught the agal, eyebrow, moustache, beard and eye along with the outline.
  // The second put a light plate behind the original artwork in dark mode. Both
  // are gone: tools/process_brand.py keys a chroma-green source instead, so the
  // ghutra stays opaque white and the one file reads on either ground. Asserting
  // the file is absent is not enough on its own — the CSS could reintroduce
  // either workaround without adding a file.
  assert.equal(existsSync(asset('assets/brand/logo-icon-dark.png')), false, 'a recoloured second mark came back');
  const layout = readText('css/layout.css');
  const tokens = readText('css/tokens.css');
  assert.equal(/--plate\b/.test(layout + tokens), false, 'the --plate backing token came back');

  // Nothing may repaint the mark: no filter, no mix-blend-mode, no background
  // behind it, in either theme.
  const rules = [...layout.matchAll(/\.nav-mark-icon[^{]*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(rules.length > 0, 'no .nav-mark-icon rule found at all');
  for (const body of rules) {
    assert.doesNotMatch(body, /\bfilter\s*:/, 'the mark is being recoloured by filter');
    assert.doesNotMatch(body, /mix-blend-mode\s*:/, 'the mark is being recoloured by blend mode');
    assert.doesNotMatch(body, /\bbackground(-color)?\s*:(?!\s*none)/, 'the mark has a plate behind it');
  }
});

test('the nav uses its own small rasters, not the quarter-megabyte favicon master', () => {
  // The master is ~876px and ~250KB and the nav draws it at 2.25rem, so it is
  // kept only for the favicon pipeline in tools/process_brand.py.
  const nav72 = pngInfo(asset('assets/brand/logo-icon-72.png'));
  const nav144 = pngInfo(asset('assets/brand/logo-icon-144.png'));
  assert.deepEqual([nav72.width, nav72.height], [72, 72]);
  assert.deepEqual([nav144.width, nav144.height], [144, 144]);
  assert.ok(readFileSync(asset('assets/brand/logo-icon-72.png')).length < 16 * 1024);

  const html = readText('index.html');
  const tag = html.match(/<img class="nav-mark-icon"[^>]*>/s);
  assert.ok(tag, 'no nav mark image found');
  assert.match(tag[0], /src="assets\/brand\/logo-icon-72\.png"/, 'the nav still points at the master');
  assert.match(tag[0], /srcset="assets\/brand\/logo-icon-72\.png 72w, assets\/brand\/logo-icon-144\.png 144w"/);
  // Declared dimensions must be the file's own, not a number typed from memory:
  // this shipped as 883x883 for an 876x876 file.
  assert.match(tag[0], new RegExp(`width="${nav72.width}"`));
  assert.match(tag[0], new RegExp(`height="${nav72.height}"`));
});

test('logo icon is square, RGBA, and reasonably sized', () => {
  const info = pngInfo(asset('assets/brand/logo-icon.png'));
  assert.equal(info.width, info.height, 'icon must be square');
  assert.ok(info.width >= 512, `icon too small: ${info.width}`);
  assert.equal(info.colourType, 6, 'icon must have an alpha channel');
});

test('logo wordmark is transparent and wider than tall', () => {
  const info = pngInfo(asset('assets/brand/logo-wordmark.png'));
  assert.equal(info.colourType, 6, 'wordmark must have an alpha channel');
  assert.ok(info.width > info.height, 'wordmark should be landscape after trimming');
});

test('favicon set is generated at the expected sizes', () => {
  const expected = [
    ['assets/favicon-16x16.png', 16],
    ['assets/favicon-32x32.png', 32],
    ['assets/apple-touch-icon.png', 180],
    ['assets/android-chrome-192x192.png', 192],
    ['assets/android-chrome-512x512.png', 512],
  ];
  for (const [path, size] of expected) {
    const info = pngInfo(asset(path));
    assert.equal(info.width, size, `${path} width`);
    assert.equal(info.height, size, `${path} height`);
  }
});

test('apple touch icon is opaque, since iOS does not composite transparency', () => {
  const info = pngInfo(asset('assets/apple-touch-icon.png'));
  assert.equal(info.colourType, 2, 'apple touch icon must be RGB, not RGBA');
});

test('the old SVG favicon is gone', () => {
  assert.equal(existsSync(asset('assets/favicon.svg')), false);
});
