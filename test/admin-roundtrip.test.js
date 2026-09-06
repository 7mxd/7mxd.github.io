// test/admin-roundtrip.test.js
//
// The guard that makes admin/schema.js drifting away from data/*.json
// impossible to reintroduce.
//
// admin/forms-model.js rebuilds every content file from admin/schema.js's
// declared fields ALONE — anything the schema does not declare is dropped on
// save, silently and permanently. The editorial revamp reshaped every data
// file and left the schema untouched, which meant pressing Save in the admin
// deleted profile.nameArabic (so the whole page threw at load), settings.nav
// (same), every experience bullet, every photograph, and every project id.
//
// So: load each real data file, push it through the exact path a save takes
// (buildFormModel, then modelToData), and require what comes back to be the
// same object. Nothing lost, nothing invented, nothing retyped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { COLLECTIONS, UNMANAGED_DATA_FILES } from '../admin/schema.js';
import { buildFormModel, modelToData } from '../admin/forms-model.js';
import { validateModel } from '../admin/validate.js';

const repoFile = (rel) => new URL(`../${rel}`, import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(repoFile(rel), 'utf8'));

for (const collection of COLLECTIONS) {
  test(`${collection.name}: a save with no edits returns ${collection.file} unchanged`, () => {
    const original = readJson(collection.file);
    const saved = modelToData(collection, buildFormModel(collection, original));
    assert.deepEqual(
      saved,
      original,
      `saving ${collection.file} through the admin would change it. Every field ` +
        'in the file must be declared in admin/schema.js, or it is dropped.',
    );
  });

  test(`${collection.name}: the real ${collection.file} passes the admin's own validation`, () => {
    const model = buildFormModel(collection, readJson(collection.file));
    const errors = validateModel(collection, model);
    assert.deepEqual(
      errors.map((e) => `${e.path}: ${e.message}`),
      [],
      `the admin refuses to save the file as committed — a required field is ` +
        'declared that the site does not actually carry',
    );
  });
}

test('every data file is either an admin collection or a documented exception', () => {
  const onDisk = readdirSync(repoFile('data')).filter((f) => f.endsWith('.json')).sort();
  const managed = COLLECTIONS.map((c) => c.file.replace(/^data\//, ''));
  const accounted = [...managed, ...UNMANAGED_DATA_FILES].sort();
  assert.deepEqual(
    onDisk,
    accounted,
    'a data file appeared (or vanished) without the admin schema being told. ' +
      'Add a collection for it, or list it in UNMANAGED_DATA_FILES with the reason.',
  );
});

test('the schema declares no field the data files do not carry, beyond documented optionals', () => {
  // The mirror image of the round-trip above. Round-tripping proves nothing is
  // LOST; this proves nothing is invented. A field declared but absent from the
  // data is fine only if it is genuinely optional content (an entry may have no
  // photographs, no logo variants, no explicit sort order) — never a phantom
  // like the `title` that profile.json never had and that blocked every save.
  const OPTIONAL = new Set([
    'order',            // js/timeline.js's same-date tie-break; no entry needs one today
    'widthSmall',       // filled for every photograph; absent for a logo-less item
    'light', 'dark',    // theme-specific logo variants; only Saal.ai supplies them
    'ios', 'webapp', 'github', 'extra', // per-project link slots
    'images', 'blocks', 'tags', 'caption', 'workRef', 'level', 'grade',
  ]);

  const namesIn = (value) => {
    const found = new Set();
    const walk = (v) => {
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (v && typeof v === 'object') {
        for (const [k, inner] of Object.entries(v)) { found.add(k); walk(inner); }
      }
    };
    walk(value);
    return found;
  };

  const missing = [];
  for (const collection of COLLECTIONS) {
    const present = namesIn(readJson(collection.file));
    const walkFields = (fields) => {
      for (const f of fields ?? []) {
        if (!present.has(f.name)) {
          if (!OPTIONAL.has(f.name)) missing.push(`${collection.name}.${f.name}`);
          continue; // an absent optional container has no sub-fields to check
        }
        if (f.fields) walkFields(f.fields);
      }
    };
    walkFields(collection.kind === 'single' ? collection.fields : collection.itemFields);
  }
  assert.deepEqual(missing, [], 'schema declares fields no data file carries');
});
