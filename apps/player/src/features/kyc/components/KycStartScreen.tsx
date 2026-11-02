import { useAuthStatus, useKycRecord } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';
import { Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { DigilockerStep } from './DigilockerStep.tsx';
import { KycOutcome } from './KycOutcome.tsx';
import { KycLoadFailed, KycLoading } from './KycRecordStates.tsx';
import { KycSteps } from './KycSteps.tsx';
import { SelfieStep } from './SelfieStep.tsx';

/** Before the camera opens: the three steps, what is kept, and Take a selfie (K-09). */
function KycIntro({ onStart }: { onStart: () => void }) {
  return (
    <StepScreen
      title={t('player.kyc.title')}
      footer={
        <Button variant="primary" size="large" fullWidth onClick={onStart}>
          {t('player.kyc.takeSelfie')}
        </Button>
      }
    >
      <KycSteps at="selfie" />
      <Text variant="small" tone="muted">{t('player.kyc.kept')}</Text>
    </StepScreen>
  );
}

/**
 * Identity (design prompt, "Sign-in and KYC"): the steps and what is kept, the selfie with the device's camera, then the
 * hand-off to DigiLocker, which sends the member back to /kyc/return. A member whose check has moved on sees where it stands.
 */
export function KycStartScreen() {
  const authStatus = useAuthStatus();
  const record = useKycRecord();
  const [isTaking, setIsTaking] = useState(false);

  // Outside the frame, so it sends the signed-out to sign-in itself, to come back here (#233).
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" search={{ next: '/kyc' }} replace />;
  if (record.isPending) return <KycLoading />;
  if (record.isError) return <KycLoadFailed onRetry={() => void record.refetch()} />;
  if (record.data && record.data.status !== 'started') return <KycOutcome record={record.data} onChecked={() => void record.refetch()} />;
  if (record.data?.hasSelfie) return <DigilockerStep />;
  if (isTaking) return <SelfieStep onBack={() => setIsTaking(false)} />;
  return <KycIntro onStart={() => setIsTaking(true)} />;
}
