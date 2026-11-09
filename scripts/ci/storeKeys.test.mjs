import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keysState } from './storeKeys.mjs';

const NAMES = ['A_KEY', 'B_KEY'];

test('every key set is present', () => {
  assert.deepEqual(keysState(NAMES, { A_KEY: '1', B_KEY: '2' }), { present: true, missing: [] });
});

test('none set is a skip, with nothing to report', () => {
  assert.deepEqual(keysState(NAMES, {}), { present: false, missing: [] });
  assert.deepEqual(keysState(NAMES, { A_KEY: '', B_KEY: '' }), { present: false, missing: [] });
});

test('some set names the ones missing', () => {
  assert.deepEqual(keysState(NAMES, { A_KEY: '1' }), { present: false, missing: ['B_KEY'] });
});
