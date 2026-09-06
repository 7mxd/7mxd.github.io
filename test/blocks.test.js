import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderBlock, renderBlocks, imageMarkup } from '../js/blocks.js';

test('escapeHtml neutralises angle brackets, quotes, and ampersands', () => {
  assert.equal(escapeHtml('<script>"x"&\'y\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;');
});

test('a description block becomes a paragraph with escaped content', () => {
  const html = renderBlock({ type: 'description', content: 'Audits <ERP> data' });
  assert.match(html, /^<p class="block-text">/);
  assert.match(html, /&lt;ERP&gt;/);
});

test('a benchmark block renders a table and marks the highlighted row', () => {
  const html = renderBlock({
    type: 'benchmark', unit: 'NMSE', caption: 'Santa Fe laser series',
    rows: [
      { label: 'Winner', value: '0.028' },
      { label: 'This work', value: '0.042', highlight: true },
    ],
  });
  assert.match(html, /<table class="benchmark"/);
  assert.match(html, /NMSE/);
  assert.match(html, /class="is-mine"/);
  assert.match(html, /Santa Fe laser series/);
});

test('a callout block carries its tone as a modifier class', () => {
  const html = renderBlock({ type: 'callout', tone: 'note', content: 'No screenshots exist.' });
  assert.match(html, /block-callout is-note/);
});

test('an unknown block type renders nothing rather than throwing', () => {
  assert.equal(renderBlock({ type: 'ascii-chart', chart: 'xxx' }), '');
});

test('consecutive responsibility blocks are wrapped in one real list', () => {
  const html = renderBlocks([
    { type: 'description', content: 'intro' },
    { type: 'responsibility', content: 'first duty' },
    { type: 'responsibility', content: 'second duty' },
    { type: 'description', content: 'outro' },
    { type: 'responsibility', content: 'later duty' },
  ]);
  assert.equal((html.match(/<ul class="block-bullets">/g) || []).length, 2,
    'each run of bullets gets its own list, and a run is not merged across other blocks');
  assert.equal(/<li class="block-bullet">[^]*?<\/li>\s*<p/.test(html), false);
  // No <li> may appear outside a <ul>: strip the lists and none should remain.
  const withoutLists = html.replace(/<ul class="block-bullets">[^]*?<\/ul>/g, '');
  assert.equal(/<li\b/.test(withoutLists), false, 'a bare <li> escaped its list');
  assert.match(html, /<ul class="block-bullets"><li class="block-bullet">first duty<\/li><li class="block-bullet">second duty<\/li><\/ul>/);
});

test('renderBlocks joins several blocks and tolerates an empty list', () => {
  const html = renderBlocks([
    { type: 'description', content: 'one' },
    { type: 'description', content: 'two' },
  ]);
  assert.equal((html.match(/<p class="block-text">/g) || []).length, 2);
  assert.equal(renderBlocks([]), '');
  assert.equal(renderBlocks(undefined), '');
});

test('imageMarkup emits a figure with srcset, dimensions, and lazy loading', () => {
  const html = imageMarkup({
    src: 'a-1600.jpg', srcSmall: 'a-800.jpg', alt: 'A descriptive alt string',
    caption: 'A caption', width: 1600, height: 1067,
  }, '(min-width: 40rem) 46rem, 100vw');
  assert.match(html, /<figure/);
  assert.match(html, /srcset="a-800\.jpg 800w, a-1600\.jpg 1600w"/);
  assert.match(html, /width="1600"/);
  assert.match(html, /height="1067"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /<figcaption>A caption<\/figcaption>/);
});

test('imageMarkup omits the caption element when there is no caption', () => {
  const html = imageMarkup({ src: 'a.jpg', srcSmall: 'a.jpg', alt: 'Alt text here', caption: '', width: 10, height: 10 }, '100vw');
  assert.equal(/figcaption/.test(html), false);
});
