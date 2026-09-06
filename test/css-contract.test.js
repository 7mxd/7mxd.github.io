// test/css-contract.test.js
//
// Mechanical guardrails over every file in css/, so CSS defects introduced in
// this task or any later one (Task 10, Task 11, ...) get caught before they
// ship. This is intentionally simple: brace counting, not a CSS parser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cssDir = fileURLToPath(new URL('../css/', import.meta.url));
const files = readdirSync(cssDir).filter((f) => f.endsWith('.css')).sort();

// Colours explicitly allowed outside tokens.css, per the Task 9 ruling.
// Keep this list empty unless a real need shows up; document it in the report.
const ALLOWED_HEX_OUTSIDE_TOKENS = new Set([]);

function widthToPx(value, unit) {
  const n = Number(value);
  if (unit === 'px') return n;
  if (unit === 'rem' || unit === 'em') return n * 16; // root font-size approximation
  return null; // unknown unit (%, var(), keyword) — can't judge statically
}

assert.ok(files.length > 0, 'css/ should contain at least one stylesheet to test');

for (const file of files) {
  const path = `${cssDir}${file}`;
  const css = readFileSync(path, 'utf8');

  test(`${file}: braces are balanced`, () => {
    let depth = 0;
    for (const ch of css) {
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        assert.ok(depth >= 0, `${file} has a closing brace with no matching opening brace`);
      }
    }
    assert.equal(depth, 0, `${file} has ${depth} unclosed brace(s) — check for a stray @media or rule`);
  });

  test(`${file}: no gradient-text via background-clip`, () => {
    assert.doesNotMatch(css, /(?<!-webkit-)background-clip\s*:\s*text/i, 'background-clip: text found');
    assert.doesNotMatch(css, /-webkit-background-clip\s*:\s*text/i, '-webkit-background-clip: text found');
  });

  test(`${file}: no border-left/border-right wider than 1px used as an accent stripe`, () => {
    const re = /border-(left|right)\s*:\s*([^;{}]+);/gi;
    for (const match of css.matchAll(re)) {
      const side = match[1];
      const value = match[2].trim();
      const dimensionMatch = value.match(/^(\d*\.?\d+)(px|rem|em)\b/);
      if (!dimensionMatch) continue; // var()/keyword width — not statically judgeable, skip
      const px = widthToPx(dimensionMatch[1], dimensionMatch[2]);
      assert.ok(
        px === null || px <= 1,
        `${file} has "border-${side}: ${value}" — accent stripes wider than 1px are banned`,
      );
    }
  });

  if (file === 'tokens.css') continue; // tokens.css is where hex literals belong

  test(`${file}: every colour comes from a var(--token), no raw hex literals`, () => {
    const hexMatches = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    const unexpected = hexMatches.filter((hex) => !ALLOWED_HEX_OUTSIDE_TOKENS.has(hex));
    assert.deepEqual(
      unexpected,
      [],
      `${file} has raw hex colour literal(s) ${JSON.stringify(unexpected)} — use a var(--token) from tokens.css instead`,
    );
  });
}
