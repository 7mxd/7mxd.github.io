// test/budget.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function bytesIn(dir, extension) {
  const path = `${root}${dir}`;
  if (!existsSync(path)) return 0;
  return readdirSync(path)
    .filter((f) => f.endsWith(extension))
    .reduce((total, f) => total + statSync(`${path}/${f}`).size, 0);
}

const BUDGET = 80 * 1024;

test('CSS plus JS stays inside the 80KB uncompressed budget', () => {
  const total = bytesIn('css', '.css') + bytesIn('js', '.js');
  assert.ok(total <= BUDGET, `${Math.round(total / 1024)}KB used of 80KB`);
});

test('the legacy monolith files are gone', () => {
  assert.equal(existsSync(`${root}script.js`), false, 'script.js still present');
  assert.equal(existsSync(`${root}style.css`), false, 'style.css still present');
});

test('the stylesheets are split into five files', () => {
  const css = readdirSync(`${root}css`).filter((f) => f.endsWith('.css'));
  assert.ok(css.length >= 5, 'expected the five split stylesheets');
});

// The task-11 brief named this test 'no stylesheet mentions the retired
// terminal metaphor' but only asserted a file count, which doesn't test that
// claim at all. Renamed the count assertion above to describe what it
// actually checks, and added this test to cover the claim the old name made.
//
// Comments are stripped before matching: css/sections.css legitimately says,
// in prose, that "the terminal metaphor is retired" (explaining why no
// monospace font-family is declared there) — that sentence is the opposite
// of a regression and must not fail this test. What must never come back is
// an actual terminal-styled selector or literal terminal furniture: a
// class name, a `$ ` shell-prompt string, blinking-cursor styling, ASCII-art
// borders, or a CRT/scanline effect.
const TERMINAL_METAPHOR_PATTERN = /terminal|\bcrt\b|scanline|blink(?:ing)?-cursor|ascii-art|prompt-glyph|\$\s+ls\s+/i;

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

test('no stylesheet contains the retired terminal metaphor', () => {
  const cssDir = `${root}css`;
  const files = readdirSync(cssDir).filter((f) => f.endsWith('.css'));
  for (const file of files) {
    const stripped = stripCssComments(readFileSync(`${cssDir}/${file}`, 'utf8'));
    assert.doesNotMatch(
      stripped,
      TERMINAL_METAPHOR_PATTERN,
      `${file} contains terminal-metaphor content outside a comment`,
    );
  }
});
