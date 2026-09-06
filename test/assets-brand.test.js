// test/assets-brand.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const asset = (p) => new URL(`../${p}`, import.meta.url);

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
