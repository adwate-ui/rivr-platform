import { useKycActions, type KycFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage } from '@rivr/ui';
import { useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';
import { KycIntro } from './KycIntro.tsx';

/**
 * The selfie is in: the steps with DigiLocker current, and Continue to DigiLocker, busy until DigiLocker opens and sends the
 * member back to /kyc/return (K-09). A start that fails says why, and the button tries again, unless today's tries are used
 * up. Sign out is always there (P-03). `isResume`: the member came back to it rather than straight from the selfie.
 */
export function DigilockerStep({ isResume }: { isResume: boolean }) {
  const { start } = useKycActions();
  const [failure, setFailure] = useState<KycFailure | null>(null);
  const begin = async () => {
    setFailure(null);
    const started = await start.mutateAsync();
    if (started.ok) window.location.assign(started.value);
    else setFailure(started.error);
  };
  return (
    <KycIntro at="digilocker" isResume={isResume}
      notice={failure ? <ErrorMessage look="dot">{t(FAILURE_COPY[failure])}</ErrorMessage> : null}
      action={
        <Button variant="primary" size="tall" fullWidth isLoading={start.isPending} isDisabled={failure === 'too_many_attempts'}
          onClick={() => void begin()}>
          {t('player.kyc.start')}
        </Button>
      } />
  );
}
