import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBase64, fromBase64, serializeJson, sanitizeFilename, validateImage } from '../admin/lib.js';

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
test('validateImage accepts png under 2MB', () => {
  assert.deepEqual(validateImage({type:'image/png', size: 500000}), {ok:true});
});
test('validateImage rejects disallowed type', () => {
  const r = validateImage({type:'image/gif', size: 100});
  assert.equal(r.ok, false); assert.match(r.error, /type/i);
});
test('validateImage rejects oversize', () => {
  const r = validateImage({type:'image/png', size: 3*1024*1024});
  assert.equal(r.ok, false); assert.match(r.error, /2 ?MB|large/i);
});
