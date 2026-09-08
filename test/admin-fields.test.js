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
  writeField(field, rec, readField(field, rec));
  assert.deepEqual(rec.rows, rows);
  assert.equal(JSON.stringify(rec.rows).includes('[object Object]'), false);
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
