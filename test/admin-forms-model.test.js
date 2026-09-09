import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCollection } from '../admin/schema.js';
import { buildFormModel, modelToData } from '../admin/forms-model.js';
import { recordName, openToken } from '../admin/forms.js';
import { COLLECTIONS } from '../admin/schema.js';

test('single: buildFormModel fills missing nested objects', () => {
  const m = buildFormModel(getCollection('profile'), { name:'A', title:'t' });
  assert.equal(m.contact.email, '');
  assert.equal(m.contact.linkedin.url, '');
});
test('list: buildFormModel preserves items and fills item defaults', () => {
  const m = buildFormModel(getCollection('projects'), { items:[{ title:'P' }] });
  assert.equal(m.items[0].title, 'P');
  assert.deepEqual(m.items[0].tags, []);
  assert.deepEqual(m.items[0].blocks, []);
  assert.equal(m.items[0].links.github, '');
});
test('modelToData round-trips a project and drops empties', () => {
  const c = getCollection('projects');
  const data = { items:[{ title:'P', tags:['X'], links:{ github:'g' }, blocks:[{type:'description',content:'d'}] }] };
  const back = modelToData(c, buildFormModel(c, data));
  assert.equal(back.items[0].title, 'P');
  assert.equal(back.items[0].tags[0], 'X');
  assert.equal(back.items[0].links.github, 'g');
  assert.equal(back.items[0].links.ios, undefined); // empty dropped
  assert.equal(back.items[0].blocks[0].content, 'd');
});

// --- Collapsed records have to say what they are ---------------------------
// A record is a <details> now, so while it is closed its summary is the ONLY
// thing identifying it. A list that named nothing would be a stack of
// identical bars, which is worse than the long form it replaced.

test('a record is named by the field a reader would actually recognise', () => {
  assert.equal(recordName({ id: 'saal-audit-platform', title: 'Procurement audit platform' }, 'Projects', 0),
    'Procurement audit platform');
  assert.equal(recordName({ id: 'x', company: 'Saal.ai' }, 'Experience', 0), 'Saal.ai');
  assert.equal(recordName({ institution: 'Khalifa University' }, 'Education', 0), 'Khalifa University');
});

test('the slug is a last resort, never the first choice', () => {
  // id is a URL slug, not prose. Leading with it would label the projects
  // list "saal-audit-platform" while a human-written title sat unused.
  assert.equal(recordName({ id: 'saal-audit-platform' }, 'Projects', 0), 'saal-audit-platform');
  assert.equal(recordName({ id: 'saal-audit-platform', title: 'Procurement audit platform' }, 'Projects', 0),
    'Procurement audit platform');
});

test('a blank record still gets a distinguishable name', () => {
  // Pressing Add makes an empty record; two of them must not read alike.
  assert.equal(recordName({}, 'Projects', 0), 'Projects 1');
  assert.equal(recordName({}, 'Projects', 1), 'Projects 2');
  assert.equal(recordName({ title: '   ' }, 'Projects', 2), 'Projects 3',
    'whitespace is not a name');
  assert.equal(recordName(undefined, 'Projects', 0), 'Projects 1');
});

test('every list collection has at least one field that can name a record', () => {
  // The guard that matters over time: adding a list collection whose records
  // carry none of the name keys would silently ship a list of "Thing 1".
  for (const c of COLLECTIONS.filter((c) => c.kind !== 'single')) {
    const names = (c.itemFields || []).map((f) => f.name);
    const usable = names.filter((n) => ['title', 'role', 'company', 'institution', 'label', 'name', 'id'].includes(n));
    assert.ok(usable.length, `${c.name} declares no nameable field; its records would all read "${c.label} n"`);
  }
});

test('open state is keyed by the record, not by its position', () => {
  // Keyed by index, reordering two records would hand each the other's
  // disclosure state — the list would appear to open the wrong rows.
  const a = { id: 'saal-audit-platform' };
  const b = { id: 'stmnt' };
  assert.equal(openToken('projects', a, 0), openToken('projects', a, 2),
    'a record keeps its key when it moves');
  assert.notEqual(openToken('projects', a, 0), openToken('projects', b, 0));
  // A record with no id has nothing else to be keyed by.
  assert.equal(openToken('projects', {}, 1), 'projects/#1');
});
