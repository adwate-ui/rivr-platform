import type { IndianMobile } from '@rivr/contracts';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { CodeStep } from './CodeStep.tsx';
import { PhoneStep } from './PhoneStep.tsx';

/**
 * Sign-in (design prompt, "Sign-in and KYC"): the mobile number, then the code sent to it.
 * Signed in, the member lands on Tonight.
 */
export function SignInScreen() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState<IndianMobile | null>(null);
  if (phone === null) return <PhoneStep onCodeSent={setPhone} />;
  return <CodeStep phone={phone} onBack={() => setPhone(null)} onSignedIn={() => void navigate({ to: '/', replace: true })} />;
}
