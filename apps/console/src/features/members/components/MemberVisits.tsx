import { useMemberVisitRequests, useMemberVisits, type MemberVisit, type VisitRequest, type VisitTimes } from '@rivr/db';
import { formatDate, formatDuration, formatTime, t } from '@rivr/i18n';
import { Button, DetailRow, Heading, Inline, LoadState, Stack, Text } from '@rivr/ui';
import { useState, type ComponentType } from 'react';
import { AddVisit, useVisitForm } from './AddVisit.tsx';

/** Lines shown at first, and how many more each Show earlier adds. */
const PAGE = 20;

/** The panel that edits a visit (#1075): Bonus approvals' own, which the route hands in, for super admins (#1134). */
export type EditVisitPanel = ComponentType<{
  venueId: string; memberId: string; subtitle: string; visits: readonly VisitTimes[]; onDone: () => void; onCancel: () => void;
}>;

/** Whether the call time owed was met, whether they left early, and why they left each table (#1060), in words; empty when none applies. */
function flagsOf(visit: MemberVisit): string {
  const callTime = visit.callTimeMet === null ? [] : [t(visit.callTimeMet ? 'console.members.visitHistory.callTimeMet' : 'console.members.visitHistory.callTimeOwed')];
  const reasons = visit.leaveReasons.map((reason) => t(`common.leaveReasons.${reason}`)).join(', ');
  const why = reasons === '' ? [] : [t('console.members.visitHistory.leftBecause', { reasons })];
  return [...callTime, ...(visit.leftEarly ? [t('console.members.visitHistory.leftEarly')] : []), ...why].join(' · ');
}

/** The visit as Edit takes it: a closed one, with its seats read for a super admin; none otherwise. */
function editableOf(visit: MemberVisit): VisitTimes | null {
  return visit.sessions === null || visit.closedAt === null ? null : { visitId: visit.visitId, openedAt: visit.openedAt, closedAt: visit.closedAt, sessions: visit.sessions };
}

function VisitLine({ visit, isLast, onEdit }: { visit: MemberVisit; isLast: boolean; onEdit: ((visit: VisitTimes) => void) | null }) {
  const flags = flagsOf(visit);
  const editable = onEdit === null ? null : editableOf(visit);
  const date = formatDate(new Date(visit.openedAt));
  return (
    <Stack gap={0}>
      <DetailRow size="small" isLast={isLast && flags === '' && editable === null} value={formatDuration(visit.minutesPlayed * 60)}
        label={t('console.members.visitHistory.line', { date, tables: visit.tables ?? t('console.members.visitHistory.noTable') })} />
      {flags === '' ? null : <Text variant="caption" tone="muted">{flags}</Text>}
      {editable === null || onEdit === null ? null : (
        <Inline>
          <Button variant="text" size="small" aria-label={t('console.members.visitsAdded.editNamed', { date })} onClick={() => onEdit(editable)}>
            {t('console.members.visitsAdded.edit')}
          </Button>
        </Inline>
      )}
    </Stack>
  );
}

/** An added visit not yet counted (#1134): waiting for a super admin, or refused, with why. */
function RequestLine({ request }: { request: VisitRequest }) {
  const words = { date: formatDate(new Date(request.openedAt)), from: formatTime(new Date(request.openedAt)), to: formatTime(new Date(request.closedAt)), table: request.tableName };
  return (
    <Text variant="small" tone="muted">
      {request.isRefused ? t('console.members.visitsAdded.refusedLine', { ...words, why: request.refusal ?? '' }) : t('console.members.visitsAdded.waitingLine', words)}
    </Text>
  );
}

/**
 * The floor and up add a past visit (#1134): the button opens its form below and closes it, so the focus stays on it; what
 * was typed stays while it is closed.
 */
function Adding({ venueId, memberId }: { venueId: string; memberId: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const form = useVisitForm();
  return (
    <>
      <Inline>
        <Button variant="subtle" size="compact" aria-expanded={isAdding} onClick={() => setIsAdding(!isAdding)}>{t('console.members.visitsAdded.add')}</Button>
      </Inline>
      {isAdding ? <AddVisit venueId={venueId} memberId={memberId} form={form} /> : null}
    </>
  );
}

interface MemberVisitsProps {
  venueId: string;
  memberId: string;
  /** The member's name, which Edit's panel says. */
  fullName?: string;
  pageSize?: number;
  /** The floor and up add a past visit (visits.add, the owner, 25 Nov). */
  canAdd?: boolean;
  /** Edit, for a super admin. */
  edit?: EditVisitPanel | undefined;
}

/** The visits, with Edit on each for a super admin, its panel open on the one chosen. */
function Visits({ lines, venueId, memberId, fullName, edit: Edit }: {
  lines: readonly MemberVisit[]; venueId: string; memberId: string; fullName: string; edit: EditVisitPanel | undefined;
}) {
  const [editing, setEditing] = useState<VisitTimes | null>(null);
  if (lines.length === 0) return <Text tone="muted">{t('console.members.visitHistory.none')}</Text>;
  return (
    <>
      <Stack gap={1}>
        {lines.map((visit, index) => <VisitLine key={visit.visitId} visit={visit} isLast={index === lines.length - 1} onEdit={Edit === undefined ? null : setEditing} />)}
      </Stack>
      {Edit === undefined || editing === null ? null : (
        <Edit venueId={venueId} memberId={memberId} visits={[editing]} onDone={() => setEditing(null)} onCancel={() => setEditing(null)}
          subtitle={t('console.members.visitsAdded.editSubtitle', { name: fullName, date: formatDate(new Date(editing.openedAt)) })} />
      )}
    </>
  );
}

/**
 * Each visit on the record (F-017), newest first: its day, tables, time played, the call time owed, whether they left early,
 * and why they left. Above them, for the floor and up, Add visit and the adds not yet counted; for a super admin, Edit on
 * each visit that is over (the owner, 25 Nov; #1134).
 */
export function MemberVisits({ venueId, memberId, fullName = '', pageSize = PAGE, canAdd = false, edit }: MemberVisitsProps) {
  const [count, setCount] = useState(pageSize);
  const visits = useMemberVisits(venueId, memberId, count);
  const requests = useMemberVisitRequests(venueId, memberId, canAdd).data ?? [];
  const title = <Heading level={3}>{t('console.members.visitHistory.title')}</Heading>;
  if (visits.isError) return <Stack gap={2}>{title}<LoadState isError onRetry={() => void visits.refetch()} /></Stack>;
  if (visits.data === undefined) return <Stack gap={2}>{title}<LoadState /></Stack>;
  const lines = visits.data;
  return (
    <Stack gap={2}>
      {title}
      {canAdd ? <Adding venueId={venueId} memberId={memberId} /> : null}
      {requests.map((request) => <RequestLine key={request.requestId} request={request} />)}
      <Visits lines={lines} venueId={venueId} memberId={memberId} fullName={fullName} edit={edit} />
      {lines.length < count ? null : <Button variant="text" size="small" onClick={() => setCount(count + pageSize)}>{t('console.members.bonus.showEarlier')}</Button>}
    </Stack>
  );
}
