import {
  useEraseMember, useMemberErasurePreview, useRemoveErasedKycFiles, type Erasure, type ErasureBlocker, type ErasureFailure, type ErasurePreview,
} from '@rivr/db';
import { formatChips, formatDate, formatList, formatNights, formatNumber, t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Input, Stack, Text, LoadState } from '@rivr/ui';
import { useState } from 'react';

const BLOCKER_COPY: Readonly<Record<ErasureBlocker, MessageKey>> = {
  frozen: 'console.members.erase.blockers.frozen',
  cash: 'console.members.erase.blockers.cash',
  chips: 'console.members.erase.blockers.chips',
  markers: 'console.members.erase.blockers.markers',
  rewards: 'console.members.erase.blockers.rewards',
  redemptions: 'console.members.erase.blockers.redemptions',
  waitlist: 'console.members.erase.blockers.waitlist',
  tournament: 'console.members.erase.blockers.tournament',
  requests: 'console.members.erase.blockers.requests',
  academy: 'console.members.erase.blockers.academy',
};

const FAILURE_COPY: Readonly<Record<ErasureFailure, MessageKey>> = {
  not_allowed: 'console.members.erase.failures.notAllowed',
  wrong_name: 'console.members.erase.failures.wrongName',
  invalid_reason: 'console.members.erase.failures.invalidReason',
  open_items: 'console.members.erase.failures.openItems',
  erased: 'console.members.erase.failures.erased',
  too_soon: 'console.members.erase.failures.tooSoon',
  paused: 'console.members.erase.failures.paused',
  unavailable: 'console.members.erase.failures.unavailable',
};

type Outcome = { readonly erasure: Erasure } | { readonly failure: ErasureFailure } | null;

function OutcomeLine({ outcome }: { outcome: Outcome }) {
  if (outcome === null) return null;
  if ('failure' in outcome) return <ErrorMessage>{t(FAILURE_COPY[outcome.failure])}</ErrorMessage>;
  const { forfeitedPoints, forfeitedBonus, forfeitedNights, filesRemoved } = outcome.erasure;
  const forfeit = { points: formatNumber(forfeitedPoints), bonus: formatChips(forfeitedBonus) };
  return (
    <Stack gap={1}>
      <Text>
        {filesRemoved === null
          ? t('console.members.erase.doneFilesLeft', forfeit)
          : t('console.members.erase.done', { ...forfeit, files: formatNumber(filesRemoved) })}
      </Text>
      {forfeitedNights > 0n ? <Text>{t('console.members.erase.nightsForfeit', { nights: formatNights(forfeitedNights) })}</Text> : null}
    </Stack>
  );
}

/** What erasing would do: what must be cleared first, what the club takes back, and a break's block. */
function Consequences({ preview }: { preview: ErasurePreview }) {
  const forfeit = preview.points === 0 && preview.bonus === 0n
    ? t('console.members.erase.nothingToForfeit')
    : t('console.members.erase.forfeit', { points: formatNumber(preview.points), bonus: formatChips(preview.bonus) });
  const open = formatList(preview.blockers.map((blocker) => t(BLOCKER_COPY[blocker])));
  return (
    <Stack gap={2}>
      {preview.blockers.length > 0 ? <ErrorMessage>{t('console.members.erase.settleFirst', { items: open })}</ErrorMessage> : null}
      <Text>{forfeit}</Text>
      {preview.nights > 0n ? <Text>{t('console.members.erase.nightsForfeit', { nights: formatNights(preview.nights) })}</Text> : null}
      {preview.blockedUntil === null ? null : (
        <Text tone="muted">{t('console.members.erase.blockNote', { date: formatDate(new Date(preview.blockedUntil)) })}</Text>
      )}
    </Stack>
  );
}

