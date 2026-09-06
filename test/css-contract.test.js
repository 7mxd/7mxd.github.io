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

// --- Class coverage --------------------------------------------------------
//
// Task 10 ruling: every CSS class name emitted by js/render.js and
// js/blocks.js must have at least one rule somewhere in css/. This is the
// guard against an element rendering completely unstyled — the exact failure
// this task exists to prevent. Extraction is a static scan of `class="..."`
// occurrences inside those two modules' template literals, not a check of
// what today's data/*.json happens to use: every renderer in js/blocks.js's
// dispatch table can be reached the moment the admin authors a block of that
// type, so each one needs a rule now, not the day it first ships.
//
// Interpolated class attributes (containing `${...}`) can't be extracted by
// a generic regex, so their static part and enumerated dynamic values are
// listed by hand below, one group per interpolation site, matched against
// the actual source at the time of writing:
//   js/render.js   gallery():      class="gallery ${modifier}"          modifier ∈ {is-single, is-grid}
//   js/render.js   entryMarkup():  class="entry is-${entry.kind}"       kind     ∈ {role, education, project, milestone}
//   js/blocks.js   callout:        class="block-callout is-${b.tone}"   tone     ∈ {note, tip, warning} (registry-declared options)
const HAND_ENUMERATED_DYNAMIC_CLASSES = new Set([
  'gallery', 'is-single', 'is-grid',
  'entry', 'is-role', 'is-education', 'is-project', 'is-milestone',
  'block-callout', 'is-note', 'is-tip', 'is-warning',
]);

// Classes intentionally left with no dedicated rule, each with the reason.
// Keep this small: a class belongs here only when the element it names is
// already fully styled without it, never merely because a rule felt like
// extra work.
const CLASS_COVERAGE_ALLOWLIST = new Map([
  [
    'is-role',
    'role entries render with the base .entry treatment and no override; ' +
      'only .entry.is-milestone diverges (reads quieter, as supporting evidence) ' +
      'per the comment above that rule in css/sections.css.',
  ],
  [
    'is-education',
    'education entries render with the base .entry treatment and no override; ' +
      'same reasoning as is-role above.',
  ],
  [
    'is-project',
    'project entries render with the base .entry treatment and no override; ' +
      'same reasoning as is-role above.',
  ],
  [
    'is-note',
    '"note" is the baseline callout tone: .block-callout alone (background, ' +
      'border, padding, colour) already renders it fully styled. is-tip and ' +
      'is-warning each have their own rule in css/sections.css that steps up ' +
      'the border colour; is-note intentionally adds no override.',
  ],
]);

function extractStaticClassLiterals(src) {
  // Matches class="..." only when the attribute value contains no `${`
  // template interpolation — those are handled by the hand-enumerated list
  // above instead, since a regex can't expand a runtime expression.
  const classes = new Set();
  for (const m of src.matchAll(/class="([^"]*)"/g)) {
    if (m[1].includes('${')) continue;
    for (const cls of m[1].trim().split(/\s+/)) if (cls) classes.add(cls);
  }
  return classes;
}

function cssHasRuleFor(css, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A selector reference to .className not immediately followed by another
  // class-name character, so `.entry` doesn't false-match inside
  // `.entry-title`, but does match compound selectors like `.entry.is-milestone`.
  return new RegExp(`\\.${escaped}(?![\\w-])`).test(css);
}

test('js/render.js and js/blocks.js: every emitted class has a CSS rule, or a documented allowlist reason', () => {
  const renderJsPath = fileURLToPath(new URL('../js/render.js', import.meta.url));
  const blocksJsPath = fileURLToPath(new URL('../js/blocks.js', import.meta.url));
  const renderJs = readFileSync(renderJsPath, 'utf8');
  const blocksJs = readFileSync(blocksJsPath, 'utf8');
  const allCss = files.map((f) => readFileSync(`${cssDir}${f}`, 'utf8')).join('\n');

  const emitted = new Set([
    ...extractStaticClassLiterals(renderJs),
    ...extractStaticClassLiterals(blocksJs),
    ...HAND_ENUMERATED_DYNAMIC_CLASSES,
  ]);

  const missing = [];
  for (const cls of emitted) {
    if (CLASS_COVERAGE_ALLOWLIST.has(cls)) continue;
    if (!cssHasRuleFor(allCss, cls)) missing.push(cls);
  }

  assert.deepEqual(
    missing,
    [],
    `these classes are emitted by render.js/blocks.js but have no CSS rule anywhere ` +
      `in css/, and are not in CLASS_COVERAGE_ALLOWLIST: ${missing.join(', ')}`,
  );
});
