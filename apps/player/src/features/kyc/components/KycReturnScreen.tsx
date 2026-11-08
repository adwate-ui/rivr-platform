import type { Result } from '@rivr/contracts';
import { useAuthStatus, useKycActions, useKycAtTheClub, useKycRecord, useSignOut, type KycFailure, type KycRecord, type KycStatus } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, StepScreen, Text } from '@rivr/ui';
import { Navigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';
import { KycOutcome } from './KycOutcome.tsx';
import { KycSteps } from './KycSteps.tsx';

type ReturnView = { kind: 'checking' } | { kind: 'failed'; failure: KycFailure } | { kind: 'outcome'; record: KycRecord } | { kind: 'to-the-desk' };

/**
 * What the return screen shows: checking until the pull and the record are in, then the outcome.
 * A record that could not be read, or says nothing new (another tab moved it), offers a retry.
 */
function viewOf(completed: Result<KycStatus, KycFailure> | undefined, record: ReturnType<typeof useKycRecord>, isAtTheClub: boolean | undefined): ReturnView {
  if (completed === undefined || record.isPending || isAtTheClub === undefined) return { kind: 'checking' };
  // Held for a PAN check that no longer runs, while the desk checks identity: /kyc offers the selfie (audit F-010).
  if (record.data?.status === 'needs_pan' && isAtTheClub) return { kind: 'to-the-desk' };
  // The record first: a check that has already moved on shows where it stands, whatever the pull said. A return with
  // nothing to complete (the back button, a restored tab) is answered 409, which is no outage.
  if (record.data && record.data.status !== 'started') return { kind: 'outcome', record: record.data };
  if (!completed.ok) return { kind: 'failed', failure: completed.error };
  return { kind: 'failed', failure: 'unavailable' };
}

/** The pull failed on a check still to complete: why, Try again, and Sign out. */
function ReturnFailed({ failure, onRetry }: { failure: KycFailure; onRetry: () => void }) {
  const signOut = useSignOut();
  return (
    <StepScreen
      title={t('player.kyc.title')}
      footer={
        <>
          <Button variant="primary" size="tall" fullWidth onClick={onRetry}>
            {t('common.retry')}
          </Button>
          <Button variant="text" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>{t('common.signIn.signOut')}</Button>
        </>
      }
    >
      <KycSteps at="digilocker" />
      <ErrorMessage look="dot">{t(FAILURE_COPY[failure])}</ErrorMessage>
    </StepScreen>
  );
}

/** Back from DigiLocker: pull the record once, then show what it says, or the PAN check. */
export function KycReturnScreen() {
  const authStatus = useAuthStatus();
  const record = useKycRecord();
  const atTheClub = useKycAtTheClub();
  const { complete } = useKycActions();
  const asked = useRef(false);

  // Pulled once the session is known to be signed in; signed out, sign-in comes first (#233).
  useEffect(() => {
    if (asked.current || authStatus !== 'signed-in') return;
    asked.current = true;
    complete.mutate();
  }, [complete, authStatus]);

  if (authStatus === 'signed-out') return <Navigate to="/sign-in" search={{ next: '/kyc/return' }} replace />;
  // A switch that could not be read stands as off: the PAN step, as before.
  const view = viewOf(complete.data, record, atTheClub.isPending ? undefined : atTheClub.data === true);
  if (view.kind === 'to-the-desk') return <Navigate to="/kyc" replace />;
  if (view.kind === 'outcome') return <KycOutcome record={view.record} onChecked={() => void record.refetch()} />;
  if (view.kind === 'failed') return <ReturnFailed failure={view.failure} onRetry={() => complete.mutate()} />;
  return (
    <StepScreen title={t('player.kyc.title')} footer={null}>
      <KycSteps at="digilocker" />
      <Text tone="muted">{t('player.kyc.checking')}</Text>
    </StepScreen>
  );
}
