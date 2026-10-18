import { useKycActions, useKycRecord, type KycFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';
import { useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';
import { KycOutcome } from './KycOutcome.tsx';

/**
 * Identity (design prompt, "Sign-in and KYC"): what is kept, then the hand-off to DigiLocker, which
 * sends the member back to /kyc/return. A member already verified, or waiting on a PAN, sees that.
 */
export function KycStartScreen() {
  const record = useKycRecord();
  const { start } = useKycActions();
  const [failure, setFailure] = useState<KycFailure | null>(null);

  if (record.data && record.data.status !== 'started') return <KycOutcome record={record.data} onChecked={() => void record.refetch()} />;
  const begin = async () => {
    const started = await start.mutateAsync();
    if (started.ok) window.location.assign(started.value);
    else setFailure(started.error);
  };
  return (
    <StepScreen
      title={t('player.kyc.title')}
      footer={
        <Button variant="primary" fullWidth isLoading={start.isPending || record.isPending} onClick={() => void begin()}>
          {t('player.kyc.start')}
        </Button>
      }
    >
      <Text>{t('player.kyc.intro')}</Text>
      {failure ? <Text>{t(FAILURE_COPY[failure])}</Text> : null}
    </StepScreen>
  );
}
