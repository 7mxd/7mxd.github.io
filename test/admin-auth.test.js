// test/admin-auth.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAuthMessage, isFatalAuthFailure } from '../admin/auth.js';

const ORIGIN = 'https://7mxd-oauth.vercel.app';
const good = { type: 'oauth:success', token: 'abc', provider: 'github' };

test('a message from the OAuth origin with a token succeeds', () => {
  assert.deepEqual(
    classifyAuthMessage({ origin: ORIGIN, data: good }, ORIGIN),
    { ok: true, token: 'abc' },
  );
});

test('a message from another origin is named, not ignored', () => {
  // The whole outage: the callback posted to https://7mxd.github.io while the
  // admin ran on www.7mxd.me, and this path silently returned.
  const r = classifyAuthMessage({ origin: 'https://evil.example', data: good }, ORIGIN);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'wrong-origin');
  assert.equal(r.detail, 'https://evil.example');
});

test('a message that is not an oauth success is reported', () => {
  const r = classifyAuthMessage({ origin: ORIGIN, data: { type: 'other' } }, ORIGIN);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-oauth');
});

test('an oauth success with no token is reported', () => {
  const r = classifyAuthMessage(
    { origin: ORIGIN, data: { type: 'oauth:success', provider: 'github' } }, ORIGIN);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-token');
});

test('an unrelated foreign message is not a fatal classification', () => {
  // Any script, browser extension, or embedded frame can postMessage to this
  // window. A wrong-origin verdict alone must not abort a legitimate sign-in
  // in progress — only a message claiming to be our own OAuth success should.
  const event = { origin: 'https://other.example', data: { type: 'resize' } };
  const r = classifyAuthMessage(event, ORIGIN);
  assert.equal(r.reason, 'wrong-origin');
  assert.equal(isFatalAuthFailure(event, r), false);
});
