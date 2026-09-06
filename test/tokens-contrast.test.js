// test/tokens-contrast.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');

// Pull the custom properties out of one selector block.
function blockTokens(selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `selector not found: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const out = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
}

const srgb = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => srgb(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

test('light theme text tokens pass AA against both grounds', () => {
  const t = blockTokens(':root');
  for (const ground of [t.ground, t['ground-raised']]) {
    for (const name of ['ink', 'ink-muted', 'accent', 'accent-strong']) {
      const ratio = contrast(t[name], ground);
      assert.ok(ratio >= AA, `light --${name} on ${ground} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('dark theme text tokens pass AA against both grounds', () => {
  const t = blockTokens('[data-theme="dark"]');
  for (const ground of [t.ground, t['ground-raised']]) {
    for (const name of ['ink', 'ink-muted', 'accent', 'accent-strong']) {
      const ratio = contrast(t[name], ground);
      assert.ok(ratio >= AA, `dark --${name} on ${ground} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('the banned teal and cream token names are gone', () => {
  assert.equal(/#1d9bb8|#1a8fa8|#36b6d6/i.test(css), false, 'banned teal present');
  assert.equal(/--(paper|cream|sand|bone|linen|parchment)\b/i.test(css), false, 'banned token name present');
});

test('no monospace family is declared, since the terminal metaphor is retired', () => {
  assert.equal(/--font-mono/.test(css), false);
});
