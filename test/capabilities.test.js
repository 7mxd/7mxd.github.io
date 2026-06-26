import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseInitialMode } from '../js/capabilities.js';

test('no webgl -> read', () => { assert.equal(chooseInitialMode({webgl:false, lowPower:false}), 'read'); });
test('low power -> read', () => { assert.equal(chooseInitialMode({webgl:true, lowPower:true}), 'read'); });
test('capable -> explore', () => { assert.equal(chooseInitialMode({webgl:true, lowPower:false}), 'explore'); });
