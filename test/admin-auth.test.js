// test/admin-auth.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyAuthMessage, isFatalAuthFailure, oauthBase } from '../admin/auth.js';

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

test('a wrong-origin message claiming to be our own OAuth success is fatal', () => {
  // The exact shape of the original outage: the callback posts the real
  // oauth:success payload, but to the wrong origin. This is the one
  // wrong-origin case that must abort sign-in loudly rather than be ignored.
  const event = { origin: 'https://evil.example', data: good };
  const r = classifyAuthMessage(event, ORIGIN);
  assert.equal(r.reason, 'wrong-origin');
  assert.equal(isFatalAuthFailure(event, r), true);
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

// --- The origin the admin trusts must be the one the callback posts from ---

test('the OAuth base is the page\'s own origin, not a hardcoded project domain', () => {
  // /auth and /callback are rewrites on this same origin (vercel.json), so the
  // popup finishes on the site's origin. Hardcoding the Vercel project domain
  // made the expected origin disagree with the actual one.
  assert.equal(oauthBase({ origin: 'https://www.7mxd.me' }), 'https://www.7mxd.me');
  assert.equal(oauthBase({ origin: 'http://localhost:8000' }), 'http://localhost:8000');
});

test('admin/auth.js pins no absolute OAuth origin of its own', () => {
  const src = readFileSync(new URL('../admin/auth.js', import.meta.url), 'utf8');
  const pinned = src.match(/https?:\/\/[a-z0-9.-]+(:\d+)?/gi) || [];
  assert.deepEqual(pinned, [], `admin/auth.js hardcodes ${pinned.join(', ')}`);
});

test('the callback posts to the origin the site calls canonical', () => {
  // The outage this guards: the callback kept posting to a literal origin the
  // site had moved off. Comparing the two literals is what makes a future move
  // fail here instead of at a popup that closes with no explanation.
  const cb = readFileSync(new URL('../api/callback.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const target = cb.match(/postMessage\(\s*data\s*,\s*"([^"]+)"/)?.[1];
  const canonical = html.match(/rel="canonical"\s+href="([^"]+)"/)?.[1];
  assert.ok(target, 'no postMessage target origin found in api/callback.js');
  assert.ok(canonical, 'no canonical link found in index.html');
  assert.equal(target, new URL(canonical).origin);
});
