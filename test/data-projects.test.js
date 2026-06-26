import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../data/projects.json', import.meta.url)));
const titles = data.items.map(p => p.title);

test('projects are ordered HiSalon, Stmnt, Wafa, KRLS', () => {
  assert.equal(titles[0], 'HiSalon');
  assert.equal(titles[1], 'Stmnt: AI-powered bank statement analyzer');
  assert.equal(titles[2], 'Wafa');
  assert.ok(/Kernel RLS/i.test(titles[3]));
  assert.equal(titles.length, 4);
});
test('gcc_currency and generic Join-Future node removed', () => {
  assert.ok(!titles.some(t => /gcc/i.test(t)));
  assert.ok(!titles.some(t => /other production systems/i.test(t)));
});
test('Wafa is shipped, names Mal, has correct tags + links', () => {
  const wafa = data.items.find(p => p.title === 'Wafa');
  assert.equal(wafa.status, 'shipped');
  const desc = wafa.blocks.find(b => b.type === 'description').content;
  assert.match(desc, /Mal/);
  assert.match(desc, /qard|interest-free/i);
  assert.ok(wafa.tags.includes('Next.js') && wafa.tags.includes('Supabase') && wafa.tags.includes('Claude / AI agents'));
  assert.equal(wafa.links.webapp, 'https://wafa.7mxd.me');
  assert.equal(wafa.links.github, 'https://github.com/7mxd/Wafa');
});
test('no forbidden Join-Future product names anywhere', () => {
  const raw = JSON.stringify(data);
  assert.ok(!/HiPay|joinfuture\.ai|joinCX/i.test(raw));
});
