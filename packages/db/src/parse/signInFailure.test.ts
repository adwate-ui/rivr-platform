import { describe, expect, it } from 'vitest';
import { toSignInFailure } from './signInFailure.ts';

// The errors Supabase Auth answers with, as the local stack returns them.
describe('toSignInFailure', () => {
  it('reads a wrong or expired code as rejected: Auth does not tell the two apart', () => {
    expect(toSignInFailure({ status: 403, code: 'otp_expired' })).toBe('code_rejected');
  });

  it('reads a second request inside the minute, or any 429, as too many requests', () => {
    expect(toSignInFailure({ status: 429, code: 'over_sms_send_rate_limit' })).toBe('too_many_requests');
    expect(toSignInFailure({ status: 429, code: 'over_request_rate_limit' })).toBe('too_many_requests');
    // The send hook's own rate limit arrives as a 429 with no known code.
    expect(toSignInFailure({ status: 429, code: 'unknown' })).toBe('too_many_requests');
  });

  it('reads anything else, such as no channel to send by, as unavailable', () => {
    expect(toSignInFailure({ status: 503, code: 'unknown' })).toBe('unavailable');
    expect(toSignInFailure({ status: 500, code: 'unexpected_failure' })).toBe('unavailable');
    expect(toSignInFailure({})).toBe('unavailable');
  });
});
