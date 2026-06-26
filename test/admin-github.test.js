import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentsUrl, decodeFile, putBody } from '../admin/github.js';
import { toBase64 } from '../admin/lib.js';

test('contentsUrl targets the repo', () => {
  assert.equal(contentsUrl('data/profile.json'),
    'https://api.github.com/repos/7mxd/7mxd.github.io/contents/data/profile.json');
});
test('decodeFile base64-decodes content and keeps sha', () => {
  const resp = { content: toBase64('{"a":1}'), sha: 'abc', encoding: 'base64' };
  assert.deepEqual(decodeFile(resp), { content: '{"a":1}', sha: 'abc' });
});
test('putBody encodes content and includes sha + branch', () => {
  const b = putBody({ message:'m', contentString:'{"a":1}', sha:'s1' });
  assert.equal(b.message, 'm'); assert.equal(b.branch, 'main'); assert.equal(b.sha, 's1');
  assert.equal(b.content, toBase64('{"a":1}'));
});
test('putBody omits sha for new files', () => {
  const b = putBody({ message:'m', contentString:'x', sha: null });
  assert.ok(!('sha' in b));
});
