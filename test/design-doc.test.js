import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const tokens = read('css/tokens.css');
const design = read('DESIGN.md');
const claude = read('CLAUDE.md');

// Pull the custom properties out of one selector block, first match wins.
function blockTokens(selector) {
  const start = tokens.indexOf(selector);
  assert.notEqual(start, -1, `selector not found in tokens.css: ${selector}`);
  const open = tokens.indexOf('{', start);
  const close = tokens.indexOf('}', open);
  const out = {};
  for (const [, name, value] of tokens.slice(open + 1, close).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
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

const LIGHT = blockTokens(':root');
const DARK = blockTokens('[data-theme="dark"]');
const COLOURS = ['ground', 'ground-raised', 'ink', 'ink-muted', 'accent', 'accent-strong', 'rule'];

// A design document that disagrees with the stylesheet is worse than no design
// document: it sends the next reader, human or agent, to change the wrong thing.
// This drifted for real once — the accent moved from terracotta to blue in
// css/tokens.css and both documents kept describing the retired palette,
// including its contrast figures. An audit lens found it, not a test.
test('DESIGN.md quotes the live light palette', () => {
  for (const name of COLOURS) {
    assert.ok(
      design.includes(LIGHT[name]),
      `DESIGN.md never mentions the light --${name} value ${LIGHT[name]}`,
    );
  }
});

test('DESIGN.md quotes the live dark palette', () => {
  for (const name of COLOURS) {
    assert.ok(
      design.includes(DARK[name]),
      `DESIGN.md never mentions the dark --${name} value ${DARK[name]}`,
    );
  }
});

test('CLAUDE.md quotes both live palettes', () => {
  for (const name of COLOURS) {
    assert.ok(claude.includes(LIGHT[name]), `CLAUDE.md is missing light --${name} ${LIGHT[name]}`);
    assert.ok(claude.includes(DARK[name]), `CLAUDE.md is missing dark --${name} ${DARK[name]}`);
  }
});

test('no retired palette value survives in either document', () => {
  // Every colour these documents have ever shipped, minus the ones live now.
  const retired = ['#a85a32', '#8f4a2c', '#e7ad87', '#f3cbb0', '#1d9bb8', '#1a8fa8', '#36b6d6'];
  const live = new Set([...COLOURS.map((c) => LIGHT[c]), ...COLOURS.map((c) => DARK[c])]);
  for (const hex of retired.filter((h) => !live.has(h))) {
    for (const [name, text] of [['DESIGN.md', design], ['CLAUDE.md', claude]]) {
      // The logo's own tan is allowed as artwork provenance, but not as a token
      // value in a palette table.
      const inTable = text.split('\n').some((l) => l.includes(hex) && l.trim().startsWith('|'));
      assert.equal(inTable, false, `${name} still tabulates the retired value ${hex}`);
    }
  }
});

test('the contrast figures DESIGN.md prints are the real ones', () => {
  // The light table carries a Role column and the dark one does not, so the
  // middle cell is optional:
  //   | `--accent` | `#2959ae` | links, bullet glyphs | 6.41:1 |
  //   | `--accent` | `#90b2df` | 8.19:1 |
  const rows = [...design.matchAll(
    /\|\s*`--([\w-]+)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|(?:\s*[^|]*\|)?\s*([\d.]+):1\s*\|/gi,
  )];
  assert.ok(rows.length >= 8, `expected both palette tables to print ratios, found ${rows.length} rows`);

  for (const [, name, hex, claimed] of rows) {
    const theme = LIGHT[name] === hex ? LIGHT : DARK;
    assert.ok(
      theme[name] === hex,
      `DESIGN.md prints --${name} as ${hex}, which matches neither palette in tokens.css`,
    );
    const actual = contrast(hex, theme.ground);
    assert.ok(
      Math.abs(actual - Number(claimed)) < 0.05,
      `DESIGN.md claims --${name} is ${claimed}:1 on its ground; it is ${actual.toFixed(2)}:1`,
    );
  }
});
