import { LIST_PAGE, useListChoices, useOpenFeedbackPage, type ListChoices, type ListFilter, type ListView, type OpenFeedback } from '@rivr/db';
import { isFeedbackOverdue } from '@rivr/domain/feedback';
import { formatDuration, t } from '@rivr/i18n';
import { BulkBar, DataTable, Stack, Text, type DataTableColumn, type DataTableRequest } from '@rivr/ui';
import { useState } from 'react';
import { kindLine, ratingsLine, whoLine } from './feedbackLines.ts';
import { ResolveTickets } from './ResolveTickets.tsx';

/** A rating in the table's words: `2 of 5`, or that the note came with none. */
const ratingWords = (score: number | null): string => (score === null || score === 0 ? t('console.feedback.noRating') : t('console.feedback.score', { score }));
const ratingOf = (item: OpenFeedback): string => ratingWords(item.score);

/** The ratings the server counts, `0` for none to `5`, each with the table's words for it. */
const RATINGS = [0, 1, 2, 3, 4, 5] as const;

/** What the Rating menu offers: the server's counts over every open ticket, in the table's words. */
function ratingChoices(counted: ListChoices | undefined) {
  return (counted?.['rating'] ?? []).map(({ value, count }) => ({ value: ratingWords(Number(value)), count }));
}

/** The view as the server reads it: a rating chosen by its words goes as its figure. */
function viewOf(request: DataTableRequest | null): ListView | null {
  if (request === null) return null;
  const rating = request.filters['rating'];
  if (rating?.kind !== 'choice') return request;
  const chosen: ListFilter = { kind: 'choice', chosen: rating.chosen.map((words) => String(RATINGS.find((score) => ratingWords(score) === words) ?? words)) };
  return { ...request, filters: { ...request.filters, rating: chosen } };
}

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

/**
 * The table's columns, each ticket's age counted from when the page was read; an age past the target needs staff, so it is
 * gold and says so (0463). The server sorts and filters, so each column says its kind of filter, and Rating's menu holds
 * the server's counts.
 */
function columnsAt(now: number, counted: ListChoices | undefined): readonly DataTableColumn<OpenFeedback>[] {
  const ageOf = (item: OpenFeedback) => Math.floor((now - new Date(item.createdAt).getTime()) / 1000);
  return [
    { key: 'member', header: t('console.feedback.columns.member'), priority: 'primary', sortValue: (item) => item.fullName, cell: whoLine, filter: 'text' },
    {
      key: 'age', header: t('console.feedback.columns.age'), filter: 'duration', sortValue: ageOf,
      cell: (item) => {
        const age = formatDuration(ageOf(item));
        return isFeedbackOverdue(ageOf(item))
          ? <Text as="span" variant="row" tone="accent">{t('console.feedback.overdue', { age })}</Text>
          : <Text as="span" variant="row" tone="muted">{age}</Text>;
      },
    },
    { key: 'rating', header: t('console.feedback.columns.rating'), filter: 'choice', choices: ratingChoices(counted), filterValue: ratingOf, sortValue: (item) => item.score ?? 0, cell: ratingOf },
    { key: 'visit', header: t('console.feedback.columns.visit'), cell: visitOf, filter: 'text' },
    { key: 'note', header: t('console.feedback.columns.note'), isWide: true, cell: saidOf, filter: 'text' },
  ];
}

/**
 * The open tickets to work through (F-013), a page at a time from the server (redesign RD-30): oldest first, searched by
 * member, note or topic, filtered by rating and age from their headers, a row opening the member's record, and those
 * ticked resolved with one line of what was done.
 */
export function OpenTickets({ venueId, onNavigate }: { venueId: string; onNavigate: (href: string) => void }) {
  // The table's view as it last handed it over; none until it is first drawn.
  const [request, setRequest] = useState<DataTableRequest | null>(null);
  const view = viewOf(request);
  const list = useOpenFeedbackPage(venueId, view);
  const counted = useListChoices('feedback_open', venueId, view).data;
  const [selected, setSelected] = useState<string[]>([]);
  const [isResolving, setResolving] = useState(false);
  const clear = () => {
    setSelected([]);
    setResolving(false);
  };
  // A ticket a colleague has resolved since is no longer sent, so a retry can go through.
  const ticked = selected.filter((id) => list.data?.rows.some((item) => item.id === id));
  const state = list.data === undefined
    ? (list.isError ? { status: 'error' as const, onRetry: () => void list.refetch() } : { status: 'loading' as const })
    : { rows: list.data.rows, emptyText: t('console.feedback.noneOpen') };
  const search = { label: t('console.feedback.search'), variant: 'subtle' as const, text: (item: OpenFeedback) => item.fullName };
  const oldestFirst = { key: 'age', direction: 'descending' } as const;
  return (
    <Stack gap={3}>
      <BulkBar count={ticked.length} onClear={clear} actions={[{ id: 'resolve', label: t('console.feedback.resolve'), onClick: () => setResolving(true), isMain: true }]} />
      {isResolving && ticked.length > 0 ? <ResolveTickets venueId={venueId} ids={ticked} onDone={clear} onCancel={() => setResolving(false)} /> : null}
      <DataTable {...state} label={t('console.feedback.openLabel')} columns={columnsAt(list.dataUpdatedAt, counted)} rowKey={(item) => item.id} initialSort={oldestFirst}
        filter={search}
        server={{ total: list.data?.total ?? 0, pageSize: LIST_PAGE, onRequest: setRequest }} exportRows={list.readEvery}
        selection={{ selected, onChange: setSelected }} onRowOpen={(item) => onNavigate(`/members?member=${encodeURIComponent(item.memberId)}`)} />
    </Stack>
  );
}
