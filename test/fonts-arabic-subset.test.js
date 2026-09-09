// test/fonts-arabic-subset.test.js
//
// Amiri is loaded from Google Fonts with a `text=` parameter, which returns a
// font file containing ONLY the characters named there. That keeps the request
// tiny, and it is why the Arabic name costs almost nothing to set properly.
//
// The trap is that the subset is a hardcoded list and the text it has to cover
// lives in data/*.json, which is edited through the admin by someone who has
// no reason to know this file exists. When the two drifted, the site asked for
// Amiri on a string Amiri could not render: the browser fell back for the
// letters the subset was missing, and because Arabic is cursive, a fallback
// that lands per character breaks the joining. The word rendered as
// disconnected letters. A reader noticed it before any test did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/u;
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/** Every Arabic-bearing string in the content, with where it came from. */
function arabicStrings() {
  const out = [];
  const dir = new URL('../data/', import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const walk = (node, path) => {
      if (typeof node === 'string') {
        if (ARABIC.test(node)) out.push({ file, path, text: node });
      } else if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`));
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
      }
    };
    walk(JSON.parse(readFileSync(new URL(file, dir), 'utf8')), '');
  }
  return out;
}

/** The characters the Amiri request actually asks the server for. */
function subsetChars() {
  const link = html.match(/<link[^>]+fonts\.googleapis\.com\/css2\?family=Amiri[^>]*>/);
  assert.ok(link, 'index.html no longer loads Amiri; this guard needs updating with it');
  const text = link[0].match(/[?&]text=([^&"']+)/);
  assert.ok(text, 'the Amiri request carries no text= subset, so it now ships the whole font');
  return new Set(decodeURIComponent(text[1]));
}

test('the Amiri subset covers every Arabic character the site sets', () => {
  const have = subsetChars();
  const missing = [];
  for (const { file, path, text } of arabicStrings()) {
    for (const ch of text) {
      if (!ARABIC.test(ch)) continue;
      if (!have.has(ch)) missing.push(`${ch} (U+${ch.codePointAt(0).toString(16).toUpperCase()}) in ${file} ${path}`);
    }
  }
  assert.deepEqual([...new Set(missing)], [],
    'these characters are set in Amiri but are not in its subset, so the browser '
    + 'falls back mid-word and the Arabic renders disconnected. Add them to the '
    + 'text= parameter on the Amiri link in index.html.');
});

test('the subset asks for nothing the site does not set', () => {
  // Not correctness, but the whole point of a subset is that it is minimal;
  // a stale character here means the request is carrying dead weight.
  const used = new Set();
  for (const { text } of arabicStrings()) for (const ch of text) if (ARABIC.test(ch)) used.add(ch);
  const extra = [...subsetChars()].filter((ch) => ARABIC.test(ch) && !used.has(ch));
  assert.deepEqual(extra, [], `the Amiri subset asks for characters no content uses: ${extra.join(' ')}`);
});
