import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeForPreview } from '../admin/preview.js';
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
