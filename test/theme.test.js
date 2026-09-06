import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTheme, resolveTheme } from '../js/theme.js';

test('nextTheme flips between the two themes', () => {
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'light');
});

test('nextTheme treats anything unrecognised as light, so the first click goes dark', () => {
  assert.equal(nextTheme(null), 'dark');
  assert.equal(nextTheme('sepia'), 'dark');
});

test('a stored choice always wins over the system preference', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('with no stored choice the system preference decides', () => {
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme(null, false), 'light');
});

test('a corrupt stored value falls back to the system preference', () => {
  assert.equal(resolveTheme('banana', true), 'dark');
});
