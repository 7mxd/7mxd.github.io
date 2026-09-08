import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBase64, fromBase64, serializeJson, sanitizeFilename, validateUpload, uploadRule } from '../admin/lib.js';
import { COLLECTIONS } from '../admin/schema.js';

test('base64 round-trips UTF-8', () => {
  const s = 'Ahmed — Radhi · café ✓';
  assert.equal(fromBase64(toBase64(s)), s);
});
test('serializeJson is 2-space with trailing newline', () => {
  assert.equal(serializeJson({a:1}), '{\n  "a": 1\n}\n');
});
test('sanitizeFilename lowercases, dashes spaces, keeps extension', () => {
  assert.equal(sanitizeFilename('My Logo (1).PNG'), 'my-logo-1.png');
});
test('an image field accepts png under 12MB', () => {
  assert.deepEqual(validateUpload({type:'image/png', size: 500000}), {ok:true});
});
test('an image field rejects a disallowed type', () => {
  const r = validateUpload({type:'image/gif', size: 100});
  assert.equal(r.ok, false); assert.match(r.error, /type/i);
});
test('an image field rejects oversize', () => {
  const r = validateUpload({type:'image/png', size: 13*1024*1024});
  assert.equal(r.ok, false); assert.match(r.error, /12 ?MB|large/i);
});

// The CV button is on the hero and the requirement was that everything on the
// page be editable, but the schema's `accept: '.pdf'` was read by nothing:
// the picker hardcoded image/* so the dialog would not offer a PDF, and the
// validation refused application/pdf even if one got through.
test('a field declaring accept: .pdf takes a PDF and nothing else', () => {
  assert.deepEqual(validateUpload({type:'application/pdf', size: 900000}, '.pdf'), {ok:true});
  const r = validateUpload({type:'image/png', size: 900000}, '.pdf');
  assert.equal(r.ok, false);
  assert.match(r.error, /PDF/);
});

test('an image field still refuses a PDF', () => {
  // Widening one field must not widen the rest.
  const r = validateUpload({type:'application/pdf', size: 900000});
  assert.equal(r.ok, false);
});

test('the dialog filter and the allowlist come from the same rule', () => {
  // They drifted once, which is the whole defect: a dialog that would not
  // offer the file the field is declared to want.
  assert.match(uploadRule('.pdf').accept, /pdf/);
  assert.equal(uploadRule(undefined).accept, 'image/*');
});

test('every accept the schema declares has an upload rule of its own', () => {
  // An accept with no rule silently falls back to images, which is exactly
  // how the CV field ended up unable to take a CV.
  const declared = new Set();
  const walk = (fields) => {
    for (const f of fields ?? []) {
      if (f.accept) declared.add(f.accept);
      walk(f.fields);
      if (f.itemField) walk([f.itemField]);
    }
  };
  for (const c of COLLECTIONS) walk(c.kind === 'single' ? c.fields : c.itemFields);
  for (const accept of declared) {
    assert.notEqual(uploadRule(accept).accept, 'image/*',
      `schema declares accept: ${accept} but admin/lib.js has no rule for it`);
  }
});
