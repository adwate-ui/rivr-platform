import { useAuthStatus, useMember } from '@rivr/db';
import { useLayoutEffect } from 'react';
import { setPracticeVenue } from '../errorReporting.ts';

/**
 * Tells error reporting whose venue this is (decision 0604): the practice venue never reaches a vendor. Signed out, or
 * signed in with no member yet (someone joining), errors are sent. A member of the practice venue sends none. While a
 * session or its member is still being read, or their venue could not be, errors wait until it is known. Draws nothing.
 */
export function ReportingVenue() {
  const authStatus = useAuthStatus();
  const member = useMember();
  let isPractice: boolean | null = null;
  if (authStatus === 'signed-out' || member.data === null) isPractice = false;
  // What a phone kept from before this field was read has none: not known, until it is read again.
  else if (member.data) isPractice = typeof member.data.isPractice === 'boolean' ? member.data.isPractice : null;
  // Before the first paint, so it is set by the time Sentry has loaded.
  useLayoutEffect(() => setPracticeVenue(isPractice), [isPractice]);
  return null;
}
