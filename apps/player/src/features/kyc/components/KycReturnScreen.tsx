import type { Result } from '@rivr/contracts';
import { useKycActions, useKycRecord, type KycFailure, type KycRecord, type KycStatus } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';
import { useEffect, useRef } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';
import { KycOutcome } from './KycOutcome.tsx';

type ReturnView = { kind: 'checking' } | { kind: 'failed'; failure: KycFailure } | { kind: 'outcome'; record: KycRecord };

/**
 * What the return screen shows: checking until the pull and the record are in, then the outcome.
 * A record that could not be read, or says nothing new (another tab moved it), offers a retry.
 */
function viewOf(completed: Result<KycStatus, KycFailure> | undefined, record: ReturnType<typeof useKycRecord>): ReturnView {
  if (completed === undefined || record.isPending) return { kind: 'checking' };
  if (!completed.ok) return { kind: 'failed', failure: completed.error };
  if (record.data && record.data.status !== 'started') return { kind: 'outcome', record: record.data };
  return { kind: 'failed', failure: 'unavailable' };
}

/** Back from DigiLocker: pull the record once, then show what it says, or the PAN check. */
export function KycReturnScreen() {
  const record = useKycRecord();
  const { complete } = useKycActions();
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    complete.mutate();
  }, [complete]);

  const view = viewOf(complete.data, record);
  if (view.kind === 'outcome') return <KycOutcome record={view.record} onChecked={() => void record.refetch()} />;
  if (view.kind === 'failed') {
    return (
      <StepScreen
        title={t('player.kyc.title')}
        footer={
          <Button variant="primary" fullWidth onClick={() => complete.mutate()}>
            {t('common.retry')}
          </Button>
        }
      >
        <Text>{t(FAILURE_COPY[view.failure])}</Text>
      </StepScreen>
    );
  }
  return (
    <StepScreen title={t('player.kyc.title')} footer={null}>
      <Text tone="muted">{t('player.kyc.checking')}</Text>
    </StepScreen>
  );
}
