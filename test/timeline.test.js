// test/timeline.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTimeline } from '../js/timeline.js';

const load = (n) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), 'utf8'));
const REAL = {
  experience: load('experience'), education: load('education'),
  projects: load('projects'), milestones: load('milestones'),
};

const empty = { experience: { items: [] }, education: { items: [] }, projects: { items: [] }, milestones: { items: [] } };

const withRole = (over = {}) => ({
  items: [{
    company: 'Saal.ai', location: 'Abu Dhabi, UAE', logo: { default: 'a.png' },
    roles: [{ id: 'r1', title: 'Graduate Trainee', startDate: '2024-09', endDate: 'Present', displayDate: 'Sep 2024 — Present', bullets: ['b1'], images: [], blocks: [], workRef: 'saal-audit-platform', ...over }],
  }],
});

test('returns year groups in descending order', () => {
  const out = buildTimeline({
    ...empty,
    education: { items: [{ id: 'e1', institution: 'KU', degree: 'BSc', endDate: '2023-05', displayDate: '2018 — 2023', images: [], blocks: [] }] },
    experience: withRole(),
  });
  assert.deepEqual(out.map((g) => g.year), [2024, 2023]);
});

test('one entry is produced per role, not per company', () => {
  const experience = { items: [{
    company: 'Saal.ai', location: 'Abu Dhabi, UAE', logo: {},
    roles: [
      { id: 'r1', title: 'Graduate Trainee', startDate: '2024-09', endDate: 'Present', displayDate: 'x', bullets: [], images: [], blocks: [] },
      { id: 'r2', title: 'Intern', startDate: '2024-03', endDate: '2024-09', displayDate: 'y', bullets: [], images: [], blocks: [] },
    ],
  }] };
  const out = buildTimeline({ ...empty, experience });
  const entries = out.flatMap((g) => g.entries);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((e) => e.id), ['r1', 'r2']);
  assert.equal(entries[0].org, 'Saal.ai', 'the company name becomes the entry org');
});

test('entries sharing a date sort role, education, project, milestone', () => {
  const out = buildTimeline({
    experience: { items: [{ company: 'C', location: '', logo: {}, roles: [{ id: 'role', title: 'T', startDate: '2023-05', endDate: 'x', displayDate: 'd', bullets: [], images: [], blocks: [] }] }] },
    education: { items: [{ id: 'edu', institution: 'KU', degree: 'BSc', endDate: '2023-05', displayDate: 'd', images: [], blocks: [] }] },
    projects: { items: [{ id: 'proj', title: 'P', timeline: true, startDate: '2023-05', displayDate: 'd', blocks: [], images: [], tags: [], links: {} }] },
    milestones: { items: [{ id: 'mile', kind: 'award', date: '2023-05', title: 'M', org: 'O', note: '', images: [] }] },
  });
  assert.deepEqual(out[0].entries.map((e) => e.id), ['role', 'edu', 'proj', 'mile']);
});

test('an explicit order field outranks kind precedence', () => {
  const out = buildTimeline({
    ...empty,
    education: { items: [{ id: 'edu', institution: 'KU', degree: 'BSc', endDate: '2023-05', displayDate: 'd', images: [], blocks: [], order: 1 }] },
    milestones: { items: [{ id: 'mile', kind: 'award', date: '2023-05', title: 'M', org: 'O', note: '', images: [], order: 0 }] },
  });
  assert.deepEqual(out[0].entries.map((e) => e.id), ['mile', 'edu']);
});

test('projects are included only when timeline is true', () => {
  const out = buildTimeline({
    ...empty,
    projects: { items: [
      { id: 'shown', title: 'A', timeline: true, startDate: '2026-02', displayDate: 'd', blocks: [], images: [], tags: [], links: {} },
      { id: 'hidden', title: 'B', timeline: false, startDate: '2024-09', displayDate: 'd', blocks: [], images: [], tags: [], links: {} },
      { id: 'absent', title: 'C', startDate: '2020-01', displayDate: 'd', blocks: [], images: [], tags: [], links: {} },
    ] },
  });
  assert.deepEqual(out.flatMap((g) => g.entries).map((e) => e.id), ['shown']);
});

