// test/admin-timeline-edit.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTimeline } from '../js/timeline.js';
import { resolveEntry, newRecordFor, placeRecord, locate } from '../admin/timeline-edit.js';
import { TIMELINE_KINDS, getCollection } from '../admin/schema.js';
import { validateModel } from '../admin/validate.js';

const load = (n) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), 'utf8'));
const DATA = {
  experience: load('experience'), education: load('education'),
  projects: load('projects'), milestones: load('milestones'),
};

test('every entry on the rail resolves to exactly one record', () => {
  // This is the promise the new navigation makes: click a row, get its record.
  const entries = buildTimeline(DATA).flatMap((g) => g.entries);
  assert.ok(entries.length >= 17);
  for (const e of entries) {
    const { collection, record } = resolveEntry(e, DATA);
    assert.equal(collection, e.source.collection, `${e.id} resolved to the wrong file`);
    assert.equal(record.id, e.source.id, `${e.id} resolved to the wrong record`);
  }
});

test('an entry whose record has vanished fails loudly', () => {
  const entries = buildTimeline(DATA).flatMap((g) => g.entries);
  const ghost = { ...entries[0], source: { collection: 'milestones', id: 'nope' } };
  assert.throws(() => resolveEntry(ghost, DATA), /nope/);
});

test('every add-entry kind produces a record its collection accepts', () => {
  // The seed is widened past the brief's literal {id, title, date}: 'job'
  // returns a role (newRecordFor pulls the roles sub-schema for experience),
  // but this test validates it by wrapping it as { items: [record] } and
  // checking it against the experience collection's own itemFields — the
  // company shape, since that is the only schema validateModel has for
  // "one entry in experience.items". That shape requires `company`, so a
  // seeded role record trips "Company is required" even though a role has no
  // company field of its own. `institution` is the same story for education:
  // genuinely required content (a nameless institution renders nothing
  // meaningful on the timeline), just not supplied by the base seed. Both are
  // widened here rather than dropped from `required` in schema.js, since both
  // are real content the site depends on.
  const seed = {
    id: 'test-id', title: 'Test', date: '2026-01',
    company: 'Test Co', institution: 'Test University',
  };
  for (const kind of TIMELINE_KINDS) {
    const record = newRecordFor(kind.key, seed);
    const collection = getCollection(kind.collection);
    assert.ok(collection, `${kind.key} names a collection that does not exist`);
    const model = collection.kind === 'list'
      ? { [collection.listKey]: [record] } : record;
    const errs = validateModel(collection, model);
    assert.deepEqual(errs, [], `${kind.key}: ${errs.map((e) => e.path).join(', ')}`);
  }
});

test('placeRecord gives a new job its own company, everyone else their list', () => {
  const data = {
    experience: { items: [{ company: 'Existing Co', roles: [{ id: 'r1' }] }] },
    milestones: { items: [] },
  };
  const role = newRecordFor('job', { id: 'r2', title: 'New role', company: 'Ignored' });
  const placed = placeRecord('job', role, data);
  assert.equal(placed, role, 'placeRecord returns the same record it was given');
  assert.equal(data.experience.items.length, 2, 'the role gets a company of its own, not a shared one');
  assert.deepEqual(data.experience.items[1].roles, [role]);
  // A role has no company field of its own — newRecordFor pulls the roles
  // sub-schema, which does not declare one — so the shell company's name
  // starts blank rather than picking up whatever the caller happened to seed
  // the role with.
  assert.equal(data.experience.items[1].company, '');
  assert.equal(data.experience.items[0].roles.length, 1, 'the existing company is untouched');

  const cert = newRecordFor('certification', { id: 'c1', title: 'Cert', date: '2026-01' });
  placeRecord('certification', cert, data);
  assert.deepEqual(data.milestones.items, [cert]);
});

test('locate finds a record by identity, nested or flat, blank id and all', () => {
  // app.js scrolls to and focuses records this way instead of by id, because
  // a freshly added record's id is blank ('') until the owner names it, and
  // every other unsaved add shares that same blank id — identity never does.
  const roleA = { id: '', title: 'A' };
  const roleB = { id: '', title: 'B' };
  const data = {
    experience: { items: [
      { company: 'Co 1', roles: [roleA] },
      { company: 'Co 2', roles: [roleB] },
    ] },
    milestones: { items: [{ id: 'm1' }, { id: '' }] },
  };
  assert.deepEqual(locate('experience', roleA, data), { index: 0, roleIndex: 0 });
  assert.deepEqual(locate('experience', roleB, data), { index: 1, roleIndex: 0 });
  const blankMilestone = data.milestones.items[1];
  assert.deepEqual(locate('milestones', blankMilestone, data), { index: 1 });
  assert.equal(locate('milestones', { id: 'm1' }, data), null, 'a copy is not the same record');
  assert.equal(locate('experience', { id: 'ghost' }, data), null);
});
