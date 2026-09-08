// test/admin-completeness.test.js
//
// Ahmed's requirement was "all items should be editable through the admin
// page". This is that sentence as a test: it walks the real content files and
// fails if anything in them has no declared editor. It is the difference
// between "everything is touchable" being true by construction and being true
// because somebody checked once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLLECTIONS } from '../admin/schema.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const REGISTRY = load('data/blocks-registry.json');

/** Every key path present in a record, as dotted names. Array indices collapse
 *  to `[]` because the schema declares one field for a whole list. */
function keyPaths(value, prefix = '') {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((v) => keyPaths(v, prefix)))];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      [prefix ? `${prefix}.${k}` : k, ...keyPaths(v, prefix ? `${prefix}.${k}` : k)]);
  }
  return [];
}

/** Every key path the schema declares, in the same notation. */
function declaredPaths(fields, prefix = '') {
  return fields.flatMap((f) => {
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    if (f.type === 'object') return [path, ...declaredPaths(f.fields || [], path)];
    if (f.type === 'list' && Array.isArray(f.fields)) return [path, ...declaredPaths(f.fields, path)];
    if (f.type === 'blocks') return [path];
    return [path];
  });
}

for (const collection of COLLECTIONS) {
  test(`${collection.name}: every key in the file has a declared editor`, () => {
    const data = load(collection.file);
    const records = collection.kind === 'list' ? (data[collection.listKey] || []) : [data];
    const fields = collection.kind === 'list' ? collection.itemFields : collection.fields;
    const declared = new Set(declaredPaths(fields));

    const present = [...new Set(records.flatMap((r) => keyPaths(r)))];
    // `blocks` contents are declared by the registry, not the schema. This has
    // to be a segment check rather than a prefix check: a role's blocks live
    // at `roles.blocks.*`, not at the top of the path, so `startsWith('blocks.')`
    // would miss them and call editable keys uneditable the moment a role
    // actually has a block in it.
    const missing = present.filter((p) => !declared.has(p) && !p.split('.').includes('blocks'));
    assert.deepEqual(missing, [],
      `${collection.file} has keys the admin cannot edit: ${missing.join(', ')}`);
  });
}

test('every block type in the registry can be held by some collection', () => {
  const scopes = new Set();
  for (const c of COLLECTIONS) {
    const fields = c.kind === 'list' ? c.itemFields : c.fields;
    for (const f of fields) if (f.type === 'blocks') scopes.add(f.scope);
    // Nested: experience declares blocks inside roles.
    for (const f of fields) {
      if (f.type === 'list' && Array.isArray(f.fields)) {
        for (const g of f.fields) if (g.type === 'blocks') scopes.add(g.scope);
      }
    }
  }
  for (const [type, entry] of Object.entries(REGISTRY)) {
    if (type.startsWith('_')) continue;
    const reachable = (entry.scope || []).some((s) => scopes.has(s));
    assert.ok(reachable, `block type "${type}" has no collection that can hold it`);
  }
});

test('every block field declared in the registry appears in real data or is optional', () => {
  // A declared field nobody uses is not a defect; a USED field nobody declared
  // is, because it is what the save silently drops.
  const files = ['data/projects.json', 'data/experience.json', 'data/education.json'];
  const used = new Map();
  for (const f of files) {
    const data = load(f);
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      if (node.type && REGISTRY[node.type]) {
        const set = used.get(node.type) || new Set();
        Object.keys(node).forEach((k) => k !== 'type' && set.add(k));
        used.set(node.type, set);
      }
      Object.values(node).forEach(walk);
    };
    walk(data);
  }
  for (const [type, keys] of used) {
    const declared = new Set((REGISTRY[type].fields || []).map((f) => f.name));
    const missing = [...keys].filter((k) => !declared.has(k));
    assert.deepEqual(missing, [], `block "${type}" uses undeclared fields: ${missing.join(', ')}`);
  }
});
