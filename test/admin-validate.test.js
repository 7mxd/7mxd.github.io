import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCollection } from '../admin/schema.js';
import { buildFormModel } from '../admin/forms-model.js';
import { validateModel } from '../admin/validate.js';

const FULL_PROFILE = {
  name: 'A', nameArabic: 'ب', role: 'R',
  portrait: { src: 'p.jpg', alt: 'A portrait photograph', width: 10, height: 20 },
};

test('flags missing required fields', () => {
  const c = getCollection('profile');
  const errs = validateModel(c, buildFormModel(c, { name: '' }));
  assert.ok(errs.some(e => e.path === 'name'));
  assert.ok(errs.some(e => e.path === 'nameArabic'));
  assert.ok(errs.some(e => e.path === 'role'));
});

test('a half-filled portrait is refused, since the site cannot render one', () => {
  const c = getCollection('profile');
  const errs = validateModel(c, buildFormModel(c, { ...FULL_PROFILE, portrait: { src: 'p.jpg' } }));
  assert.ok(errs.some(e => e.path === 'portrait.alt'), 'an image with no alt text must not save');
  assert.ok(errs.some(e => e.path === 'portrait.width'), 'a missing width ships width="0" and shifts layout');
});

test('valid profile yields no errors', () => {
  const c = getCollection('profile');
  assert.deepEqual(validateModel(c, buildFormModel(c, FULL_PROFILE)), []);
});

test('required inside list items is checked', () => {
  const c = getCollection('projects');
  const errs = validateModel(c, buildFormModel(c, { items:[{ title:'' }] }));
  assert.ok(errs.some(e => e.path.includes('items[0].title')));
});
