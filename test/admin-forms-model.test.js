import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCollection } from '../admin/schema.js';
import { buildFormModel, modelToData } from '../admin/forms-model.js';

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
  const data = { items:[{ title:'P', status:'shipped', cluster:'engineering', tags:['X'], links:{ github:'g' }, blocks:[{type:'description',content:'d'}] }] };
  const back = modelToData(c, buildFormModel(c, data));
  assert.equal(back.items[0].title, 'P');
  assert.equal(back.items[0].tags[0], 'X');
  assert.equal(back.items[0].links.github, 'g');
  assert.equal(back.items[0].links.ios, undefined); // empty dropped
  assert.equal(back.items[0].blocks[0].content, 'd');
});
