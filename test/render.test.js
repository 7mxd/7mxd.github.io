// Full-pipeline render test: real data/*.json, through the same normalisation
// loadSiteData performs, through buildTimeline, through renderAll, against a
// minimal fake document. This is the regression guard for two review findings:
// a project's timeline entry must not reproduce its Selected Work images, and
// every rendered <img> must carry safe, non-empty attributes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSiteData, normalizeSiteImages } from '../js/data.js';
import { buildTimeline } from '../js/timeline.js';
import { renderAll } from '../js/render.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

const RAW = {
  profile: load('profile'), summary: load('summary'), settings: load('settings'),
  experience: load('experience'), education: load('education'), projects: load('projects'),
  milestones: load('milestones'), metrics: load('metrics'), skills: load('skills'),
  registry: load('blocks-registry'),
};

const { ok, errors } = validateSiteData(RAW);
assert.ok(ok, `fixture data failed validation: ${errors.join('; ')}`);
const DATA = normalizeSiteImages(RAW);
const TIMELINE = buildTimeline(DATA);

const SECTION_IDS = ['hero', 'about', 'path', 'numbers', 'work', 'skills', 'contact'];

/** The smallest possible stand-in for `document`: getElementById/querySelector
 *  return plain objects that record innerHTML/textContent/attributes, exactly
 *  what render.js touches and nothing more. Not a DOM library. */
class FakeElement {
  constructor() {
    this._innerHTML = '';
    this._textContent = '';
    this._attrs = {};
    this.hidden = false;
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) { this._innerHTML = v; }
  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = v; }
  setAttribute(name, value) { this._attrs[name] = value; }
  getAttribute(name) { return this._attrs[name]; }
}

function buildFixtureDoc() {
  const sections = new Map(SECTION_IDS.map((id) => [id, new FakeElement()]));
  const hooks = {
    '[data-nav-name]': new FakeElement(),
    '[data-nav-links]': new FakeElement(),
    '[data-cv-link]': new FakeElement(),
    '[data-footer-year]': new FakeElement(),
    '[data-footer-name]': new FakeElement(),
  };
  const doc = {
    getElementById: (id) => {
      if (!sections.has(id)) throw new Error(`unexpected getElementById(${id})`);
      return sections.get(id);
    },
    querySelector: (selector) => {
      if (!(selector in hooks)) throw new Error(`unexpected querySelector(${selector})`);
      return hooks[selector];
    },
    set title(v) { this._title = v; },
    get title() { return this._title; },
  };
  return { doc, sections, hooks };
}

function renderFixture() {
  const { doc, sections, hooks } = buildFixtureDoc();
  renderAll(doc, DATA, TIMELINE);
  return { doc, sections, hooks };
}

/** Render the real DATA (already-validated content files) against a
 *  hand-built timeline instead of the one buildTimeline() produces, so a
 *  test can exercise a shape today's data/*.json doesn't happen to contain
 *  — like a timeline entry carrying a non-empty `blocks` array. */
function renderWithTimeline(timeline) {
  const { doc, sections, hooks } = buildFixtureDoc();
  renderAll(doc, DATA, timeline);
  return { doc, sections, hooks };
}

function allSectionHtml(sections) {
  return SECTION_IDS.map((id) => sections.get(id).innerHTML).join('\n');
}

/** Organisation marks are a different kind of image from the photographs: they
 *  are decorative (the org's name is right beside them as text), they repeat
 *  legitimately across entries, and they sit in a fixed-size chip so they need
 *  no intrinsic dimensions. Strip them before auditing the photographs, and
 *  test them on their own terms below. */
function withoutOrgLogos(html) {
  return html.replace(/<span class="entry-logo[^"]*">.*?<\/span>/gs, '');
}

test('every section renders non-empty HTML', () => {
  const { sections } = renderFixture();
  for (const id of SECTION_IDS) {
    assert.ok(sections.get(id).innerHTML.trim().length > 0, `${id} rendered empty`);
  }
});

test('exactly 15 timeline entries render', () => {
  const { sections } = renderFixture();
  const entries = sections.get('path').innerHTML.match(/<li class="entry is-[a-z]+">/g) || [];
  assert.equal(entries.length, 15);
});

