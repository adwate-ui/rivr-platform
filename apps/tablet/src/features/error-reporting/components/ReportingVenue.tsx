import { useAuthStatus, useMyDevice } from '@rivr/db';
import { useLayoutEffect } from 'react';
import { setPracticeVenue } from '../errorReporting.ts';

/**
 * Tells error reporting whose venue this is (decision 0673), the venue the tablet is paired to: the practice venue never reaches a vendor.
 * While it is still being read, or could not be, errors wait until it is known. Draws nothing.
 */
export function ReportingVenue() {
  const authStatus = useAuthStatus();
  const device = useMyDevice();
  let isPractice: boolean | null = null;
  // Signed out (the pairing screen) or a session that is no device's: no venue, so errors are sent.
  if (authStatus === 'signed-out' || device.data === null) isPractice = false;
  else if (device.data) isPractice = device.data.isPractice;
  // Before the first paint, so it is set by the time Sentry has loaded.
  useLayoutEffect(() => setPracticeVenue(isPractice), [isPractice]);
  return null;
}
