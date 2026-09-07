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
const profile = JSON.parse(read('data/profile.json'));

const metaContent = (attr, name) => {
  const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  assert.ok(m, `no <meta ${attr}="${name}"> in index.html`);
  return m[1];
};

test('the description a share preview shows is what the page itself says', () => {
  // The one line most readers see before they see anything else: WhatsApp,
  // iMessage and a search result render it under the title. It drifted from the
  // page twice — once describing a role that had ended, once narrowed to a
  // single project — and both times nobody noticed until a preview was seen in
  // the wild. Deriving it from the hero removes the chance to write it wrong.
  assert.equal(
    settings.meta.description,
    `${profile.role}. ${profile.tagline}`,
    'settings.meta.description no longer matches the role line and tagline the hero renders',
  );
  // Google truncates a snippet around 155-160 characters, so a longer tagline
  // means the last clause never reaches a reader.
  assert.ok(
    settings.meta.description.length <= 165,
    `the description is ${settings.meta.description.length} characters and will be cut off in a search result`,
  );
});

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
  // the primary theme, and the dark value is written at runtime by the
  // pre-paint script and js/theme.js — which a manifest cannot do, so it pins
  // the light one.
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
  // neither can drift from the palette unnoticed. Scoped to the script itself,
  // not the whole file: `html.includes('#fafaf9')` was satisfied by the static
  // tag alone, so deleting the pre-paint write entirely still passed.
  const script = html.slice(html.indexOf('<script>'), html.indexOf('</script>'));
  const theme = read('js/theme.js');
  for (const [key, hex] of Object.entries(grounds)) {
    assert.ok(script.includes(hex), `the pre-paint script never writes the ${key} ground ${hex}`);
    assert.ok(theme.includes(hex), `js/theme.js never writes the ${key} ground ${hex}`);
  }
});

test('the theme-color tag is parsed before the script that rewrites it', () => {
  // It shipped below the script for one commit. querySelector returned null,
  // the guarded write never ran, and the only remaining writer was js/theme.js
  // — a deferred module — so a dark reader sat under a light address bar until
  // four modules resolved, and permanently if any of them failed to load. That
  // is strictly worse than the media-keyed tags this replaced, which at least
  // resolved at parse time with no JavaScript at all.
  const tag = html.indexOf('<meta name="theme-color"');
  const lookup = html.indexOf(`querySelector('meta[name="theme-color"]')`);
  assert.ok(tag >= 0, 'no theme-color tag');
  assert.ok(lookup >= 0, 'the pre-paint script no longer looks the tag up');
  assert.ok(tag < lookup, 'the theme-color tag is parsed after the script that reads it');
});
