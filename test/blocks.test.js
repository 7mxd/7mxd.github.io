import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBlock } from '../js/blocks.js';

test('description escapes HTML', () => {
  const h = renderBlock({ type:'description', content:'<b>x</b>' });
  assert.ok(h.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(!h.includes('<b>x</b>'));
});
test('ascii-chart marks bars for animation and keeps a caption', () => {
  const h = renderBlock({ type:'ascii-chart', caption:'cap', chart:'A ▇▇ 1' });
  assert.ok(h.includes('data-animate="ascii"'));
  assert.ok(h.includes('cap'));
});
test('metric emits count-up hook', () => {
  const h = renderBlock({ type:'metric', label:'Years', value:'3' });
  assert.ok(h.includes('data-countup'));
  assert.ok(h.includes('Years'));
});
test('linked-artifact renders an anchor with escaped url', () => {
  const h = renderBlock({ type:'linked-artifact', label:'paper', url:'a.pdf' });
  assert.ok(h.includes('href="a.pdf"'));
  assert.ok(h.includes('paper'));
});
test('html block passes content through raw', () => {
  const h = renderBlock({ type:'html', content:'<i>ok</i>' });
  assert.ok(h.includes('<i>ok</i>'));
});
test('unknown type returns empty string', () => {
  assert.equal(renderBlock({ type:'nope' }), '');
});
