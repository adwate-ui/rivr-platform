import type { Result } from '@rivr/contracts';
import { useAuthStatus, useKycActions, useKycAtTheClub, useKycRecord, useSignOut, type KycFailure, type KycRecord, type KycStatus } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, StepScreen, Text } from '@rivr/ui';
import { Navigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';
import { KycOutcome } from './KycOutcome.tsx';
import { KycSteps } from './KycSteps.tsx';

// Zoop sends DigiLocker's documents to RIVR a moment after the member is back (decision 0676): the screen asks again every
// 3 seconds, and after 2 minutes says they have not come, with Try again.
const ASK_AGAIN_MS = 3000;
const WAIT_AT_MOST_MS = 120_000;

type ReturnView = { kind: 'checking' } | { kind: 'failed'; message: string } | { kind: 'outcome'; record: KycRecord } | { kind: 'to-the-desk' };

type Completion = Result<KycStatus | 'waiting' | 'at_club', KycFailure>;

/** A check still to complete that the kyc function answered: checking while its documents are on their way. */
function stillToComplete(answer: KycStatus | 'waiting' | 'at_club', hasWaitedTooLong: boolean): ReturnView {
  if (answer !== 'waiting') return { kind: 'failed', message: t(FAILURE_COPY.unavailable) };
  return hasWaitedTooLong ? { kind: 'failed', message: t('player.kyc.notArrived') } : { kind: 'checking' };
}

/**
 * Whether the check now waits for the desk, which /kyc says: Zoop did not verify the member (decision 0678), or a check
 * held for a PAN check that no longer runs while the desk checks identity (audit F-010).
 */
function isForTheDesk(completed: Completion, record: KycRecord | null | undefined, isAtTheClub: boolean): boolean {
  if (completed.ok && completed.value === 'at_club') return true;
  if (record?.status === 'started' && record.isAtTheClub) return true;
  return record?.status === 'needs_pan' && isAtTheClub;
}

/**
 * What the return screen shows: checking until the record and its documents are in, then the outcome.
 * A record that could not be read, or says nothing new (another tab moved it), offers a retry.
 */
function viewOf(completed: Completion | undefined, record: ReturnType<typeof useKycRecord>, isAtTheClub: boolean | undefined, hasWaitedTooLong: boolean): ReturnView {
  if (completed === undefined || record.isPending || isAtTheClub === undefined) return { kind: 'checking' };
  if (isForTheDesk(completed, record.data, isAtTheClub)) return { kind: 'to-the-desk' };
  // The record first: a check that has already moved on shows where it stands, whatever the pull said. A return with
  // nothing to complete (the back button, a restored tab) is answered 409, which is no outage.
  if (record.data && record.data.status !== 'started') return { kind: 'outcome', record: record.data };
  if (!completed.ok) return { kind: 'failed', message: t(FAILURE_COPY[completed.error]) };
  return stillToComplete(completed.value, hasWaitedTooLong);
}

/** The record is not in yet: why, Try again, and Sign out. */
function ReturnFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
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
      <ErrorMessage look="dot">{message}</ErrorMessage>
    </StepScreen>
  );
}

/**
 * While the kyc function says the documents are on their way: asks again shortly, for two minutes at most. Gives whether
 * that has run out, and a fresh start for Try again.
 */
function useAskWhileWaiting(complete: ReturnType<typeof useKycActions>['complete']): readonly [boolean, () => void] {
  const { data, isPending, mutate } = complete;
  const waitingSince = useRef<number | null>(null);
  const [hasWaitedTooLong, setHasWaitedTooLong] = useState(false);
  const isWaiting = data?.ok === true && data.value === 'waiting';
  useEffect(() => {
    if (!isWaiting || isPending || hasWaitedTooLong) return undefined;
    waitingSince.current ??= Date.now();
    const timer = setTimeout(() => {
      if (Date.now() - (waitingSince.current ?? 0) >= WAIT_AT_MOST_MS) setHasWaitedTooLong(true);
      else mutate();
    }, ASK_AGAIN_MS);
    return () => clearTimeout(timer);
  }, [isWaiting, isPending, hasWaitedTooLong, data, mutate]);
  const askAfresh = () => {
    waitingSince.current = null;
    setHasWaitedTooLong(false);
    mutate();
  };
  return [hasWaitedTooLong, askAfresh];
}

/** Back from DigiLocker: take the record, asking again while it is on its way, then show what it says, or the PAN check. */
export function KycReturnScreen() {
  const authStatus = useAuthStatus();
  const record = useKycRecord();
  const atTheClub = useKycAtTheClub();
  const { complete } = useKycActions();
  const asked = useRef(false);
  const [hasWaitedTooLong, askAfresh] = useAskWhileWaiting(complete);

  // Asked once the session is known to be signed in; signed out, sign-in comes first (#233).
  useEffect(() => {
    if (asked.current || authStatus !== 'signed-in') return;
    asked.current = true;
    complete.mutate();
  }, [complete, authStatus]);

  if (authStatus === 'signed-out') return <Navigate to="/sign-in" search={{ next: '/kyc/return' }} replace />;
  // A switch that could not be read stands as off: the PAN step, as before.
  const view = viewOf(complete.data, record, atTheClub.isPending ? undefined : atTheClub.data === true, hasWaitedTooLong);
  if (view.kind === 'to-the-desk') return <Navigate to="/kyc" replace />;
  if (view.kind === 'outcome') return <KycOutcome record={view.record} onChecked={() => void record.refetch()} />;
  if (view.kind === 'failed') return <ReturnFailed message={view.message} onRetry={askAfresh} />;
  return (
    <StepScreen title={t('player.kyc.title')} footer={null}>
      <KycSteps at="digilocker" />
      <Text tone="muted">{t('player.kyc.checking')}</Text>
    </StepScreen>
  );
}
