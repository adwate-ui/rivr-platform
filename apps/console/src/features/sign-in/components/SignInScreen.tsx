import type { IndianMobile } from '@rivr/contracts';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { CodeStep } from './CodeStep.tsx';
import { PhoneStep } from './PhoneStep.tsx';

/**
 * Staff sign in like members (question #172): the mobile number, then the code sent to it. The
 * steps are the player app's, copied (decision 0032). Signed in, staff land on Live floor.
 */
export function SignInScreen() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState<IndianMobile | null>(null);
  if (phone === null) return <PhoneStep onCodeSent={setPhone} />;
  return <CodeStep phone={phone} onBack={() => setPhone(null)} onSignedIn={() => void navigate({ to: '/', replace: true })} />;
}
