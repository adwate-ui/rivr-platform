import { useKycActions, type KycFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, StepScreen } from '@rivr/ui';
import { useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';
import { KycHelp } from './KycHelp.tsx';
import { KycSteps } from './KycSteps.tsx';

/**
 * The selfie is in: the steps, DigiLocker's with what it asks, and the hand-off to DigiLocker itself, which sends the member back
 * to /kyc/return (K-09). A start that fails says why and what to do, and the button tries again, unless today's tries are
 * used up; the front desk or signing out is always there (P-03).
 */
export function DigilockerStep() {
  const { start } = useKycActions();
  const [failure, setFailure] = useState<KycFailure | null>(null);
  const begin = async () => {
    setFailure(null);
    const started = await start.mutateAsync();
    if (started.ok) window.location.assign(started.value);
    else setFailure(started.error);
  };
  return (
    <StepScreen
      title={t('player.kyc.title')}
      footer={
        <Button variant="primary" size="large" fullWidth isLoading={start.isPending} isDisabled={failure === 'too_many_attempts'}
          onClick={() => void begin()}>
          {t('player.kyc.start')}
        </Button>
      }
    >
      <KycSteps at="digilocker" />
      {failure ? <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage> : null}
      <KycHelp />
    </StepScreen>
  );
}
