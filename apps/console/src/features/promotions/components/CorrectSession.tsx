import { bonusRefusalSchema } from '@rivr/contracts';
import { useCorrectVisit, type CorrectionDone, type SessionCorrectionFailure, type VisitTimes, type WaitingSession } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Sheet, Stack, Text, UnitInput, useToast } from '@rivr/ui';
import { useId, useState } from 'react';
import {
  checkedInOf, checkedOutOf, draftOf, endOf, visitCorrectionOf, visitDraftOf, visitProblemsOf, type SeatDraft, type TimeProblem, type VisitDraft, type VisitProblems,
} from './sessionCorrection.ts';

// A reason as a refusal takes it, 3 to 200 characters: the database asks the same of a correction.
const isReason = (reason: string) => bonusRefusalSchema.safeParse({ reason }).success;
const at = (iso: string) => formatTime(new Date(iso));

/** One seat's fields: when they left, for a seat that is over, and their minutes away. */
function SeatFields({ session, draft, isChecked, onChange }: { session: WaitingSession; draft: SeatDraft; isChecked: boolean; onChange: (draft: SeatDraft) => void }) {
  const named = { table: session.tableName, from: at(session.startedAt) };
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

/** Which rule refuses a time (#1078): ahead of now, after the first seat, before the last, or past the club day's end. */
const problemWords = ({ rule, at: when }: TimeProblem) => t(`console.promotions.approvals.correction.${rule}`, { time: when === null ? '' : at(when) });

/** A time's line under its field, once Save is pressed: one that cannot be read, else the rule it breaks. */
function timeError(isChecked: boolean, isUnread: boolean, problem: TimeProblem | null): string | undefined {
  if (!isChecked) return undefined;
  if (isUnread) return t('console.promotions.approvals.correction.badTime');
  return problem === null ? undefined : problemWords(problem);
}

/** The visit's check-in, and its check-out once it is over (#1075), each with what refuses it (#1078). */
function VisitFields({ visit, draft, problems, isChecked, onChange }: {
  visit: VisitTimes; draft: VisitDraft; problems: VisitProblems; isChecked: boolean; onChange: (draft: VisitDraft) => void;
}) {
  return (
    <Inline gap={3} align="start">
      <Input label={t('console.promotions.approvals.correction.checkedIn')} hint={t('console.promotions.approvals.correction.leftAtHint')} value={draft.checkedIn}
        maxLength={5} autoComplete="off" onChange={(event) => onChange({ ...draft, checkedIn: event.target.value })}
        error={timeError(isChecked, checkedInOf(visit, draft.checkedIn) === undefined, problems.checkedIn)} />
      {visit.closedAt === null ? null : (
        <Input label={t('console.promotions.approvals.correction.checkedOut')} value={draft.checkedOut} maxLength={5} autoComplete="off"
          onChange={(event) => onChange({ ...draft, checkedOut: event.target.value })}
          error={timeError(isChecked, checkedOutOf(visit, draft) === undefined, problems.checkedOut)} />
      )}
    </Inline>
  );
}

/** A visit by its times, to choose among a day's: `19:05 to 23:40`, or `From 19:05` while they are in. */
const visitWords = (visit: VisitTimes) => (visit.closedAt === null
  ? t('console.promotions.approvals.correction.visitOpen', { from: at(visit.openedAt) })
  : t('console.promotions.approvals.correction.visit', { from: at(visit.openedAt), to: at(visit.closedAt) }));

/** What the correction did: waiting Bonus refused, and Bonus already given above the corrected time, which stays. */
function saidOf({ refused, givenAbove }: CorrectionDone): string {
  if (refused > 0 && givenAbove > 0) return t('console.promotions.approvals.correction.savedBoth', { refused, given: givenAbove });
  if (refused > 0) return t('console.promotions.approvals.correction.savedRefused', { count: refused });
  if (givenAbove > 0) return t('console.promotions.approvals.correction.savedGivenAbove', { count: givenAbove });
  return t('console.promotions.approvals.correction.saved');
}

const timesOfAll = (visits: readonly VisitTimes[]) => Object.fromEntries(visits.map((visit) => [visit.visitId, visitDraftOf(visit)]));
const seatsOfAll = (visits: readonly VisitTimes[]) => Object.fromEntries(visits.flatMap((visit) => visit.sessions).map((session) => [session.sessionId, draftOf(session)]));

/** What is typed for the visit chosen: its times and each seat's. */
function useDrafts(visits: readonly VisitTimes[]) {
  const [times, setTimes] = useState<Readonly<Record<string, VisitDraft>>>(() => timesOfAll(visits));
  const [seats, setSeats] = useState<Readonly<Record<string, SeatDraft>>>(() => seatsOfAll(visits));
  return {
    seats,
    /** Every visit as it is again, for the visit chosen next. */
    reset: () => { setTimes(timesOfAll(visits)); setSeats(seatsOfAll(visits)); },
    timesOf: (visit: VisitTimes) => times[visit.visitId] ?? visitDraftOf(visit),
    seatOf: (session: WaitingSession) => seats[session.sessionId] ?? draftOf(session),
    setTimes: (visit: VisitTimes, draft: VisitDraft) => setTimes({ ...times, [visit.visitId]: draft }),
    setSeat: (session: WaitingSession, draft: SeatDraft) => setSeats({ ...seats, [session.sessionId]: draft }),
  };
}

/** A choice among the day's visits; another waits while the chosen one has changes not saved, as Save sends one visit. */
function VisitChoice({ visits, visit, isEdited, onChoose }: { visits: readonly VisitTimes[]; visit: VisitTimes; isEdited: boolean; onChoose: (visitId: string) => void }) {
  // The line says why the other chips are dimmed, read with them (#1078), as the floor's call-time chips do.
  const saveFirstId = useId();
  if (visits.length < 2) return null;
  return (
    <Stack gap={2}>
      <ChoiceChips label={t('console.promotions.approvals.correction.visits')} mode="one" look="subtle" selected={[visit.visitId]}
        options={visits.map((one) => ({ value: one.visitId, label: visitWords(one), isDisabled: isEdited && one.visitId !== visit.visitId }))}
        describedBy={isEdited ? saveFirstId : undefined}
        onChange={([picked]) => { if (picked !== undefined && picked !== visit.visitId) onChoose(picked); }} />
      {isEdited ? <Text id={saveFirstId} variant="small" tone="muted">{t('console.promotions.approvals.correction.saveFirst')}</Text> : null}
    </Stack>
  );
}

/** The chosen visit's fields: a choice among the day's visits when there are more, its times, then each seat's. */
function VisitBody({ visits, visit, drafts, isChecked, onChoose }: {
  visits: readonly VisitTimes[]; visit: VisitTimes; drafts: ReturnType<typeof useDrafts>; isChecked: boolean; onChoose: (visitId: string) => void;
}) {
  const isEdited = visitCorrectionOf(visit, drafts.timesOf(visit), drafts.seats) !== 'unchanged';
  return (
    <>
      <VisitChoice visits={visits} visit={visit} isEdited={isEdited} onChoose={onChoose} />
      <VisitFields visit={visit} draft={drafts.timesOf(visit)} problems={visitProblemsOf(visit, drafts.timesOf(visit), drafts.seats)} isChecked={isChecked}
        onChange={(draft) => drafts.setTimes(visit, draft)} />
      {visit.sessions.map((session) => (
        <SeatFields key={session.sessionId} session={session} draft={drafts.seatOf(session)} isChecked={isChecked}
          onChange={(draft) => drafts.setSeat(session, draft)} />
      ))}
    </>
  );
}

/** Cancel and Save, at the foot of the panel. */
function Footer({ isSaving, onCancel, onSave }: { isSaving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onCancel}>{t('console.promotions.approvals.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={isSaving} onClick={onSave}>{t('console.promotions.approvals.correction.save')}</Button>
    </Inline>
  );
}

/** The panel as Bonus approvals and the Players report open it (#1075). */
export interface CorrectSessionProps {
  venueId: string;
  memberId: string;
  /** Under the title: the member, and the promotion or the day. */
  subtitle: string;
  /** The visits to correct, one at a time: the first shown first, with a choice when there are more. */
  visits: readonly VisitTimes[];
  onDone: () => void;
  onCancel: () => void;
}

/**
 * A super admin corrects a visit (#1061, #1075; the owner, 17 and 18 Nov), in the panel at the side: its check-in and
 * check-out, when the player left each seat and their minutes away (any still running included), with one reason kept in
 * Activity, all in one call. Waiting play-time steps the corrected time no longer reaches are refused; Bonus already given
 * stays, and the message says how much is above the corrected time. The caller draws it only while a visit is corrected.
 */
export function CorrectSession({ venueId, memberId, subtitle, visits, onDone, onCancel }: CorrectSessionProps) {
  const correct = useCorrectVisit(venueId);
  const toast = useToast();
  const drafts = useDrafts(visits);
  const [chosenId, setChosenId] = useState(visits[0]?.visitId);
  const [reason, setReason] = useState('');
  const [isChecked, setChecked] = useState(false);
  const [failure, setFailure] = useState<SessionCorrectionFailure | 'unchanged' | null>(null);
  const visit = visits.find((one) => one.visitId === chosenId) ?? visits[0];
  if (visit === undefined) return null;
  const submit = async () => {
    setChecked(true);
    const sending = visitCorrectionOf(visit, drafts.timesOf(visit), drafts.seats);
    const problems = visitProblemsOf(visit, drafts.timesOf(visit), drafts.seats);
    setFailure(sending === 'unchanged' ? sending : null);
    if (typeof sending === 'string' || !isReason(reason) || problems.checkedIn !== null || problems.checkedOut !== null) return;
    const outcome = await correct.mutateAsync({ visitId: visit.visitId, memberId, ...sending, reason });
    if (!outcome.ok) return setFailure(outcome.error);
    toast(saidOf(outcome.value));
    onDone();
  };
  return (
    <Sheet place="console" isOpen onClose={onCancel} title={t('console.promotions.approvals.correction.title')} subtitle={subtitle}
      footer={<Footer isSaving={correct.isPending} onCancel={onCancel} onSave={() => void submit()} />}>
      <Stack gap={4}>
        <VisitBody visits={visits} visit={visit} drafts={drafts} isChecked={isChecked}
          onChoose={(visitId) => { drafts.reset(); setChosenId(visitId); setChecked(false); setFailure(null); }} />
        <Input label={t('console.promotions.approvals.correction.reason')} hint={t('console.promotions.approvals.correction.reasonHint')} value={reason} maxLength={200}
          autoComplete="off" onChange={(event) => setReason(event.target.value)}
          error={isChecked && !isReason(reason) ? t('console.promotions.approvals.invalidReason') : undefined} />
        {failure === null ? null : <ErrorMessage>{failure === 'unchanged' ? t('console.promotions.approvals.correction.unchanged') : t(`console.promotions.approvals.correction.failures.${failure}`)}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
