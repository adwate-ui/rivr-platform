import { useAuthStatus, useStaffVenue } from '@rivr/db';
import { useLayoutEffect } from 'react';
import { setPracticeVenue } from '../errorReporting.ts';

/**
 * Tells error reporting whose venue this is (decision 0673), the venue the staff member works in now, which they can switch to the practice one and back: the practice venue never reaches a vendor.
 * While it is still being read, or could not be, errors wait until it is known. Draws nothing.
 */
export function ReportingVenue() {
  const authStatus = useAuthStatus();
  const staffVenue = useStaffVenue();
  let isPractice: boolean | null = null;
  // Signed out (the venue read waits for a sign-in) or no venue's staff: no venue, so errors are sent.
  if (authStatus === 'signed-out' || staffVenue.status === 'not-staff') isPractice = false;
  // The venue staff work in now: they can switch to the practice venue and back.
  else if (staffVenue.status === 'ready') isPractice = staffVenue.venue.isPractice;
  // Before the first paint, so it is set by the time Sentry has loaded.
  useLayoutEffect(() => setPracticeVenue(isPractice), [isPractice]);
  return null;
}
