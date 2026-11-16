import { useKycActions, type KycFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage } from '@rivr/ui';
import { useEffect, useRef, useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';
import { KycIntro } from './KycIntro.tsx';

/**
 * The selfie is in: the steps with DigiLocker current, and Continue to DigiLocker, busy until DigiLocker opens and sends the
 * member back to /kyc/return (K-09). A start that fails says why, and the button tries again, unless today's tries are used
 * up. Sign out is always there (P-03). `isResume`: the member came back to it rather than straight from the selfie.
 */
export function DigilockerStep({ isResume }: { isResume: boolean }) {
  const { start, complete } = useKycActions();
  const [failure, setFailure] = useState<KycFailure | null>(null);
  const asked = useRef(false);
  // Back on a check whose documents may have come in meanwhile (decision 0676): they are taken before a new hand-off, which
  // would drop them. One with no hand-off, or still waiting, stays here; one that moved on shows where it stands.
  useEffect(() => {
    if (!isResume || asked.current) return;
    asked.current = true;
    complete.mutate();
  }, [isResume, complete]);
  const begin = async () => {
    setFailure(null);
    const started = await start.mutateAsync();
    if (!started.ok) setFailure(started.error);
    // Zoop could not start it: the check waits for the desk (decision 0678), and /kyc, reading it again, says so.
    else if (started.value !== 'at_club') window.location.assign(started.value.redirectUrl);
  };
  return (
    <KycIntro at="digilocker" isResume={isResume}
      notice={failure ? <ErrorMessage look="dot">{t(FAILURE_COPY[failure])}</ErrorMessage> : null}
      action={
        // Busy too while documents already in are taken: a new hand-off then would race it.
        <Button variant="primary" size="tall" fullWidth isLoading={start.isPending || complete.isPending} isDisabled={failure === 'too_many_attempts'}
          onClick={() => void begin()}>
          {t('player.kyc.start')}
        </Button>
      } />
  );
}
