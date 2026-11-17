import type { IndianMobile } from '@rivr/contracts';
import { useAuthStatus, useMember } from '@rivr/db';
import { t } from '@rivr/i18n';
import { inAppBrowserOf, OpenInBrowser } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { continueHere, hasContinuedHere } from '../inAppBrowser.ts';
import { CodeStep } from './CodeStep.tsx';
import { PhoneStep } from './PhoneStep.tsx';
import { SignedInStep } from './SignedInStep.tsx';

/**
 * Sign-in (design prompt, "Sign-in and KYC"): the mobile number, then the code sent to it.
 * Signed in, the member lands on the screen the link pointed at (`?next=`), or on Tonight. Opened
 * while someone is still signed in, or before the session is read, it says who instead of offering
 * the form (#227). Inside Instagram's or Facebook's own browser, it first sends the visitor to Safari or Chrome, where they
 * will stay signed in (the owner, 15 Nov), unless they choose to continue here. `banner`, the frame's new-version banner,
 * and `onCodeRefused`, its check for one (#1053), come through the route, so no feature imports another.
 */
export function SignInScreen({ banner, onCodeRefused }: { banner?: ReactNode; onCodeRefused?: () => void }) {
  const navigate = useNavigate();
  const { next } = useSearch({ from: '/sign-in' });
  const authStatus = useAuthStatus();
  const member = useMember();
  const [phone, setPhone] = useState<IndianMobile | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState(() => (hasContinuedHere() ? null : inAppBrowserOf(navigator.userAgent)));
  const goOn = () => void navigate({ href: next ?? '/', replace: true });
  // Signing out here starts afresh: the next person to sign in lands on Tonight, not on `next`.
  const startAfresh = () => void navigate({ to: '/sign-in', search: { next: undefined }, replace: true });
  // Only before a code is asked for: Auth reports the new sign-in while the code is still being checked.
  if (phone === null && authStatus !== 'signed-out') {
    const checking = authStatus === 'loading';
    return <SignedInStep name={member.data?.fullName} checking={checking} onContinue={checking ? undefined : goOn} onSignedOut={startAfresh} />;
  }
  if (phone === null && inAppBrowser !== null) {
    const stay = () => {
      continueHere();
      setInAppBrowser(null);
    };
    return <OpenInBrowser browser={inAppBrowser} url={globalThis.location.href} why={t('player.signIn.inAppBrowser.why')} onContinue={stay} />;
  }
  if (phone === null) return <PhoneStep onCodeSent={setPhone} banner={banner} />;
  return <CodeStep phone={phone} onBack={() => setPhone(null)} onSignedIn={goOn} banner={banner} onRefused={onCodeRefused} />;
}
