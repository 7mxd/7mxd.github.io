import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readField, writeField, blankValue, moveItem } from '../admin/fields.js';

test('a number field writes a Number, never the input string', () => {
  // Image width and height become HTML attributes the browser reserves space
  // with; a string there ships width="0" and reintroduces layout shift.
  const rec = {};
  writeField({ name: 'width', type: 'number' }, rec, '1600');
  assert.strictEqual(rec.width, 1600);
  writeField({ name: 'width', type: 'number' }, rec, '');
  assert.strictEqual(rec.width, '');
});

test('a boolean field writes a Boolean', () => {
  const rec = {};
  writeField({ name: 'primary', type: 'boolean' }, rec, true);
  assert.strictEqual(rec.primary, true);
});

test('a list of scalars round-trips through text', () => {
  const field = { name: 'items', type: 'list', itemField: { name: 'item', type: 'string' } };
  const rec = { items: ['Topology', 'Optimization'] };
  assert.deepEqual(readField(field, rec), ['Topology', 'Optimization']);
  writeField(field, rec, ['Topology', 'Optimization', 'Real Analysis']);
  assert.deepEqual(rec.items, ['Topology', 'Optimization', 'Real Analysis']);
});

test('a list of records survives a read and a write unchanged', () => {
  // THE regression guard. The old editor rendered any list as
  // rows.join('\n') and wrote back value.split('\n'), which replaced the
  // benchmark table with three literal "[object Object]" strings.
  const field = {
    name: 'rows', type: 'list',
    fields: [
      { name: 'label', type: 'string' },
      { name: 'value', type: 'string' },
      { name: 'highlight', type: 'boolean' },
    ],
  };
  const rows = [
    { label: 'Competition winner, 1993', value: '0.028' },
    { label: 'This work, iterative KRLS', value: '0.043', highlight: true },
  ];
  const rec = { rows };
  assert.deepEqual(readField(field, rec), rows);

  // Write a genuinely different array — a deep copy with one value edited,
  // one highlight flipped, and one row added — rather than the same
  // reference already sitting at rec.rows. Round-tripping the identical
  // reference through writeField would pass even if writeField ignored its
  // `raw` argument entirely, which is exactly the write path that used to
  // discard real data and leave three literal "[object Object]" strings.
  const edited = rows.map((r) => ({ ...r }));
  edited[0].value = '0.031';
  edited[1].highlight = false;
  edited.push({ label: 'Runner-up, 1993', value: '0.035' });

  writeField(field, rec, edited);
  assert.deepEqual(rec.rows, edited);
  assert.notDeepEqual(rec.rows, rows);
  assert.equal(JSON.stringify(rec.rows).includes('[object Object]'), false);
});

test('readField returns an empty list for a blocks field with no value yet', () => {
  // blankValue({ type: 'blocks' }) is []; readField must agree, or
  // controlFor's blocks case hands ctx.renderBlocks a '' to .forEach over.
  assert.deepEqual(readField({ type: 'blocks', name: 'blocks' }, {}), []);
});

test('blankValue matches the shape the field declares', () => {
  assert.deepEqual(blankValue({ type: 'list', fields: [{ name: 'a', type: 'string' }] }), []);
  assert.deepEqual(blankValue({ type: 'list', itemField: { type: 'string' } }), []);
  assert.deepEqual(blankValue({ type: 'object', fields: [{ name: 'url', type: 'string' }] }), { url: '' });
  assert.strictEqual(blankValue({ type: 'boolean' }), false);
  assert.strictEqual(blankValue({ type: 'number' }), '');
  assert.strictEqual(blankValue({ type: 'string' }), '');
});

test('a new record in a list of records has every declared key', () => {
  const field = { type: 'list', fields: [
    { name: 'label', type: 'string' }, { name: 'highlight', type: 'boolean' } ] };
  assert.deepEqual(blankValue(field.fields ? { type: 'object', fields: field.fields } : {}),
    { label: '', highlight: false });
});

test('moveItem reorders and clamps', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 3), ['a', 'b', 'c']);
});

import { fieldsForBlock, newBlock } from '../admin/blocks-model.js';
import { readFileSync } from 'node:fs';
const REGISTRY = JSON.parse(
  readFileSync(new URL('../data/blocks-registry.json', import.meta.url), 'utf8'));

test('a new benchmark block starts with the shape its rows declare', () => {
  const block = newBlock(REGISTRY, 'benchmark');
  assert.deepEqual(block.rows, []);
  const rows = fieldsForBlock(REGISTRY, 'benchmark').find((f) => f.name === 'rows');
  assert.deepEqual(blankValue({ type: 'object', fields: rows.fields }),
    { label: '', value: '', highlight: false });
});

test('every field type in the registry is one the renderer implements', () => {
  const IMPLEMENTED = new Set(['string', 'text', 'code', 'url', 'number',
    'boolean', 'select', 'image', 'object', 'list', 'blocks']);
  for (const [type, entry] of Object.entries(REGISTRY)) {
    if (type.startsWith('_')) continue;
    for (const f of entry.fields || []) {
      assert.ok(IMPLEMENTED.has(f.type), `${type}.${f.name} is type ${f.type}`);
    }
  }
});
