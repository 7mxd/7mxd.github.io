import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blockTypesForScope, fieldsForBlock, newBlock } from '../admin/blocks-model.js';
const reg = JSON.parse(readFileSync(new URL('../data/blocks-registry.json', import.meta.url)));

test('project scope includes description and ascii-chart, excludes responsibility', () => {
  const types = blockTypesForScope(reg, 'project').map(t => t.type);
  assert.ok(types.includes('description') && types.includes('ascii-chart'));
  assert.ok(!types.includes('responsibility'));
});
test('experience scope includes responsibility', () => {
  assert.ok(blockTypesForScope(reg, 'experience').map(t=>t.type).includes('responsibility'));
});
test('newBlock seeds the type and empty fields', () => {
  const b = newBlock(reg, 'metric');
  assert.equal(b.type, 'metric');
  assert.equal(b.label, ''); assert.equal(b.value, '');
});
test('fieldsForBlock returns the registry field list', () => {
  const f = fieldsForBlock(reg, 'ascii-chart').map(x => x.name);
  assert.deepEqual(f, ['caption','chart']);
});
