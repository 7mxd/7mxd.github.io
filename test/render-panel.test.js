import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPanel } from '../js/render.js';

const statuses = { shipped:{label:'shipped',glyph:'✓',tone:'neutral'} };

test('project panel shows title, status, tag, link, block', () => {
  const item = { title:'Wafa', status:'shipped', tags:['Next.js'], links:{ webapp:'https://wafa.7mxd.me' }, blocks:[{type:'description',content:'qard hasan'}] };
  const h = renderPanel(item, 'projects', statuses);
  assert.ok(h.includes('Wafa') && h.includes('shipped') && h.includes('Next.js'));
  assert.ok(h.includes('https://wafa.7mxd.me') && h.includes('qard hasan'));
});
test('experience panel shows company + role + responsibility', () => {
  const item = { company:'Saal', location:'AD', roles:[{ title:'Trainee', displayDate:'2024', blocks:[{type:'responsibility',content:'did x'}] }] };
  const h = renderPanel(item, 'experience', statuses);
  assert.ok(h.includes('Saal') && h.includes('Trainee') && h.includes('did x'));
});
test('unknown kind returns empty', () => { assert.equal(renderPanel({}, 'nope', statuses), ''); });
test('escapes html', () => {
  const h = renderPanel({ title:'<b>x</b>', blocks:[] }, 'projects', statuses);
  assert.ok(h.includes('&lt;b&gt;') && !h.includes('<b>x</b>'));
});
