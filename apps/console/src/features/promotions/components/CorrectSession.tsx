import { bonusRefusalSchema } from '@rivr/contracts';
import { useCorrectSession, type CorrectionDone, type SeatCorrection, type SessionCorrectionFailure, type WaitingBonus, type WaitingSession, type WaitingVisit } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Sheet, Stack, Text, UnitInput, useToast } from '@rivr/ui';
import { useState } from 'react';
import { correctionOf, draftOf, endOf, type SeatDraft } from './sessionCorrection.ts';

// A reason as a refusal takes it, 3 to 200 characters: the database asks the same of a correction.
const isReason = (reason: string) => bonusRefusalSchema.safeParse({ reason }).success;

/** One seat's fields: when they left, for a seat that is over, and their minutes away. */
function SeatFields({ session, draft, isChecked, onChange }: { session: WaitingSession; draft: SeatDraft; isChecked: boolean; onChange: (draft: SeatDraft) => void }) {
  const named = { table: session.tableName, from: formatTime(new Date(session.startedAt)) };
  const isOver = session.endedAt !== null;
  return (
    <Stack gap={2}>
      <Text weight="medium">{isOver ? t('console.promotions.approvals.correction.seat', named) : t('console.promotions.approvals.correction.seatOpen', named)}</Text>
      {isOver ? (
        <Input label={t('console.promotions.approvals.correction.leftAt')} hint={t('console.promotions.approvals.correction.leftAtHint')} value={draft.leftAt}
          maxLength={5} autoComplete="off" onChange={(event) => onChange({ ...draft, leftAt: event.target.value })}
          error={isChecked && endOf(session, draft.leftAt) === undefined ? t('console.promotions.approvals.correction.badTime') : undefined} />
      ) : null}
      <UnitInput label={t('console.promotions.approvals.correction.away')} unit="minutes" min={0} max={1440} initialValue={draft.awayMinutes}
        hint={t('console.promotions.approvals.correction.awayHint')} onChange={(awayMinutes) => onChange({ ...draft, awayMinutes })} />
      {isChecked && draft.awayMinutes === null ? <ErrorMessage>{t('console.promotions.approvals.correction.badAway')}</ErrorMessage> : null}
    </Stack>
  );
}

/** The seats' corrections to send, all in one call, or what stops them: a time that cannot be read, or nothing changed. */
function toSend(visit: WaitingVisit, drafts: Readonly<Record<string, SeatDraft>>): readonly SeatCorrection[] | 'invalid' | 'unchanged' {
  const each = visit.sessions.map((session) => correctionOf(session, drafts[session.sessionId] ?? draftOf(session)));
  if (each.includes('invalid')) return 'invalid';
  const changed = each.flatMap((one) => (one === null || one === 'invalid' ? [] : [one]));
  return changed.length === 0 ? 'unchanged' : changed;
}

/** What the correction did: waiting Bonus refused, and Bonus already given above the corrected time, which stays. */
function saidOf({ refused, givenAbove }: CorrectionDone): string {
  if (refused > 0 && givenAbove > 0) return t('console.promotions.approvals.correction.savedBoth', { refused, given: givenAbove });
  if (refused > 0) return t('console.promotions.approvals.correction.savedRefused', { count: refused });
  if (givenAbove > 0) return t('console.promotions.approvals.correction.savedGivenAbove', { count: givenAbove });
  return t('console.promotions.approvals.correction.saved');
}

/**
 * A super admin corrects a play-time Bonus's visit (#1061, the owner, 17 Nov), in the panel at the side: when the player
 * left each seat and their minutes away (any still running included), with one reason kept in Activity, all in one call.
 * Waiting steps the corrected time no longer reaches are refused; Bonus already given stays, and the message says how much
 * is above the corrected time. The caller draws it only while a session is being corrected.
 */
export function CorrectSession({ venueId, bonus, visit, onDone, onCancel }: { venueId: string; bonus: WaitingBonus; visit: WaitingVisit; onDone: () => void; onCancel: () => void }) {
  const correct = useCorrectSession(venueId);
  const toast = useToast();
  const [drafts, setDrafts] = useState<Readonly<Record<string, SeatDraft>>>(() => Object.fromEntries(visit.sessions.map((session) => [session.sessionId, draftOf(session)])));
  const [reason, setReason] = useState('');
  const [isChecked, setChecked] = useState(false);
  const [failure, setFailure] = useState<SessionCorrectionFailure | 'unchanged' | null>(null);
  const submit = async () => {
    setChecked(true);
    const sending = toSend(visit, drafts);
    setFailure(sending === 'unchanged' ? sending : null);
    if (typeof sending === 'string' || !isReason(reason)) return;
    const outcome = await correct.mutateAsync({ seats: sending, reason });
    if (!outcome.ok) return setFailure(outcome.error);
    toast(saidOf(outcome.value));
    onDone();
  };
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onCancel}>{t('console.promotions.approvals.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={correct.isPending} onClick={() => void submit()}>{t('console.promotions.approvals.correction.save')}</Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={onCancel} title={t('console.promotions.approvals.correction.title')} footer={footer}>
      <Stack gap={4}>
        <Text tone="muted">{t('console.promotions.approvals.correction.subtitle', { name: bonus.fullName, promotion: bonus.promotionName })}</Text>
        {visit.sessions.map((session) => (
          <SeatFields key={session.sessionId} session={session} draft={drafts[session.sessionId] ?? draftOf(session)} isChecked={isChecked}
            onChange={(draft) => setDrafts({ ...drafts, [session.sessionId]: draft })} />
        ))}
        <Input label={t('console.promotions.approvals.correction.reason')} hint={t('console.promotions.approvals.correction.reasonHint')} value={reason} maxLength={200}
          autoComplete="off" onChange={(event) => setReason(event.target.value)}
          error={isChecked && !isReason(reason) ? t('console.promotions.approvals.invalidReason') : undefined} />
        {failure === null ? null : <ErrorMessage>{failure === 'unchanged' ? t('console.promotions.approvals.correction.unchanged') : t(`console.promotions.approvals.correction.failures.${failure}`)}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
