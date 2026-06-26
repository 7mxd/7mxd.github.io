import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseTheme, nextTheme } from '../js/theme.js';

test('stored explicit theme wins', () => {
  assert.equal(chooseTheme('dark', false), 'dark');
  assert.equal(chooseTheme('light', true), 'light');
});
test('auto/null falls back to system preference', () => {
  assert.equal(chooseTheme(null, true), 'dark');
  assert.equal(chooseTheme('auto', false), 'light');
});
test('nextTheme toggles', () => {
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'light');
});