test('no photograph appears more than once across the whole page', () => {
  const { sections } = renderFixture();
  const html = withoutOrgLogos(allSectionHtml(sections));
  const srcs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(srcs.length > 0, 'no images rendered at all');
  const seen = new Set();
  const duplicates = [];
  for (const src of srcs) {
    if (seen.has(src)) duplicates.push(src);
    seen.add(src);
  }
  assert.deepEqual(duplicates, [], `image(s) rendered more than once: ${duplicates.join(', ')}`);
});

test('data-footer-name receives profile.name', () => {
  const { hooks } = renderFixture();
  assert.equal(hooks['[data-footer-name]'].textContent, DATA.profile.name);
});

test('the Dean\'s List verification link renders', () => {
  const { sections } = renderFixture();
  const html = sections.get('path').innerHTML;
  assert.match(html, /Dean&#39;s List/);
  assert.match(html, /<a href="https:\/\/www\.ku\.ac\.ae\/student-life\/honors-list" rel="noopener">Khalifa University honors list<\/a>/);
});

test('the Saal.ai role\'s read-more link targets #work-saal-audit-platform', () => {
  const { sections } = renderFixture();
  const html = sections.get('path').innerHTML;
  const idx = html.indexOf('Graduate Trainee, Data Science');
  assert.ok(idx !== -1, 'Saal.ai graduate trainee entry not found');
  // Slice to the next entry's opening tag (or the end of the list), not the
  // first `</li>` — the entry's own bullet list closes with `</li>` tags of
  // its own well before the entry element's closing tag.
  const nextEntry = html.indexOf('<li class="entry', idx + 1);
  const entryHtml = nextEntry === -1 ? html.slice(idx) : html.slice(idx, nextEntry);
  assert.match(entryHtml, /<a href="#work-saal-audit-platform">Read more about this work<\/a>/);
});

test('every rendered photograph carries non-empty alt, width, height and decoding', () => {
  const { sections } = renderFixture();
  const html = withoutOrgLogos(allSectionHtml(sections));
  const imgs = html.match(/<img\b[^>]*>/g) || [];
  assert.ok(imgs.length > 0, 'no images rendered at all');
  for (const tag of imgs) {
    const alt = tag.match(/\balt="([^"]*)"/);
    assert.ok(alt && alt[1].trim() !== '', `missing/empty alt: ${tag}`);
    const width = tag.match(/\bwidth="(\d+)"/);
    assert.ok(width && Number(width[1]) > 0, `missing/bad width: ${tag}`);
    const height = tag.match(/\bheight="(\d+)"/);
    assert.ok(height && Number(height[1]) > 0, `missing/bad height: ${tag}`);
    assert.match(tag, /\bdecoding="async"/, `missing decoding: ${tag}`);
  }
});

