import type { IndianMobile } from '@rivr/contracts';
import { useAuthStatus, useStaffVenue } from '@rivr/db';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { CodeStep } from './CodeStep.tsx';
import { PhoneStep } from './PhoneStep.tsx';
import { SignedInStep } from './SignedInStep.tsx';

/**
 * Staff sign in like members (question #172): the mobile number, then the code sent to it. The
 * steps are the player app's, copied (decision 0032). Signed in, staff land on Live floor. Opened
 * while someone is still signed in, it says who instead of offering the form (#227).
 */
export function SignInScreen() {
  const navigate = useNavigate();
  const authStatus = useAuthStatus();
  const staff = useStaffVenue();
  const [phone, setPhone] = useState<IndianMobile | null>(null);
  const toConsole = () => void navigate({ to: '/', replace: true });
  // Only before a code is asked for: Auth reports the new sign-in while the code is still being checked.
  if (phone === null && authStatus === 'signed-in') {
    return <SignedInStep name={staff.status === 'ready' ? staff.venue.fullName : undefined} onContinue={toConsole} />;
  }
  if (phone === null) return <PhoneStep onCodeSent={setPhone} />;
  return <CodeStep phone={phone} onBack={() => setPhone(null)} onSignedIn={toConsole} />;
}
