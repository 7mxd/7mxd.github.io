// The share card is the first surface most readers see: PRODUCT.md says they
// arrive "overwhelmingly from a LinkedIn or message link", and LinkedIn's feed
// renders the image, og:title and the domain, then discards og:description. So
// for the primary channel the PNG plus a dozen words of title IS the portfolio.
//
// It is also a hand-run artifact. tools/make_og_image.py reads the strings from
// data/*.json, which stops them drifting at generation time — but nothing stops
// someone editing the copy and never rerunning the script, which would ship a
// card contradicting the page with a completely green suite. The generator
// writes a sidecar recording exactly what it drew; these tests compare that
// against the data files and against index.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const file = (rel) => new URL(`../${rel}`, import.meta.url);

const sidecar = json('assets/og-image.json');
const profile = json('data/profile.json');
const experience = json('data/experience.json');
const education = json('data/education.json');
const html = read('index.html');
const generator = read('tools/make_og_image.py');

// Mirrors card_lines() in tools/make_og_image.py.
function expectedLines() {
  const company = experience.items[0].company;
  const roles = experience.items[0].roles;
  const years = [...new Set([
    ...roles.map((r) => r.startDate.slice(0, 4)),
    ...roles.map((r) => r.endDate.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)),
  ])].sort();
  const tenure = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : years[0];
  return [
    profile.role,
    `${company}, ${tenure} · ${education.items[0].institution}`,
    profile.status.replace(/\.$/, ''),
  ];
}

test('the card on disk was drawn from the current content files', () => {
  assert.deepEqual(
    sidecar.lines,
    expectedLines(),
    'assets/og-image.json disagrees with data/*.json — the copy changed and '
    + 'nobody reran `python tools/make_og_image.py`',
  );
});

test('every line the card draws says something checkable', () => {
  const [role, credentials, ask] = sidecar.lines;
  // The card used to read "Data pipelines, analysis, applied statistics" — three
  // capability nouns that would fit any data-science graduate, which is what
  // CLAUDE.md's fourth principle forbids.
  assert.match(credentials, /\d{4}–\d{4}/, 'no date range on the card');
  assert.ok(credentials.includes(education.items[0].institution), 'no institution on the card');
  assert.match(ask, /^Open to /, 'the card does not state what he is looking for');
  assert.ok(role.length > 0);
});

test('the dated card and the legacy path both exist', () => {
  // Open Graph images are cached hard per URL, so a redesign at the same path
  // stays invisible on every link already shared. The dated file is what the
  // meta tags point at; the legacy one is rewritten with the same bytes so old
  // shares improve as their caches expire instead of being stranded.
  const dated = read('index.html').match(/og:image" content="[^"]*\/(og-image-[^"]+\.png)"/);
  assert.ok(dated, 'og:image does not point at a dated card');
  assert.ok(existsSync(file(`assets/${dated[1]}`)), `assets/${dated[1]} is missing`);
  assert.ok(existsSync(file('assets/og-image.png')), 'the legacy card path was removed');

  const a = readFileSync(file(`assets/${dated[1]}`));
  const b = readFileSync(file('assets/og-image.png'));
  assert.ok(a.equals(b), 'the legacy card is stale — rerun tools/make_og_image.py');
});

test('og:image and twitter:image agree, and both carry alt text', () => {
  const og = html.match(/<meta property="og:image" content="([^"]*)"/);
  const tw = html.match(/<meta name="twitter:image" content="([^"]*)"/);
  assert.ok(og && tw, 'an image tag is missing');
  assert.equal(og[1], tw[1], 'og:image and twitter:image point at different files');

  for (const [attr, name] of [['property', 'og:image:alt'], ['name', 'twitter:image:alt']]) {
    const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
    assert.ok(m, `${name} is missing`);
    // Alt that restates og:title and og:description is worse than none for a
    // screen-reader user, so it has to carry what the picture carries.
    assert.ok(m[1].includes(experience.items[0].company), `${name} omits the employer the card shows`);
    assert.ok(m[1].length > 60, `${name} is too thin to describe the card`);
  }
});

test('the generator refuses a bitmap fallback instead of reporting success', () => {
  // It used to return ImageFont.load_default(), an 11px bitmap, and main() then
  // printed success — so a machine without Georgia produced a card that looked
  // broken and said it had worked. The macOS path was also wrong, so a Mac took
  // that branch every time.
  // Match the call, not the word: the docstring explaining why the fallback was
  // removed names it, and a bare /load_default/ flagged that explanation.
  assert.equal(
    /return\s+ImageFont\.load_default/.test(generator),
    false,
    'the bitmap fallback is back',
  );
  assert.match(generator, /raise SystemExit/, 'the generator no longer fails loudly');
  assert.match(generator, /Supplemental\/Georgia\.ttf/, 'the macOS font path is still wrong');
});

test('the generator holds no copy of its own', () => {
  // A literal string in a generator is content living in code, which the
  // project's first convention forbids. Every drawn line comes from data/.
  assert.match(generator, /def card_lines/);
  for (const key of ['profile', 'experience', 'education']) {
    assert.ok(generator.includes(`load("${key}")`), `the generator never reads data/${key}.json`);
  }
});
