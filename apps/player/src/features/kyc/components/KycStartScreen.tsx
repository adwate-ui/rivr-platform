import { useAuthStatus, useKycAtTheClub, useKycRecord, useMember, type KycRecord } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button } from '@rivr/ui';
import { Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { DigilockerStep } from './DigilockerStep.tsx';
import { KycIntro } from './KycIntro.tsx';
import { KycOutcome } from './KycOutcome.tsx';
import { KycLoadFailed, KycLoading } from './KycRecordStates.tsx';
import { KycRegistered } from './KycRegistered.tsx';
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

/**
 * A member's check, read from their record: the selfie, then DigiLocker, or where it stands once it has moved on. While the
 * club checks identity at the desk (decision 0502), the selfie lets them in instead, and the desk does the rest.
 */
function MembersCheck() {
  const record = useKycRecord();
  const atTheClub = useKycAtTheClub();

  if (record.isPending || atTheClub.isPending) return <KycLoading />;
  const failed = [record, atTheClub].find((read) => read.isError);
  if (failed) return <KycLoadFailed onRetry={() => void failed.refetch()} />;
  return <CheckAt record={record.data ?? null} isAtTheClub={atTheClub.data === true} onChecked={() => void record.refetch()} />;
}

/** Let in by their selfie. A held check is not, whatever an earlier spell at the club left on it: the selfie starts it again. */
const isRegistered = (record: KycRecord | null) => record?.status === 'started' && record.isAtTheClub;

/** The step a read check is at: where it has moved on to, the club's check, or the app's. */
function CheckAt({ record, isAtTheClub, onChecked }: { record: KycRecord | null; isAtTheClub: boolean; onChecked: () => void }) {
  // While the desk checks identity, a check waiting for its PAN goes to the desk too: Cashfree's PAN check is gone (owner,
  // 5 Nov), and the selfie starts the check again (audit F-010).
  const isHeldForPan = record?.status === 'needs_pan' && isAtTheClub;
  if (record && record.status !== 'started' && !isHeldForPan) return <KycOutcome record={record} onChecked={onChecked} />;
  if (isAtTheClub) return isRegistered(record) ? <KycRegistered /> : <ClubCheck />;
  // Once the switch is off, a member let in by their selfie may also check in the app.
  return <AppCheck hasSelfie={record?.hasSelfie === true} />;
}

/** In the app (decision 0320): the selfie, then DigiLocker; a member with the selfie in picks up at DigiLocker. */
function AppCheck({ hasSelfie }: { hasSelfie: boolean }) {
  const [isTaking, setIsTaking] = useState(false);
  // The selfie sent on this visit: DigiLocker follows as the next step, not as a return.
  const [hasJustSent, setHasJustSent] = useState(false);
  if (hasSelfie || hasJustSent) return <DigilockerStep isResume={!hasJustSent} />;
  if (isTaking) return <SelfieStep onBack={() => setIsTaking(false)} onSent={() => setHasJustSent(true)} />;
  return (
    <KycIntro at="selfie" isResume={false}
      action={<Button variant="primary" size="tall" fullWidth onClick={() => setIsTaking(true)}>{t('player.kyc.takeSelfie')}</Button>} />
  );
}

/** At the club (decision 0502): the selfie, with its tips, then in; the desk checks the documents on the first visit. */
function ClubCheck() {
  const [isTaking, setIsTaking] = useState(false);
  const [isSent, setIsSent] = useState(false);
  if (isSent) return <KycRegistered />;
  if (isTaking) return <SelfieStep isForTheClub onBack={() => setIsTaking(false)} onSent={() => setIsSent(true)} />;
  return (
    <KycIntro at="selfie" route="club" isResume={false}
      action={<Button variant="primary" size="tall" fullWidth onClick={() => setIsTaking(true)}>{t('player.kyc.takeSelfie')}</Button>} />
  );
}
