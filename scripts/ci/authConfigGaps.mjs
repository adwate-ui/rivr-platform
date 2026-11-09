/**
 * The numbers in `sms_test_otp` ("919000000101=123456,…"), as digits, or null for an entry that is
 * not number=code. Only a number's last four digits are ever printed: a malformed entry could hold
 * a code, and a number may be a real person's, in a public log.
 */
function testNumbers(setting) {
  // A missing or renamed field must not read as "no test numbers" and wave a release through.
  if (setting !== null && typeof setting !== 'string') throw new Error('Unexpected Auth settings: sms_test_otp is missing or not text');
  return (setting ?? '')
    .split(',')
    .filter((entry) => entry.trim() !== '')
    .map((entry) => /^\s*\+?(\d{1,15})\s*=\s*\d+\s*$/.exec(entry)?.[1] ?? null);
}

/**
 * The reviewer's number, once Auth lists it, must be the number the sign-in hook fences (auth.store_reviewer, decision 0575). If it
 * is not, its fixed code would sign in with nothing checking who that number is.
 */
export function reviewerFenceGaps(setting, reviewer, fencedPhones) {
  if (reviewer === '' || !testNumbers(setting).includes(reviewer)) return [];
  if (fencedPhones.map((phone) => phone.replace(/\D/g, '')).includes(reviewer)) return [];
  return [`test sign-in number ending ${reviewer.slice(-4)} is not the auth.store_reviewer setting, so nothing fences it`];
}

/** What is wrong with a project's test sign-in numbers: each one listed that is not in `allowed`, or that cannot be read. */
export function testNumberGaps(setting, { staging, allowed }) {
  return testNumbers(setting).flatMap((number) => {
    if (number === null) return ['a test sign-in entry is not "number=code" (not shown: it may hold a code)'];
    if (allowed.has(number)) return [];
    return [`test sign-in number ending ${number.slice(-4)} is listed (${staging ? 'not a seed number' : "production has only the store reviewer's"})`];
  });
}
