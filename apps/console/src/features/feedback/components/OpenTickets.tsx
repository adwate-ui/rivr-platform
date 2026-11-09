import { useOpenFeedback, type OpenFeedback } from '@rivr/db';
import { isFeedbackOverdue } from '@rivr/domain/feedback';
import { formatDuration, t } from '@rivr/i18n';
import { BulkBar, DataTable, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { kindLine, ratingsLine, whoLine } from './feedbackLines.ts';
import { ResolveTickets } from './ResolveTickets.tsx';

const ratingOf = (item: OpenFeedback): string => (item.score === null ? t('console.feedback.noRating') : t('console.feedback.score', { score: item.score }));

/** What the member said, whole: what it is and when, the detailed form's ratings, and the note, as one string so a cell cut short still shows it on hover. */
function saidOf(item: OpenFeedback): string {
  const ratings = item.ratings === null ? [] : [ratingsLine(item.ratings)];
  return [kindLine(item), ...ratings, ...(item.note === null ? [] : [item.note])].join(t('console.feedback.ratingsSeparator'));
}

/** The visit's tables and the wait to a first seat; a note from the app has no visit, and a visit may have had no seat. */
function visitOf(item: OpenFeedback): string {
  if (item.visitClosedAt === null) return t('console.feedback.noVisit');
  if (item.tables === null) return t('console.feedback.notSeated');
  return item.waitSeconds === null ? item.tables : t('console.feedback.visitLine', { tables: item.tables, wait: formatDuration(item.waitSeconds) });
}

/** The table's columns, each ticket's age counted from when the list was read; an age past the target needs staff, so it is gold and says so (0463). */
function columnsAt(now: number): readonly DataTableColumn<OpenFeedback>[] {
  const ageOf = (item: OpenFeedback) => Math.floor((now - new Date(item.createdAt).getTime()) / 1000);
  return [
    { key: 'member', header: t('console.feedback.columns.member'), priority: 'primary', sortValue: (item) => item.fullName, cell: whoLine },
    {
      key: 'age', header: t('console.feedback.columns.age'), filter: 'duration', sortValue: ageOf,
      cell: (item) => {
        const age = formatDuration(ageOf(item));
        return isFeedbackOverdue(ageOf(item))
          ? <Text as="span" variant="row" tone="accent">{t('console.feedback.overdue', { age })}</Text>
          : <Text as="span" variant="row" tone="muted">{age}</Text>;
      },
    },
    { key: 'rating', header: t('console.feedback.columns.rating'), filter: 'choice', filterValue: ratingOf, sortValue: (item) => item.score ?? 0, cell: ratingOf },
    { key: 'visit', header: t('console.feedback.columns.visit'), cell: visitOf },
    { key: 'note', header: t('console.feedback.columns.note'), isWide: true, cell: saidOf },
  ];
}

/**
 * The open tickets to work through (F-013): oldest first, filtered by rating and age from their headers, a row opening the
 * member's record, and those ticked resolved with one line of what was done.
 */
export function OpenTickets({ venueId, onNavigate }: { venueId: string; onNavigate: (href: string) => void }) {
  const list = useOpenFeedback(venueId);
  const [selected, setSelected] = useState<string[]>([]);
  const [isResolving, setResolving] = useState(false);
  const clear = () => {
    setSelected([]);
    setResolving(false);
  };
  // A ticket a colleague has resolved since is no longer sent, so a retry can go through.
  const ticked = selected.filter((id) => list.data?.some((item) => item.id === id));
  const state = list.data === undefined
    ? (list.isError ? { status: 'error' as const, onRetry: () => void list.refetch() } : { status: 'loading' as const })
    : { rows: list.data, emptyText: t('console.feedback.noneOpen') };
  return (
    <Stack gap={3}>
      <BulkBar count={ticked.length} onClear={clear} actions={[{ id: 'resolve', label: t('console.feedback.resolve'), onClick: () => setResolving(true), isMain: true }]} />
      {isResolving && ticked.length > 0 ? <ResolveTickets venueId={venueId} ids={ticked} onDone={clear} onCancel={() => setResolving(false)} /> : null}
      <DataTable {...state} label={t('console.feedback.openLabel')} columns={columnsAt(list.dataUpdatedAt)} rowKey={(item) => item.id} initialSort={{ key: 'age', direction: 'descending' }}
        selection={{ selected, onChange: setSelected }} onRowOpen={(item) => onNavigate(`/members?member=${encodeURIComponent(item.memberId)}`)} />
    </Stack>
  );
}
