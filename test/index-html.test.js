// test/index-html.test.js
//
// index.html and manifest.json carry copy that also lives in
// data/settings.json. Nothing pinned them together, and they have already
// drifted once: the manifest went on describing Ahmed as a data scientist at
// Saal.ai after seven other places were corrected. These tests make
// settings.meta the single source of truth for all of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const html = read('index.html');
const settings = JSON.parse(read('data/settings.json'));
const manifest = JSON.parse(read('manifest.json'));

const metaContent = (attr, name) => {
  const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  assert.ok(m, `no <meta ${attr}="${name}"> in index.html`);
  return m[1];
};

test('all three description tags come from settings.meta.description', () => {
  const expected = settings.meta.description;
  assert.ok(expected && expected.length > 40, 'settings.meta.description is missing or a stub');
  assert.equal(metaContent('name', 'description'), expected);
  assert.equal(metaContent('property', 'og:description'), expected);
  assert.equal(metaContent('name', 'twitter:description'), expected);
});

test('the social titles come from settings.meta.title, and <title> from siteTitle', () => {
  assert.equal(metaContent('property', 'og:title'), settings.meta.title);
  assert.equal(metaContent('name', 'twitter:title'), settings.meta.title);
  // js/render.js overwrites document.title with settings.siteTitle once the
  // data loads, so the static tag must already say the same thing — otherwise
  // the tab renames itself in front of the visitor.
  const title = html.match(/<title>([^<]*)<\/title>/);
  assert.ok(title, 'no <title> in index.html');
  assert.equal(title[1], settings.siteTitle);
});

test('the canonical and og:url come from settings.meta.url', () => {
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/);
  assert.ok(canonical, 'no canonical link in index.html');
  assert.equal(canonical[1], settings.meta.url);
  assert.equal(metaContent('property', 'og:url'), settings.meta.url);
});

test('the web app manifest describes the same person the page does', () => {
  // This is the tag that survived the correction: it still said "Data scientist
  // at Saal.ai", a role that ends in September 2026.
  assert.equal(manifest.description, settings.meta.description);
  assert.equal(/Saal\.ai/.test(manifest.description), false, 'the manifest names a role that ends');
});

test('a visitor with scripting off gets the message, not the empty skeleton', () => {
  // Every section is filled in by js/main.js. With the noscript block last in
  // the body and nothing hiding the shell, scripting-off meant 1300 pixels of
  // empty skeleton, a Download CV link with no href, and a copyright with no
  // year, followed eventually by the explanation.
  const headStyle = html.match(/<noscript><style>([^]*?)<\/style><\/noscript>/);
  assert.ok(headStyle, 'no <noscript><style> in the head to hide the JS-rendered shell');
  for (const selector of ['#main', '.site-nav-wrap', '.site-footer']) {
    assert.ok(headStyle[1].includes(selector), `${selector} is left visible with scripting off`);
  }
  assert.ok(html.indexOf(headStyle[0]) < html.indexOf('<body>'), 'the hiding style must be in the head');

  const warning = html.indexOf('class="noscript-warning"');
  assert.notEqual(warning, -1, 'no noscript message at all');
  assert.ok(warning < html.indexOf('<main id="main">'), 'the message must come before the shell it replaces');
});

test('the manifest theme colour matches the light-primary ground', () => {
  // A #15171f theme colour against a #fafaf9 background paints the browser
  // chrome in the dark palette while the splash screen stays light. Light is
  // the primary theme, and index.html already declares the dark variant through
  // a prefers-color-scheme media query, which a manifest cannot express.
  assert.equal(manifest.theme_color, manifest.background_color);
  assert.equal(manifest.theme_color, metaContent('name', 'theme-color'));
});


// The theme is a data-theme attribute the visitor toggles, not the OS
// preference a media condition sees. Two media-keyed theme-color tags therefore
// described a site this is not: a reader on a light-OS phone who tapped the moon
// got a dark page under a light address bar. One tag now, written by the
// pre-paint script and by every toggle after it.
test('theme-color is a single tag, not keyed to the OS preference', () => {
  const tags = html.match(/<meta name="theme-color"[^>]*>/g) || [];
  assert.equal(tags.length, 1, `expected exactly one theme-color tag, found ${tags.length}`);
  assert.equal(/prefers-color-scheme/.test(tags[0]), false, 'theme-color is still media-keyed');
});

test('every theme-color value agrees with --ground in css/tokens.css', () => {
  const tokens = read('css/tokens.css');
  const grounds = {};
  for (const [selector, key] of [[':root', 'light'], ['[data-theme="dark"]', 'dark']]) {
    const start = tokens.indexOf(selector);
    const open = tokens.indexOf('{', start);
    const body = tokens.slice(open + 1, tokens.indexOf('}', open));
    grounds[key] = body.match(/--ground:\s*(#[0-9a-f]{6})/i)[1];
  }

  // The tag in the shell carries the light value: it is what the pre-paint
  // script resolves to before it runs, and what manifest.json is pinned to.
  assert.equal(metaContent('name', 'theme-color'), grounds.light);

  // Both grounds must appear in the pre-paint script and in js/theme.js, so
  // neither can drift from the palette unnoticed.
  const theme = read('js/theme.js');
  for (const [key, hex] of Object.entries(grounds)) {
    assert.ok(html.includes(hex), `the pre-paint script never writes the ${key} ground ${hex}`);
    assert.ok(theme.includes(hex), `js/theme.js never writes the ${key} ground ${hex}`);
  }
});
