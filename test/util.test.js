import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, slugify, clamp, formatList } from '../js/util.js';

test('escapeHtml neutralizes HTML metacharacters', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});
test('slugify lowercases and dashes non-alphanumerics', () => {
  assert.equal(slugify('Git / GitHub'), 'git-github');
  assert.equal(slugify('Claude / AI agents'), 'claude-ai-agents');
});
test('clamp bounds a value', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});
test('formatList joins with separator', () => {
  assert.equal(formatList(['a','b','c']), 'a, b, c');
  assert.equal(formatList(['a','b'], ' · '), 'a · b');
});
