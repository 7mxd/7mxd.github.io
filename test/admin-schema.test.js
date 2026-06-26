import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTIONS, getCollection } from '../admin/schema.js';

const VALID_TYPES = new Set(['string','text','boolean','select','image','object','list','blocks']);

test('all 7 collections present', () => {
  assert.deepEqual(COLLECTIONS.map(c => c.name).sort(),
    ['education','experience','profile','projects','settings','skills','summary']);
});
test('every field has name/label and a valid type', () => {
  const walk = (fields) => fields.forEach(f => {
    assert.ok(f.name && f.label, `field missing name/label: ${JSON.stringify(f)}`);
    assert.ok(VALID_TYPES.has(f.type), `bad type ${f.type} on ${f.name}`);
    if (f.type === 'object') assert.ok(Array.isArray(f.fields));
    if (f.type === 'list') assert.ok(Array.isArray(f.fields) || f.itemField, `list ${f.name} needs fields or itemField`);
    if (f.type === 'select') assert.ok(Array.isArray(f.options));
    if (f.type === 'blocks') assert.ok(['project','experience','education'].includes(f.scope));
    if (f.fields) walk(f.fields);
  });
  for (const c of COLLECTIONS) {
    assert.ok(c.file && c.label && (c.kind === 'single' || c.kind === 'list'));
    if (c.kind === 'list') assert.ok(c.listKey && Array.isArray(c.itemFields));
    walk(c.kind === 'list' ? c.itemFields : c.fields);
  }
});
test('projects item has cluster + tags + blocks(scope project)', () => {
  const p = getCollection('projects');
  const names = p.itemFields.map(f => f.name);
  assert.ok(names.includes('cluster') && names.includes('tags'));
  assert.ok(p.itemFields.some(f => f.type === 'blocks' && f.scope === 'project'));
});
test('settings has graph.clusters and theme', () => {
  const s = getCollection('settings');
  const graph = s.fields.find(f => f.name === 'graph');
  assert.ok(graph && graph.fields.some(f => f.name === 'clusters'));
  assert.ok(s.fields.some(f => f.name === 'theme' && f.type === 'select'));
});