// js/timeline.js has always composed `orgLogo` onto every entry from the
// company and institution logos, and no renderer read it, so not one
// organisation mark rendered. The spec says twice that the Saal.ai mark is what
// carries the photograph-less 2024-2026 stretch of the timeline.
test('the Saal.ai mark renders on its roles, in both themes', () => {
  const { sections } = renderFixture();
  const html = sections.get('path').innerHTML;
  const logos = [...html.matchAll(/<span class="entry-logo[^"]*">.*?<\/span>/gs)].map((m) => m[0]);
  assert.ok(logos.length > 0, 'no organisation mark rendered at all');

  const saal = logos.filter((l) => l.includes('SAAL'));
  assert.equal(saal.length, 2, 'both Saal.ai roles carry the mark');
  for (const mark of saal) {
    assert.match(mark, /class="entry-logo-light" src="assets\/SAAL_LIGHT\.png"/);
    assert.match(mark, /class="entry-logo-dark" src="assets\/SAAL_DARK\.png"/);
    assert.equal(/is-plated/.test(mark), false, 'a two-variant mark needs no plate');
  }

  // The Khalifa, Daman and Al Nahda marks ship in one dark-ink colourway, so
  // they get the light chip that keeps them legible on the dark ground.
  const single = logos.filter((l) => !l.includes('SAAL'));
  assert.ok(single.length >= 3, `expected the single-colourway marks, got ${single.length}`);
  for (const mark of single) assert.match(mark, /class="entry-logo is-plated"/);
});

test('organisation marks are decorative and lazy, since the org name is already text', () => {
  const { sections } = renderFixture();
  const marks = sections.get('path').innerHTML.match(/<span class="entry-logo[^"]*">.*?<\/span>/gs) || [];
  for (const tag of marks.flatMap((m) => m.match(/<img\b[^>]*>/g) || [])) {
    assert.match(tag, /\balt=""/, `an organisation mark would be announced twice: ${tag}`);
    assert.match(tag, /\bloading="lazy"/);
    assert.match(tag, /\bdecoding="async"/);
  }
  // The mark must precede the name it belongs to, not trail it.
  assert.match(sections.get('path').innerHTML, /<span class="entry-logo[^"]*">.*?<\/span><span class="entry-org">/s);
});

test('a project timeline entry carries no images or blocks, only title/org/dateRange/workRef', () => {
  const stmntGroup = TIMELINE.flatMap((g) => g.entries).find((e) => e.id === 'stmnt');
  assert.ok(stmntGroup, 'stmnt project entry not found in the timeline');
  assert.equal(stmntGroup.kind, 'project');
  assert.deepEqual(stmntGroup.images, []);
  assert.deepEqual(stmntGroup.blocks, []);
  assert.equal(stmntGroup.workRef, 'stmnt');
  assert.ok(stmntGroup.title && stmntGroup.org && stmntGroup.dateRange);
});

test('a timeline entry\'s blocks actually render (entryMarkup must call renderBlocks(entry.blocks))', () => {
  // js/timeline.js threads `blocks` through from experience/education roles
  // into every timeline entry, and data/blocks-registry.json scopes several
  // block types (responsibility, honor, thesis, coursework, metric,
  // linked-artifact, image) to experience/education/milestone — but nothing
  // in today's data/*.json happens to populate a role or education item's
  // `blocks` array, so a regression here would render silently, with no
  // error and no failing test. Built by hand rather than via buildTimeline,
  // since no real fixture data exercises this shape.
  const syntheticTimeline = [{
    year: 2099,
    entries: [{
      id: 'fixture-entry', kind: 'education', sortDate: '2099-01', year: 2099, order: null,
      title: 'Fixture Degree', org: 'Fixture University', orgLogo: null, location: '', dateRange: '2099',
      bullets: [], images: [],
      blocks: [{ type: 'linked-artifact', label: 'Fixture link', url: 'https://example.test/fixture' }],
      workRef: null, link: null, note: '',
    }],
  }];
  const { sections } = renderWithTimeline(syntheticTimeline);
  const html = sections.get('path').innerHTML;
  assert.match(html, /class="block-link"/, 'entry.blocks did not render at all');
  assert.match(html, /<a href="https:\/\/example\.test\/fixture">Fixture link<\/a>/);
});

test('the image block renderer neutralises a quote-breakout payload in width and height', async () => {
  const { renderBlock } = await import('../js/blocks.js');
  const html = renderBlock({
    type: 'image',
    src: 'a.jpg',
    alt: 'A descriptive alt string',
    width: '" onerror="alert(1)',
    height: '" onerror="alert(2)',
  });
  assert.equal(/onerror/.test(html), false, `breakout payload survived: ${html}`);
  assert.match(html, /width="0"/);
  assert.match(html, /height="0"/);
});

/** Pull every rendered <img> tag's src, srcset and sizes out of one section. */
function imageHints(html) {
  return [...html.matchAll(/<img\b[^>]*>/g)].map((m) => ({
    tag: m[0],
    src: (m[0].match(/\bsrc="([^"]*)"/) || [])[1],
    srcset: (m[0].match(/\bsrcset="([^"]*)"/) || [])[1],
    sizes: (m[0].match(/\bsizes="([^"]*)"/) || [])[1],
  }));
}

test('srcset w descriptors are the real file widths, per photograph', () => {
  const { sections } = renderFixture();
  const byName = new Map(
    [...imageHints(allSectionHtml(sections))].map((i) => [i.src.split('/').pop(), i]),
  );
  // Six of the nine photographs are portrait-orientation, so their derivatives
  // are narrower than the 800/1600 in their filenames.
  const expected = {
    'portrait-formal-1600.jpg': 'assets/photos/derived/portrait-formal-800.jpg 622w, assets/photos/derived/portrait-formal-1600.jpg 827w',
    'stmnt-01-spending-by-category-1600.jpg': 'assets/photos/derived/stmnt-01-spending-by-category-800.jpg 369w, assets/photos/derived/stmnt-01-spending-by-category-1600.jpg 738w',
    'volunteering-meal-packing-1600.jpg': 'assets/photos/derived/volunteering-meal-packing-800.jpg 478w, assets/photos/derived/volunteering-meal-packing-1600.jpg 630w',
    'graduation-ceremony-certificate-1600.jpg': 'assets/photos/derived/graduation-ceremony-certificate-800.jpg 800w, assets/photos/derived/graduation-ceremony-certificate-1600.jpg 1600w',
  };
  for (const [name, srcset] of Object.entries(expected)) {
    assert.ok(byName.has(name), `${name} did not render`);
    assert.equal(byName.get(name).srcset, srcset);
  }
  // Nothing anywhere may still claim the old blanket 800w/1600w pair.
  const wrong = [...byName.values()].filter(
    (i) => i.srcset && /800w, [^"]*1600w$/.test(i.srcset) && !i.src.includes('graduation-ceremony') && !i.src.includes('honors-day'),
  );
  assert.deepEqual(wrong.map((i) => i.src), []);
});

test('sizes is per-context, not one constant for every gallery', () => {
  const { sections } = renderFixture();
  const hint = (html, name) => imageHints(html).find((i) => i.src.includes(name));

  // A Selected Work screenshot: .work .gallery caps the image at 26rem tall,
  // and 738/1600 of 416px is 192px, so the slot width is a fixed number.
  assert.equal(hint(sections.get('work').innerHTML, 'stmnt-01').sizes, '192px');
  // A lone portrait milestone photograph, capped at 30rem tall.
  assert.equal(hint(sections.get('path').innerHTML, 'volunteering-meal-packing').sizes, '287px');
  // A landscape photograph in one half of the education pair.
  assert.equal(
    hint(sections.get('path').innerHTML, 'graduation-ceremony').sizes,
    '(min-width: 40rem) 18rem, calc(100vw - 2.5rem)',
  );
  // The odd third photograph, which spans both columns.
  assert.equal(
    hint(sections.get('path').innerHTML, 'egaming').sizes,
    '(min-width: 40rem) 37rem, calc(100vw - 2.5rem)',
  );
  // No two galleries share a single blanket value any more.
  const all = imageHints(allSectionHtml(sections)).map((i) => i.sizes).filter(Boolean);
  assert.ok(new Set(all).size >= 4, `expected several distinct sizes hints, got ${JSON.stringify([...new Set(all)])}`);
});

test('the preload offers the browser exactly the candidates the <img> does', () => {
  // Without imagesrcset/imagesizes the preload names one file and the rendered
  // image picks another, so the browser downloads BOTH variants of the portrait
  // — 199KB of them, on the LCP path, for a 176 CSS pixel mark. The three
  // attributes below must therefore mirror what renderHero emits, character for
  // character; if you change one, change the other.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const preload = html.match(/<link rel="preload" as="image"[^>]*>/);
  assert.ok(preload, 'no preload link found for the hero portrait');
  const attr = (name) => (preload[0].match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1];

  const { sections } = renderFixture();
  const rendered = imageHints(sections.get('hero').innerHTML)[0];
  assert.ok(rendered && rendered.src === DATA.profile.portrait.src, 'the hero portrait did not render');

  assert.equal(attr('href'), rendered.src, 'href is the no-imagesrcset fallback');
  assert.equal(attr('imagesrcset'), rendered.srcset);
  assert.equal(attr('imagesizes'), rendered.sizes);
});
