import { useFeature } from '@rivr/db';
import { useLearnAnswers, useLearnCards, useLearnEncoding, useLearnLibrary } from '@rivr/db/learn';
import type { AttemptRow, CardState } from '@rivr/drills';
import { builtInSource, type BuiltInSource } from '@rivr/drills/sources';
import { t } from '@rivr/i18n';
import { FeatureGate, Screen } from '@rivr/ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { isAttemptRow, isCardState, openBook, type Book } from '../drill.ts';
import type { Lesson } from '../lessons.ts';
import { Hub } from './Hub.tsx';
import { LessonsView } from './LessonsView.tsx';
import { LessonView } from './LessonView.tsx';
import { ReviewView } from './ReviewView.tsx';
import { Session } from './Session.tsx';

/** Where the member is in a title: its hub, a drill of so many spots, or the review. */
type View =
  | { readonly name: 'hub' } | { readonly name: 'drill'; readonly length: number; readonly run: number } | { readonly name: 'review' }
  | { readonly name: 'lessons' } | { readonly name: 'lesson'; readonly lesson: Lesson };

/**
 * A built-in book's encoding (decision 0274), fetched once when it is opened; nothing for a licensed title. A chunk of
 * this app, not data from the server, so it loads here rather than through @rivr/db.
 */
function useBuiltInEncoding(book: BuiltInSource | undefined) {
  return useQuery({ queryKey: ['built-in-book', book?.id ?? ''], enabled: book !== undefined, staleTime: Infinity, queryFn: () => book?.load() ?? null });
}

/** Where a title comes from: a book that ships with RIVR, or a licensed title in the member's library. */
function useBookSource(sourceKey: string) {
  const library = useLearnLibrary();
  const builtIn = builtInSource(sourceKey);
  const source = library.data?.find((each) => each.sourceKey === sourceKey);
  const licensed = useLearnEncoding(builtIn === undefined ? source : undefined);
  const shipped = useBuiltInEncoding(builtIn);
  return {
    library,
    title: builtIn?.title ?? source?.title,
    encoding: builtIn === undefined ? licensed : shipped,
    // A licensed title not in the member's library: unknown, or its licence or their tier no longer has it.
    isMissing: builtIn === undefined && library.isSuccess && source === undefined,
  };
}

/** Everything a title's screens read: where it comes from, its encoding opened as a book, the member's cards and answers. */
function useTitle(sourceKey: string) {
  const { library, title, encoding, isMissing } = useBookSource(sourceKey);
  const cards = useLearnCards(sourceKey);
  const answers = useLearnAnswers(sourceKey);
  const book = useMemo(() => (encoding.data === undefined ? null : openBook(encoding.data)), [encoding.data]);
  const cardMap = useMemo(() => {
    const held = new Map<string, CardState>();
    for (const card of cards.data ?? []) if (isCardState(card.state)) held.set(card.state.cardKey, card.state);
    return held;
  }, [cards.data]);
  const rows = useMemo(() => {
    const kept: AttemptRow[] = [];
    for (const answer of answers.data?.latest ?? []) if (isAttemptRow(answer)) kept.push(answer);
    return kept;
  }, [answers.data]);
  const queries = [library, encoding, cards, answers];
  return {
    title: title ?? t('player.learn.title'), book, cardMap, rows, answered: answers.data?.total ?? 0, isMissing,
    // Only a first load failing: a background refetch that fails keeps what was read, so a drill goes on.
    isError: queries.some((query) => query.isLoadingError),
    isLoading: queries.some((query) => query.isPending),
    retry: () => void Promise.all(queries.map((query) => query.refetch())),
  };
}

interface ViewsProps {
  book: Book;
  sourceKey: string;
  cards: ReadonlyMap<string, CardState>;
  rows: readonly AttemptRow[];
  answered: number;
}

/** The hub, a drill, the review, or the lessons, and the way between them. */
function Views({ book, sourceKey, cards, rows, answered }: ViewsProps) {
  const [view, setView] = useState<View>({ name: 'hub' });
  // The cards as this device's drills left them, over the server's, so a drill again offline starts from them.
  const [drilled, setDrilled] = useState<ReadonlyMap<string, CardState>>(new Map());
  const current = useMemo(() => new Map([...cards, ...drilled]), [cards, drilled]);
  const keep = (card: CardState) => setDrilled((before) => new Map(before).set(card.cardKey, card));
  const drill = (length: number) => setView({ name: 'drill', length, run: Date.now() });
  if (view.name === 'drill') {
    return <Session key={view.run} book={book} sourceKey={sourceKey} length={view.length} cards={current} onCard={keep}
      onAgain={() => drill(view.length)} onReview={() => setView({ name: 'review' })} onHub={() => setView({ name: 'hub' })} />;
  }
  if (view.name === 'review') return <ReviewView rows={rows} onBack={() => setView({ name: 'hub' })} />;
  if (view.name === 'lessons') {
    return <LessonsView book={book} sourceKey={sourceKey} onOpen={(lesson) => setView({ name: 'lesson', lesson })} onBack={() => setView({ name: 'hub' })} />;
  }
  if (view.name === 'lesson') {
    return <LessonView key={view.lesson.unitId} book={book} sourceKey={sourceKey} lesson={view.lesson} onBack={() => setView({ name: 'lessons' })} />;
  }
  return <Hub book={book} cards={current} rows={rows} answered={answered} onStart={drill} onReview={() => setView({ name: 'review' })}
    onLessons={() => setView({ name: 'lessons' })} />;
}

/**
 * A book, built in (decision 0274) or licensed (#133, #136; feature learn.drills): its hub, a drill of 10, 20 or 50 spots with each verdict and the
 * summary, and the review. The encoding is read once and the drill engine runs here, so a session goes on offline.
 */
export function BookScreen() {
  const sourceKey = useParams({ strict: false }).sourceKey ?? '';
  const drills = useFeature('learn.drills');
  const title = useTitle(sourceKey);
  if (title.isMissing) return <Screen title={title.title} status="error" errorText={t('player.learn.missing')} />;
  if (title.isError) return <Screen title={title.title} status="error" onRetry={title.retry} />;
  if (title.isLoading) return <Screen title={title.title} status="loading" />;
  if (title.book === null) return <Screen title={title.title} status="error" errorText={t('player.learn.unreadable')} />;
  return (
    <FeatureGate access={drills}>
      <Screen title={title.title}>
        <Views book={title.book} sourceKey={sourceKey} cards={title.cardMap} rows={title.rows} answered={title.answered} />
      </Screen>
    </FeatureGate>
  );
}
