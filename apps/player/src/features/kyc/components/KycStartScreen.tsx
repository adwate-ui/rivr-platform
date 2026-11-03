import { useAuthStatus, useKycRecord, useMember } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button } from '@rivr/ui';
import { Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { DigilockerStep } from './DigilockerStep.tsx';
import { KycIntro } from './KycIntro.tsx';
import { KycOutcome } from './KycOutcome.tsx';
import { KycLoadFailed, KycLoading } from './KycRecordStates.tsx';
import { SelfieStep } from './SelfieStep.tsx';

/**
 * Identity (decision 0320): the steps and what is kept, the selfie with the front camera, then the hand-off to DigiLocker,
 * which sends the member back to /kyc/return. A member with the selfie already in picks up at DigiLocker ("Pick up where
 * you left off", derived from the record: brief 7.7); one whose check has moved on sees where it stands.
 */
export function KycStartScreen() {
  const authStatus = useAuthStatus();
  const member = useMember();

  // Outside the frame, so it sends the signed-out to sign-in itself, to come back here (#233), and a number that is not a
  // member yet to join first, as the frame does: only a member has an identity check, and the kyc function refuses anyone else.
  // A member stays on their check even if a later read of who they are fails.
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" search={{ next: '/kyc' }} replace />;
  if (member.data) return <MembersCheck />;
  if (member.isSuccess) return <Navigate to="/sign-up" search={{ next: '/kyc' }} replace />;
  if (member.isError) return <KycLoadFailed onRetry={() => void member.refetch()} />;
  return <KycLoading />;
}

/** A member's check, read from their record: the selfie, then DigiLocker, or where it stands once it has moved on. */
function MembersCheck() {
  const record = useKycRecord();
  const [isTaking, setIsTaking] = useState(false);
  // The selfie sent on this visit: DigiLocker follows as the next step, not as a return.
  const [hasJustSent, setHasJustSent] = useState(false);

  if (record.isPending) return <KycLoading />;
  if (record.isError) return <KycLoadFailed onRetry={() => void record.refetch()} />;
  if (record.data && record.data.status !== 'started') return <KycOutcome record={record.data} onChecked={() => void record.refetch()} />;
  if (record.data?.hasSelfie || hasJustSent) return <DigilockerStep isResume={!hasJustSent} />;
  if (isTaking) return <SelfieStep onBack={() => setIsTaking(false)} onSent={() => setHasJustSent(true)} />;
  return (
    <KycIntro at="selfie" isResume={false}
      action={<Button variant="primary" size="tall" fullWidth onClick={() => setIsTaking(true)}>{t('player.kyc.takeSelfie')}</Button>} />
  );
}
