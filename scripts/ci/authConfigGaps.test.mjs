import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewerFenceGaps, testNumberGaps } from './authConfigGaps.mjs';

const REVIEWER = '919000000821';
const production = { staging: false, allowed: new Set([REVIEWER]) };

test("production passes with exactly the reviewer's number", () => {
  assert.deepEqual(testNumberGaps(`${REVIEWER}=123456`, production), []);
});

test('production passes with none listed', () => {
  assert.deepEqual(testNumberGaps('', production), []);
  assert.deepEqual(testNumberGaps(null, production), []);
});

test('production fails on any other number, naming only its last four digits', () => {
  assert.deepEqual(testNumberGaps('919000000999=123456', production),
    ["test sign-in number ending 0999 is listed (production has only the store reviewer's)"]);
});

test("production fails on a number beside the reviewer's", () => {
  assert.equal(testNumberGaps(`${REVIEWER}=123456,919000000999=123456`, production).length, 1);
});

test('production with no reviewer set fails on every number', () => {
  assert.equal(testNumberGaps(`${REVIEWER}=123456`, { staging: false, allowed: new Set() }).length, 1);
});

test('an entry that cannot be read is a gap, and shows nothing of it', () => {
  assert.deepEqual(testNumberGaps('919000000821', production), ['a test sign-in entry is not "number=code" (not shown: it may hold a code)']);
});

test("staging passes on the seed's numbers", () => {
  assert.deepEqual(testNumberGaps('919000000101=123456', { staging: true, allowed: new Set(['919000000101']) }), []);
});

test('the listed reviewer must be the fenced number', () => {
  assert.deepEqual(reviewerFenceGaps(`${REVIEWER}=123456`, REVIEWER, ['+919000000821']), []);
  assert.deepEqual(reviewerFenceGaps(`${REVIEWER}=123456`, REVIEWER, []),
    ['test sign-in number ending 0821 is not the auth.store_reviewer setting, so nothing fences it']);
  assert.equal(reviewerFenceGaps(`${REVIEWER}=123456`, REVIEWER, ['+919000000822']).length, 1);
});

test('with the reviewer not yet listed in Auth there is nothing to fence', () => {
  assert.deepEqual(reviewerFenceGaps('', REVIEWER, []), []);
  assert.deepEqual(reviewerFenceGaps(`${REVIEWER}=123456`, '', []), []);
});

test('a missing setting stops the check rather than passing', () => {
  assert.throws(() => testNumberGaps(undefined, production), /sms_test_otp is missing/);
});
