import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeImage, validateSiteData, normalizeSiteImages, loadSiteData } from '../js/data.js';

test('normalizeImage fills optional fields and preserves required ones', () => {
  const img = normalizeImage({ src: 'a.jpg', alt: 'A person at a desk working', width: 10, height: 20 });
  assert.equal(img.src, 'a.jpg');
  assert.equal(img.srcSmall, 'a.jpg', 'srcSmall falls back to src');
  assert.equal(img.caption, '');
  assert.equal(img.width, 10);
});

test('normalizeImage rejects a missing src', () => {
  assert.throws(() => normalizeImage({ alt: 'something descriptive here' }), TypeError);
});

test('normalizeImage rejects missing alt text', () => {
  assert.throws(() => normalizeImage({ src: 'a.jpg' }), TypeError);
});

test('validateSiteData accepts a minimal well-formed payload', () => {
  const result = validateSiteData({
    profile: { name: 'A', nameArabic: 'ب', role: 'R', contact: { email: 'e@x.com' } },
    summary: { content: 'x' },
    settings: { cv: { path: 'a.pdf' }, sections: {}, nav: [] },
    experience: { items: [] },
    education: { items: [] },
    projects: { items: [] },
    milestones: { items: [] },
    metrics: { items: [] },
    skills: { categories: [] },
    registry: {},
  });
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('validateSiteData rejects settings with no nav or no sections', () => {
  // js/render.js's renderChrome calls settings.nav.filter and iterates
  // settings.sections unguarded, so a settings file missing either one throws
  // from inside a renderer and the page shows the load error. This is the check
  // that names the real problem instead.
  const base = {
    profile: { name: 'A', nameArabic: 'ب', role: 'R', contact: { email: 'e@x.com' } },
    summary: { content: 'x' },
    experience: { items: [] }, education: { items: [] }, projects: { items: [] },
    milestones: { items: [] }, metrics: { items: [] }, skills: { categories: [] }, registry: {},
  };
  const noNav = validateSiteData({ ...base, settings: { cv: { path: 'a.pdf' }, sections: {} } });
  assert.equal(noNav.ok, false);
  assert.ok(noNav.errors.some((e) => /nav/.test(e)), noNav.errors.join('; '));

  const noSections = validateSiteData({ ...base, settings: { cv: { path: 'a.pdf' }, nav: [] } });
  assert.equal(noSections.ok, false);
  assert.ok(noSections.errors.some((e) => /sections/.test(e)), noSections.errors.join('; '));
});

test('validateSiteData reports every missing top-level key by name', () => {
  const result = validateSiteData({ profile: { name: 'A' } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('milestones')), result.errors.join('; '));
  assert.ok(result.errors.some((e) => e.includes('metrics')), result.errors.join('; '));
});

test('validateSiteData rejects a profile with no Arabic name', () => {
  const result = validateSiteData({
    profile: { name: 'A', role: 'R', contact: { email: 'e@x.com' } },
    summary: { content: 'x' },
    settings: { cv: { path: 'a.pdf' }, sections: {}, nav: [] },
    experience: { items: [] }, education: { items: [] }, projects: { items: [] },
    milestones: { items: [] }, metrics: { items: [] }, skills: { categories: [] }, registry: {},
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /nameArabic/.test(e)));
});

// --- Ruling: normalizeImage must be wired into loadSiteData, not left dead. ---
// normalizeSiteImages is the pure traversal loadSiteData calls internally; it is
// extracted and exported precisely so this wiring can be tested with no DOM and
// no network, per the ruling's instruction to prefer the pure-function route.

test('normalizeSiteImages fills in optional fields for the portrait and every nested images[] entry', () => {
  const data = {
    profile: { name: 'A', portrait: { src: 'p.jpg', alt: 'A portrait photograph' } },
    experience: { items: [{ company: 'C', roles: [{ id: 'r1', images: [{ src: 'r.jpg', alt: 'A role photo' }] }] }] },
    education: { items: [{ id: 'e1', images: [{ src: 'e.jpg', alt: 'An education photo' }] }] },
    projects: { items: [{ id: 'pr1', images: [{ src: 'pr.jpg', alt: 'A project photo' }] }] },
    milestones: { items: [{ id: 'm1', images: [{ src: 'm.jpg', alt: 'A milestone photo' }] }] },
  };
  const result = normalizeSiteImages(data);
  assert.equal(result.profile.portrait.srcSmall, 'p.jpg');
  assert.equal(result.profile.portrait.caption, '');
  assert.equal(result.experience.items[0].roles[0].images[0].srcSmall, 'r.jpg');
  assert.equal(result.education.items[0].images[0].srcSmall, 'e.jpg');
  assert.equal(result.projects.items[0].images[0].srcSmall, 'pr.jpg');
  assert.equal(result.milestones.items[0].images[0].srcSmall, 'm.jpg');
  // The original objects must not be mutated in place; normalisation replaces them.
  assert.equal('srcSmall' in data.profile.portrait, false);
});

test('normalizeSiteImages tolerates an absent profile.portrait and empty images[] arrays', () => {
  const data = {
    profile: { name: 'A' },
    experience: { items: [{ company: 'C', roles: [{ id: 'r1', images: [] }] }] },
    education: { items: [{ id: 'e1' }] },
    projects: { items: [{ id: 'pr1', images: [] }] },
    milestones: { items: [{ id: 'm1', images: [] }] },
  };
  const result = normalizeSiteImages(data);
  assert.equal(result.profile.portrait, undefined);
  assert.deepEqual(result.education.items[0].images, []);
});

test('normalizeSiteImages rejects a nested image missing alt text, same as normalizeImage', () => {
  const data = {
    profile: { name: 'A' },
    milestones: { items: [{ id: 'm1', images: [{ src: 'm.jpg' }] }] },
  };
  assert.throws(() => normalizeSiteImages(data), TypeError);
});

test('normalizeSiteImages finds and normalises exactly the ten images referenced across data/*.json', () => {
  const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
  const data = {
    profile: load('profile'),
    summary: load('summary'),
    settings: load('settings'),
    experience: load('experience'),
    education: load('education'),
    projects: load('projects'),
    milestones: load('milestones'),
    metrics: load('metrics'),
    skills: load('skills'),
    registry: load('blocks-registry'),
  };
  const { ok, errors } = validateSiteData(data);
  assert.equal(ok, true, errors.join('; '));

  const normalized = normalizeSiteImages(data);
  const count =
    (normalized.profile.portrait ? 1 : 0) +
    normalized.experience.items.reduce((n, c) => n + c.roles.reduce((m, r) => m + r.images.length, 0), 0) +
    normalized.education.items.reduce((n, e) => n + e.images.length, 0) +
    normalized.projects.items.reduce((n, p) => n + p.images.length, 0) +
    normalized.milestones.items.reduce((n, m) => n + m.images.length, 0);

  assert.equal(count, 10, 'traversal must find all ten images referenced across the data files');
  // Every image survived normalizeImage's required-field checks with a real src/alt.
  assert.equal(normalized.profile.portrait.src, 'assets/photos/derived/portrait-formal-1600.jpg');
});

test('loadSiteData wires normalizeSiteImages into the fetched payload, so a missing srcSmall is filled in on load', async (t) => {
  const payload = {
    profile: { name: 'A', nameArabic: 'ب', role: 'R', contact: { email: 'e@x.com' }, portrait: { src: 'p.jpg', alt: 'A portrait, unnormalised' } },
    summary: { content: 'x' },
    settings: { cv: { path: 'a.pdf' }, sections: {}, nav: [] },
    experience: { items: [{ company: 'C', roles: [{ id: 'r1', images: [{ src: 'r.jpg', alt: 'A role image, unnormalised' }] }] }] },
    education: { items: [] },
    projects: { items: [] },
    milestones: { items: [] },
    metrics: { items: [] },
    skills: { categories: [] },
    registry: {},
  };

  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url) => {
    const match = /data\/([\w-]+)\.json$/.exec(String(url));
    const file = match[1];
    const key = Object.keys(payload).find((k) => (k === 'registry' ? file === 'blocks-registry' : file === k));
    return { ok: true, status: 200, json: async () => payload[key] };
  };

  const data = await loadSiteData();
  assert.equal(data.profile.portrait.srcSmall, 'p.jpg', 'portrait normalised by loadSiteData itself');
  assert.equal(data.profile.portrait.caption, '');
  assert.equal(data.experience.items[0].roles[0].images[0].srcSmall, 'r.jpg', 'role image normalised by loadSiteData itself');
});