/** The full name typed and a reason, then Erase. Kept as typed after a refusal. */
function EraseForm({ venueId, memberId, isBlocked, onOutcome }: {
  venueId: string; memberId: string; isBlocked: boolean; onOutcome: (outcome: Outcome) => void;
}) {
  const erase = useEraseMember(venueId, memberId);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const submit = async () => {
    try {
      const done = await erase.mutateAsync({ fullName: name, reason });
      onOutcome(done.ok ? { erasure: done.value } : { failure: done.error });
    } catch {
      onOutcome({ failure: 'unavailable' });
    }
  };
  const isIncomplete = name.trim() === '' || reason.trim().length < 3;
  return (
    <Stack gap={3}>
      <Input label={t('console.members.erase.typeName')} value={name} autoComplete="off" onChange={(event) => setName(event.target.value)} />
      <Input label={t('console.members.erase.reason')} hint={t('console.members.erase.reasonHint')} value={reason} maxLength={300} autoComplete="off"
        onChange={(event) => setReason(event.target.value)} />
      <Stack align="start">
        <Button variant="danger" isDisabled={isBlocked || isIncomplete} isLoading={erase.isPending} onClick={() => void submit()}>
          {t('console.members.erase.erase')}
        </Button>
      </Stack>
    </Stack>
  );
}

/** An erased member's KYC files still in Storage, and Remove, which may be asked again (after a failure or a restore). */
function FilesLeft({ venueId, memberId, count }: { venueId: string; memberId: string; count: number }) {
  const remove = useRemoveErasedKycFiles(venueId, memberId);
  const [removed, setRemoved] = useState<number | 'failed' | null>(null);
  const submit = async () => {
    try {
      setRemoved((await remove.mutateAsync()) ?? 'failed');
    } catch {
      setRemoved('failed');
    }
  };
  if (count === 0 && removed === null) return null;
  return (
    <Stack gap={2} align="start">
      {removed === 'failed' ? <ErrorMessage>{t('console.members.erase.filesNotRemoved')}</ErrorMessage> : null}
      {typeof removed === 'number' ? <Text>{t('console.members.erase.filesRemoved', { count: formatNumber(removed) })}</Text> : null}
      {count > 0 ? <Text>{t('console.members.erase.filesLeft', { count: formatNumber(count) })}</Text> : null}
      {count > 0 ? (
        <Button variant="secondary" isLoading={remove.isPending} onClick={() => void submit()}>{t('console.members.erase.removeFiles')}</Button>
      ) : null}
    </Stack>
  );
}

/** The section's body for one preview: erased already (with any KYC files left), or what erasing would do and the form. */
function EraseBody({ venueId, memberId, preview }: { venueId: string; memberId: string; preview: ErasurePreview }) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  if (preview.isErased) {
    return (
      <Stack gap={2}>
        <Text>{t('console.members.erase.erased')}</Text>
        <OutcomeLine outcome={outcome} />
        <FilesLeft venueId={venueId} memberId={memberId} count={preview.kycFiles} />
      </Stack>
    );
  }
  return (
    <Stack gap={4}>
      <Text tone="muted">{t('console.members.erase.intro')}</Text>
      <Consequences preview={preview} />
      <OutcomeLine outcome={outcome} />
      <EraseForm venueId={venueId} memberId={memberId} isBlocked={preview.blockers.length > 0} onOutcome={setOutcome} />
    </Stack>
  );
}

/**
 * Erasure on request (#424, decision 0207), for super admins: what erasing would do (what must be cleared first,
 * the points and bonus forfeited, a break's block), then the member's full name typed, a reason, and Erase; once
 * erased, any KYC files still in Storage, with Remove.
 */
export function EraseMember({ venueId, memberId }: { venueId: string; memberId: string }) {
  const preview = useMemberErasurePreview(memberId);
  // The preview is a super admin's alone.
  if (preview.data === null) return null;
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.members.erase.title')}</Heading>
      {preview.isError ? (
        <LoadState isError onRetry={() => void preview.refetch()} />
      ) : null}
      {preview.data === undefined && !preview.isError ? <LoadState /> : null}
      {preview.data === undefined ? null : <EraseBody venueId={venueId} memberId={memberId} preview={preview.data} />}
    </Stack>
  );
}
