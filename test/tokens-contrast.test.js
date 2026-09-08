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

// --ground-tint is the top stop of the wash css/base.css paints over the first
// 46rem of the document, so it is a ground real text really sits on — the whole
// hero does. It is checked here alongside the other two, which is what makes
// "the background may carry chroma toward the accent" a bounded permission
// rather than an unbounded one: the tint can only get as blue as AA allows.
const GROUNDS = ['ground', 'ground-tint', 'ground-raised'];
// --danger and --danger-strong are checked for contrast here like every other
// text colour, but deliberately left out of the hue-family test below: an
// error colour is red by definition, not a tint of the accent, so it has
// nothing to say to a hue check.
const TEXT = ['ink', 'ink-muted', 'accent', 'accent-strong', 'danger', 'danger-strong'];

test('light theme text tokens pass AA against every ground, wash included', () => {
  const t = blockTokens(':root');
  for (const g of GROUNDS) {
    assert.ok(t[g], `light --${g} is not defined`);
    for (const name of TEXT) {
      const ratio = contrast(t[name], t[g]);
      assert.ok(ratio >= AA, `light --${name} on --${g} ${t[g]} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('dark theme text tokens pass AA against every ground, wash included', () => {
  const t = blockTokens('[data-theme="dark"]');
  for (const g of GROUNDS) {
    assert.ok(t[g], `dark --${g} is not defined`);
    for (const name of TEXT) {
      const ratio = contrast(t[name], t[g]);
      assert.ok(ratio >= AA, `dark --${name} on --${g} ${t[g]} is ${ratio.toFixed(2)}:1`);
    }
  }
});

// The amended ground rule: chroma is permitted toward the accent's hue only.
// Warm tints — cream, sand, beige — stay banned, and so does drifting toward
// the anti-reference teal at hue 191. Asserted rather than asserted-in-prose,
// because "a very light blue" is exactly the kind of instruction that decays
// into "a very light something" three edits later.
function hueOf(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return null;
  const d = max - min;
  let deg;
  if (max === r) deg = ((g - b) / d) % 6;
  else if (max === g) deg = (b - r) / d + 2;
  else deg = (r - g) / d + 4;
  return ((deg * 60) % 360 + 360) % 360;
}

test('every tinted ground and hairline sits in the accent hue family', () => {
  for (const selector of [':root', '[data-theme="dark"]']) {
    const t = blockTokens(selector);
    const accentHue = hueOf(t.accent);
    for (const name of ['ground-tint', 'rule', 'rule-accent', 'accent-plate']) {
      const hue = hueOf(t[name]);
      assert.ok(hue !== null, `${selector} --${name} is a pure grey, so it carries no accent`);
      const delta = Math.abs(hue - accentHue);
      assert.ok(delta <= 15, `${selector} --${name} is at hue ${hue.toFixed(1)}, ${delta.toFixed(1)} off the accent's ${accentHue.toFixed(1)}`);
      assert.ok(Math.abs(hue - 191) > 20, `${selector} --${name} at hue ${hue.toFixed(1)} is drifting into the banned teal`);
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
