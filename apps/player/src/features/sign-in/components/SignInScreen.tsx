import type { IndianMobile } from '@rivr/contracts';
import { useAuthStatus, useMember } from '@rivr/db';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { CodeStep } from './CodeStep.tsx';
import { PhoneStep } from './PhoneStep.tsx';
import { SignedInStep } from './SignedInStep.tsx';

/**
 * Sign-in (design prompt, "Sign-in and KYC"): the mobile number, then the code sent to it.
 * Signed in, the member lands on the screen the link pointed at (`?next=`), or on Tonight. Opened
 * while someone is still signed in, or before the session is read, it says who instead of offering
 * the form (#227).
 */
export function SignInScreen() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: '/sign-in' });
  const authStatus = useAuthStatus();
  const member = useMember();
  const [phone, setPhone] = useState<IndianMobile | null>(null);
  const goOn = () => void navigate({ href: next ?? '/', replace: true });
  // Signing out here starts afresh: the next person to sign in lands on Tonight, not on `next`.
  const startAfresh = () => void navigate({ to: '/sign-in', search: { next: undefined }, replace: true });
  // Only before a code is asked for: Auth reports the new sign-in while the code is still being checked.
  if (phone === null && authStatus !== 'signed-out') {
    const checking = authStatus === 'loading';
    return <SignedInStep name={member.data?.fullName} checking={checking} onContinue={checking ? undefined : goOn} onSignedOut={startAfresh} />;
  }
  if (phone === null) return <PhoneStep onCodeSent={setPhone} />;
  return <CodeStep phone={phone} onBack={() => setPhone(null)} onSignedIn={goOn} />;
}
