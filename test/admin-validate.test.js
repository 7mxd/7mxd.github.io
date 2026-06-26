import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCollection } from '../admin/schema.js';
import { buildFormModel } from '../admin/forms-model.js';
import { validateModel } from '../admin/validate.js';

test('flags missing required field', () => {
  const c = getCollection('profile');
  const errs = validateModel(c, buildFormModel(c, { name:'' , title:'' }));
  assert.ok(errs.some(e => e.path.includes('name')));
  assert.ok(errs.some(e => e.path.includes('title')));
});
test('valid profile yields no errors', () => {
  const c = getCollection('profile');
  const errs = validateModel(c, buildFormModel(c, { name:'A', title:'t' }));
  assert.deepEqual(errs, []);
});
test('required inside list items is checked', () => {
  const c = getCollection('projects');
  const errs = validateModel(c, buildFormModel(c, { items:[{ title:'' }] }));
  assert.ok(errs.some(e => e.path.includes('items[0].title')));
});
