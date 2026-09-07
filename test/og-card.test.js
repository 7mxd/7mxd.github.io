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
  const dated = (r) => /^\d{4}$/.test(r.endDate.slice(0, 4));
  const years = [...new Set([
    ...roles.map((r) => r.startDate.slice(0, 4)),
    ...roles.filter(dated).map((r) => r.endDate.slice(0, 4)),
  ])].sort();
  // admin/schema.js advertises "Present" as a valid endDate. Without this the
  // generator drew "Saal.ai, 2024" and this mirror agreed with it, so a card
  // describing a year-long job would have passed.
  const end = roles.every(dated) ? years[years.length - 1] : 'present';
  const tenure = end === years[0] ? years[0] : `${years[0]}–${end}`;
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
  // A range, not a year: /\d{4}(–\d{4})?/ would have been satisfied by the
  // bare "2024" the open-ended branch used to produce.
  assert.match(credentials, /\d{4}–(\d{4}|present)/, 'no date range on the card');
  assert.ok(credentials.includes(education.items[0].institution), 'no institution on the card');
  assert.match(ask, /^Open to /, 'the card does not state what he is looking for');
  assert.ok(role.length > 0);
});

test('the card was drawn with the page\'s current palette', () => {
  // The card's colours were three hardcoded RGB triples in the generator. When
  // the page moved from a warm off-white ground to a cool one, the card went on
  // drawing the old ground and a link preview stopped matching the page it
  // opened — the same drift as the description, in pixels instead of words.
  const tokens = read('css/tokens.css');
  const root = tokens.slice(tokens.indexOf('{', tokens.indexOf(':root')), tokens.indexOf('}', tokens.indexOf(':root')));
  assert.ok(sidecar.colours, 'the sidecar records no palette — rerun tools/make_og_image.py');
  for (const [token, drawn] of Object.entries(sidecar.colours)) {
    const current = root.match(new RegExp(`--${token}:\\s*(#[0-9a-f]{6})\\s*;`, 'i'));
    assert.ok(current, `css/tokens.css no longer defines --${token} in :root`);
    assert.equal(
      drawn,
      current[1].toLowerCase(),
      `the card was drawn with --${token} ${drawn} but the page now uses ${current[1]} `
      + '— rerun `python tools/make_og_image.py`',
    );
  }
  // The ground specifically, because it is the one a reader sees as "the wrong
  // colour" before they read a word of it.
  assert.ok(sidecar.colours['ground-tint'], 'the card no longer records its ground');
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
    // screen-reader user, so it has to carry what the picture carries. Checked
    // line by line, not against the sidecar verbatim: the alt deliberately
    // voices "2024 to 2026, and" where the card draws "2024–2026 ·". Without
    // these three, a copy edit plus a regeneration left the alt describing the
    // previous card with the whole suite green.
    const alt = m[1];
    assert.ok(alt.includes(experience.items[0].company), `${name} omits the employer the card shows`);
    assert.ok(alt.includes(education.items[0].institution), `${name} omits the institution`);
    assert.ok(alt.includes(profile.role), `${name} no longer says what the card says he is`);
    assert.ok(alt.includes(profile.status.replace(/\.$/, '')), `${name} no longer carries the ask`);
    assert.ok(alt.length > 60, `${name} is too thin to describe the card`);
  }
});

test('the shipped card is a real 1200x630 image, not a placeholder', () => {
  // Everything above reads text. Two zero-byte PNGs passed the whole file, so
  // nothing bound the tags to the picture they describe. The IHDR is four bytes
  // of proof that a card was drawn at the size the meta tags promise.
  const declared = (name) => Number(
    html.match(new RegExp(`<meta property="${name}" content="(\\d+)"`))[1],
  );
  const buf = readFileSync(file('assets/og-image.png'));
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', 'the card is not a PNG');
  assert.equal(buf.readUInt32BE(16), declared('og:image:width'), 'the card is not as wide as og:image:width claims');
  assert.equal(buf.readUInt32BE(20), declared('og:image:height'), 'the card is not as tall as og:image:height claims');
});

test('the meta tags point at the filename the generator writes', () => {
  // CARD_NAME is a frozen literal and og:image matches any og-image-*.png, so
  // a bump in one and not the other produced "the legacy card is stale — rerun
  // the generator", which is the wrong instruction for the actual fault.
  const name = generator.match(/CARD_NAME = "([^"]+)"/);
  assert.ok(name, 'the generator no longer names its output file');
  assert.ok(
    html.includes(`/assets/${name[1]}"`),
    `the generator writes assets/${name[1]}, which index.html does not reference`,
  );
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