test('entries with a missing or malformed date are dropped rather than crashing', () => {
  const out = buildTimeline({
    ...empty,
    milestones: { items: [
      { id: 'ok', kind: 'award', date: '2022-06', title: 'M', org: 'O', note: '', images: [] },
      { id: 'nodate', kind: 'award', title: 'M', org: 'O', note: '', images: [] },
      { id: 'garbage', kind: 'award', date: 'sometime', title: 'M', org: 'O', note: '', images: [] },
    ] },
  });
  assert.deepEqual(out.flatMap((g) => g.entries).map((e) => e.id), ['ok']);
});

test('a bare four-digit year is accepted', () => {
  const out = buildTimeline({
    ...empty,
    education: { items: [{ id: 'school', institution: 'Al Nahda', degree: 'Diploma', endDate: '2018', displayDate: '2015 — 2018', images: [], blocks: [] }] },
  });
  assert.equal(out[0].year, 2018);
});

test('workRef survives composition so the entry can link into Selected Work', () => {
  const out = buildTimeline({ ...empty, experience: withRole() });
  assert.equal(out[0].entries[0].workRef, 'saal-audit-platform');
});

test('a milestone verification link survives composition', () => {
  const link = { url: 'https://www.ku.ac.ae/student-life/honors-list', label: 'Khalifa University honors list' };
  const out = buildTimeline({
    ...empty,
    milestones: { items: [{ id: 'deans', kind: 'award', date: '2022-12', title: "Dean's List", org: 'KU', note: '', link, images: [] }] },
  });
  assert.deepEqual(out[0].entries[0].link, link);
});

test('entries without a link carry null rather than undefined', () => {
  const out = buildTimeline({ ...empty, experience: withRole() });
  assert.equal(out[0].entries[0].link, null);
});

test('entries without an explicit order carry null rather than undefined', () => {
  const out = buildTimeline({ ...empty, experience: withRole() });
  assert.equal(out[0].entries[0].order, null);
});

test('an impossible month is dropped, but 01 and 12 are kept', () => {
  const out = buildTimeline({
    ...empty,
    education: { items: [
      { id: 'bad-13', institution: 'X', degree: 'D', endDate: '2018-13', displayDate: 'd', images: [], blocks: [] },
      { id: 'bad-00', institution: 'X', degree: 'D', endDate: '2018-00', displayDate: 'd', images: [], blocks: [] },
      { id: 'good-01', institution: 'X', degree: 'D', endDate: '2018-01', displayDate: 'd', images: [], blocks: [] },
      { id: 'good-12', institution: 'X', degree: 'D', endDate: '2018-12', displayDate: 'd', images: [], blocks: [] },
    ] },
  });
  const ids = out.flatMap((g) => g.entries).map((e) => e.id);
  assert.deepEqual(ids.sort(), ['good-01', 'good-12']);
});

test('an empty payload produces an empty timeline, not an error', () => {
  assert.deepEqual(buildTimeline(empty), []);
});

test('every composed entry says which file and record it came from', () => {
  // The admin resolves a timeline row back to the record behind it. Without
  // this it would have to reimplement composition, which is the drift the
  // shared-code rule exists to prevent.
  const groups = buildTimeline(REAL);
  const entries = groups.flatMap((g) => g.entries);
  assert.ok(entries.length > 0);
  const collections = new Set(['experience', 'education', 'projects', 'milestones']);
  for (const e of entries) {
    assert.ok(e.source, `${e.id} has no source`);
    assert.ok(collections.has(e.source.collection), `${e.id}: ${e.source.collection}`);
    assert.equal(e.source.id, e.id, `${e.id}: source.id must address the record`);
  }
});

test('no two records share an id, so source.id addresses exactly one', () => {
  const groups = buildTimeline(REAL);
  const ids = groups.flatMap((g) => g.entries).map((e) => e.source.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id across the timeline');
});
