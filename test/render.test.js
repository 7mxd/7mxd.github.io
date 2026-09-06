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

function renderFixture() {
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
  renderAll(doc, DATA, TIMELINE);
  return { doc, sections, hooks };
}

function allSectionHtml(sections) {
  return SECTION_IDS.map((id) => sections.get(id).innerHTML).join('\n');
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

test('no image src appears more than once across the whole page', () => {
  const { sections } = renderFixture();
  const html = allSectionHtml(sections);
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

test('every rendered img carries non-empty alt, width, height and decoding', () => {
  const { sections } = renderFixture();
  const html = allSectionHtml(sections);
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

test('a project timeline entry carries no images or blocks, only title/org/dateRange/workRef', () => {
  const stmntGroup = TIMELINE.flatMap((g) => g.entries).find((e) => e.id === 'stmnt');
  assert.ok(stmntGroup, 'stmnt project entry not found in the timeline');
  assert.equal(stmntGroup.kind, 'project');
  assert.deepEqual(stmntGroup.images, []);
  assert.deepEqual(stmntGroup.blocks, []);
  assert.equal(stmntGroup.workRef, 'stmnt');
  assert.ok(stmntGroup.title && stmntGroup.org && stmntGroup.dateRange);
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

test('the preloaded hero portrait href matches profile.portrait.src exactly', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const preload = html.match(/<link rel="preload" as="image" href="([^"]*)"/);
  assert.ok(preload, 'no preload link found for the hero portrait');
  assert.equal(preload[1], DATA.profile.portrait.src);
});
