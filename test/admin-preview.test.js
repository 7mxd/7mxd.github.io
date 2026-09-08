import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeForPreview, createPreview } from '../admin/preview.js';
import { buildTimeline } from '../js/timeline.js';

const load = (n) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), 'utf8'));
const BASE = {
  profile: load('profile'), summary: load('summary'), settings: load('settings'),
  experience: load('experience'), education: load('education'), projects: load('projects'),
  milestones: load('milestones'), metrics: load('metrics'), skills: load('skills'),
  registry: load('blocks-registry'),
};

test('merging replaces one collection and leaves the rest alone', () => {
  const edited = { items: [{ value: '99', label: 'edited' }] };
  const merged = mergeForPreview(BASE, 'metrics', edited);
  assert.deepEqual(merged.metrics, edited);
  assert.deepEqual(merged.profile, BASE.profile);
  assert.notStrictEqual(merged, BASE, 'must not mutate the base dataset');
});

test('a merged dataset still composes a timeline', () => {
  // The preview renders through the site's own pipeline; if the merge produced
  // something buildTimeline cannot read, the preview would show a blank page
  // and look like a rendering bug rather than a data one.
  const edited = JSON.parse(JSON.stringify(BASE.milestones));
  edited.items.push({ id: 'new', kind: 'award', date: '2026-03', title: 'New', images: [] });
  const merged = mergeForPreview(BASE, 'milestones', edited);
  const entries = buildTimeline(merged).flatMap((g) => g.entries);
  assert.ok(entries.some((e) => e.id === 'new'));
});

// The readiness handshake, which is where this module has actually gone wrong.
// createPreview needs nothing but addEventListener, a contentDocument and a
// parent node, so the fakes below are a few plain objects over Node's own
// EventTarget — no DOM, no jsdom, no dependency. renderAll is never reached:
// `getBase` returns a promise that never settles, so a call to it is the proof
// that readiness fired and update() got as far as rendering.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeDocument({ readyState = 'complete', url = 'https://admin.test/', rendered = true } = {}) {
  const doc = new EventTarget();
  doc.readyState = readyState;
  doc.URL = url;
  doc.documentElement = { dataset: rendered ? { rendered: 'true' } : {} };
  return doc;
}

function fakeIframe(doc) {
  const pane = { kids: [], appendChild(n) { this.kids.push(n); n.parent = this; return n; } };
  const iframe = new EventTarget();
  iframe.contentDocument = doc;
  iframe.hidden = false;
  iframe.parentNode = pane;
  iframe.ownerDocument = {
    createElement: () => ({
      setAttribute() {},
      remove() {
        const i = this.parent.kids.indexOf(this);
        if (i >= 0) this.parent.kids.splice(i, 1);
      },
    }),
  };
  return { iframe, pane };
}

test('a preview built after the iframe already loaded still reaches the frame', async () => {
  // The warm-cache case. app.js constructs the preview only once loadAll()'s
  // ten authenticated, never-cached GitHub calls resolve, while <iframe src="/">
  // starts navigating at parse time — so `load` has usually already fired and
  // there is no event left to hear. Listening for it and nothing else left
  // `ready` false forever and parked every edit, silently.
  const { iframe } = fakeIframe(fakeDocument({ rendered: true }));
  let asked = false;
  const preview = createPreview(iframe, () => { asked = true; return new Promise(() => {}); },
    { timeout: 50 });
  preview.update('metrics', { items: [] });
  await sleep(320); // past the 250ms input debounce
  assert.equal(asked, true, 'the update never reached the render path');
});

test('the initial about:blank document is not mistaken for the site', async () => {
  // Every iframe starts on about:blank. Claiming it would spend the single
  // attach on a document already on its way out and leave the real one
  // unwatched — the same dead preview, reached from the other side.
  const { iframe } = fakeIframe(fakeDocument({ url: 'about:blank', rendered: false }));
  let asked = false;
  const preview = createPreview(iframe, () => { asked = true; return new Promise(() => {}); },
    { timeout: 5000 });
  preview.update('metrics', { items: [] });
  await sleep(320);
  assert.equal(asked, false, 'about:blank was treated as a rendered site');

  iframe.contentDocument = fakeDocument({ rendered: true });
  iframe.dispatchEvent(new Event('load'));
  await sleep(50);
  assert.equal(asked, true, 'the real document, arriving on load, was never watched');
});

test('a frame that navigates away before rendering is re-claimed on its next load', async () => {
  // watchDocument() sets `watching = true` once it claims a document and
  // never clears it, so a first document that never dispatches site:rendered
  // before the frame moves on leaves the module thinking a claim is still
  // live. A second, real load event must still get through — the claim
  // tracks the document, not the module's lifetime.
  const { iframe } = fakeIframe(fakeDocument({ rendered: false }));
  let asked = false;
  const preview = createPreview(iframe, () => { asked = true; return new Promise(() => {}); },
    { timeout: 5000 });
  preview.update('metrics', { items: [] });
  await sleep(320);
  assert.equal(asked, false, 'setup: the first document must not already read as rendered');

  // Navigate away before the first document ever announced site:rendered.
  iframe.contentDocument = fakeDocument({ rendered: true });
  iframe.dispatchEvent(new Event('load'));
  await sleep(50);
  assert.equal(asked, true, 'the second document, arriving on its own load, was never re-claimed');
});

test('readiness that never arrives becomes a visible state, not a silent stall', async () => {
  const { iframe, pane } = fakeIframe(fakeDocument({ rendered: false }));
  createPreview(iframe, async () => ({}), { timeout: 20 });
  await sleep(80);
  assert.equal(pane.kids.length, 1, 'nothing was put in the pane');
  assert.equal(iframe.hidden, true, 'the stale frame is still on screen under the notice');

  // Late is not never: if the site does eventually render, the notice goes.
  iframe.contentDocument.dispatchEvent(new Event('site:rendered'));
  assert.equal(pane.kids.length, 0);
  assert.equal(iframe.hidden, false);
});
