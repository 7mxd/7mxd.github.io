import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTIONS, getCollection } from '../admin/schema.js';

const VALID_TYPES = new Set(['string','text','number','boolean','select','image','object','list','blocks']);

const namesOf = (fields) => fields.map(f => f.name);
const sub = (fields, name) => fields.find(f => f.name === name);

test('all 9 collections present', () => {
  assert.deepEqual(COLLECTIONS.map(c => c.name).sort(),
    ['education','experience','metrics','milestones','profile','projects','settings','skills','summary']);
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

// --- The fields the editorial revamp introduced, and the ones it retired. ---
// Each name below is one the admin previously deleted on save (or declared but
// never read). test/admin-roundtrip.test.js proves the whole file survives a
// save; these spell out the individual cases so a failure names itself.

test('profile declares the hero fields the site reads, and no phantom title', () => {
  const p = getCollection('profile');
  const names = namesOf(p.fields);
  for (const required of ['name','nameArabic','role','tagline','location','portrait','contact']) {
    assert.ok(names.includes(required), `profile.${required} missing — the site reads it`);
  }
  assert.ok(!names.includes('title'), 'profile.title is not in the data and blocked every save');
  const contact = namesOf(sub(p.fields, 'contact').fields);
  assert.deepEqual(contact, ['email','linkedin','github'], 'phone and location are deliberately not published');
  const portrait = namesOf(sub(p.fields, 'portrait').fields);
  assert.ok(portrait.includes('width') && portrait.includes('height') && portrait.includes('widthSmall'));
});

test('settings declares nav and sections, and no dead theme or graph config', () => {
  const s = getCollection('settings');
  const names = namesOf(s.fields);
  assert.deepEqual(names, ['cv','siteTitle','meta','nav','sections']);
  assert.ok(!names.includes('theme'), 'settings.theme is read by nothing; js/theme.js uses localStorage');
  assert.ok(!names.includes('graph'), 'graph field should have been removed from settings');
  assert.ok(!names.includes('navLogo'), 'navLogo field should have been removed from settings');
});

test('experience roles declare id, workRef, bullets and images', () => {
  const e = getCollection('experience');
  assert.ok(!namesOf(e.itemFields).includes('tags'), 'experience tags are read by nothing');
  assert.ok(!namesOf(e.itemFields).includes('cluster'));
  const roles = namesOf(sub(e.itemFields, 'roles').fields);
  for (const required of ['id','workRef','bullets','images','blocks']) {
    assert.ok(roles.includes(required), `experience role ${required} missing`);
  }
});

test('education declares id, location and images', () => {
  const names = namesOf(getCollection('education').itemFields);
  for (const required of ['id','location','images','blocks']) {
    assert.ok(names.includes(required), `education ${required} missing`);
  }
  assert.ok(!names.includes('cluster'));
});

test('projects declare the timeline and anchor fields, with images not a lone image', () => {
  const p = getCollection('projects');
  const names = namesOf(p.itemFields);
  for (const required of ['id','org','timeline','startDate','displayDate','images','tags']) {
    assert.ok(names.includes(required), `projects.${required} missing`);
  }
  assert.ok(!names.includes('image'), 'the singular image field is not in the data model');
  assert.ok(!names.includes('cluster'), 'cluster field should have been removed with settings.graph');
  assert.ok(p.itemFields.some(f => f.type === 'blocks' && f.scope === 'project'));
  const links = namesOf(sub(p.itemFields, 'links').fields);
  assert.ok(!links.includes('android'), 'there is no Android build to link to');
});

import { readFileSync, readdirSync } from 'node:fs';
const REGISTRY = JSON.parse(
  readFileSync(new URL('../data/blocks-registry.json', import.meta.url), 'utf8'));

function registryFields() {
  return Object.entries(REGISTRY)
    .filter(([k]) => !k.startsWith('_'))
    .flatMap(([type, v]) => (v.fields || []).map((f) => ({ type, f })));
}

test('every registry select declares {label, value} options', () => {
  // The callout tone dropdown rendered empty because the registry wrote plain
  // strings while admin/schema.js wrote objects, and one renderer read .value
  // off both.
  for (const { type, f } of registryFields()) {
    if (f.type !== 'select') continue;
    assert.ok(Array.isArray(f.options), `${type}.${f.name} has no options`);
    for (const o of f.options) {
      assert.equal(typeof o, 'object', `${type}.${f.name} option is not an object`);
      assert.ok(o.label && o.value, `${type}.${f.name} option missing label or value`);
    }
  }
});

test('every registry list says whether it holds scalars or records', () => {
  // benchmark.rows are records and coursework.items are strings, and both said
  // only "list". One renderer assumed strings and destroyed the records.
  for (const { type, f } of registryFields()) {
    if (f.type !== 'list') continue;
    const scalars = Boolean(f.itemField);
    const records = Array.isArray(f.fields);
    assert.ok(scalars !== records,
      `${type}.${f.name} must declare exactly one of itemField or fields`);
  }
});

test('benchmark rows declare the record the site actually renders', () => {
  const rows = REGISTRY.benchmark.fields.find((f) => f.name === 'rows');
  const names = rows.fields.map((f) => f.name).sort();
  assert.deepEqual(names, ['highlight', 'label', 'value']);
});

test('every data file is managed except the registry, which is schema', () => {
  const files = readdirSync(new URL('../data/', import.meta.url))
    .filter((f) => f.endsWith('.json'));
  const managed = new Set(COLLECTIONS.map((c) => c.file.replace('data/', '')));
  const unmanaged = files.filter((f) => !managed.has(f));
  assert.deepEqual(unmanaged.sort(), ['blocks-registry.json'],
    'a content file nobody can edit is the defect this revamp exists to remove');
});
