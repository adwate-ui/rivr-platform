import { useAuthStatus, useKycActions, useKycRecord, type KycFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';
import { Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';
import { KycOutcome } from './KycOutcome.tsx';
import { KycLoadFailed, KycLoading } from './KycRecordStates.tsx';
import { SelfieStep } from './SelfieStep.tsx';

/**
 * Identity (design prompt, "Sign-in and KYC"): what is kept, the selfie, then the hand-off to
 * DigiLocker, which sends the member back to /kyc/return. A member whose check has moved on sees where
 * it stands.
 */
export function KycStartScreen() {
  const authStatus = useAuthStatus();
  const record = useKycRecord();
  const { start } = useKycActions();
  const [failure, setFailure] = useState<KycFailure | null>(null);

  // Outside the frame, so it sends the signed-out to sign-in itself, to come back here (#233).
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" search={{ next: '/kyc' }} replace />;
  if (record.isPending) return <KycLoading />;
  if (record.isError) return <KycLoadFailed onRetry={() => void record.refetch()} />;
  if (record.data && record.data.status !== 'started') return <KycOutcome record={record.data} onChecked={() => void record.refetch()} />;
  if (!record.data?.hasSelfie) return <SelfieStep />;
  const begin = async () => {
    const started = await start.mutateAsync();
    if (started.ok) window.location.assign(started.value);
    else setFailure(started.error);
  };
  return (
    <StepScreen
      title={t('player.kyc.title')}
      footer={
        <Button variant="primary" fullWidth isLoading={start.isPending} onClick={() => void begin()}>
          {t('player.kyc.start')}
        </Button>
      }
    >
      <Text>{t('player.kyc.digilockerIntro')}</Text>
      {failure ? <Text>{t(FAILURE_COPY[failure])}</Text> : null}
    </StepScreen>
  );
}
