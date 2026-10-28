import { useFeature } from '@rivr/db';
import { useLearnAnswers, useLearnCards, useLearnEncoding, useLearnLibrary } from '@rivr/db/learn';
import type { AttemptRow, CardState } from '@rivr/drills';
import { t } from '@rivr/i18n';
import { FeatureGate, Screen } from '@rivr/ui';
import { useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { isAttemptRow, isCardState, openBook, type Book } from '../drill.ts';
import { Hub } from './Hub.tsx';
import { ReviewView } from './ReviewView.tsx';
import { Session } from './Session.tsx';

/** Where the member is in a title: its hub, a drill of so many spots, or the review. */
type View = { readonly name: 'hub' } | { readonly name: 'drill'; readonly length: number; readonly run: number } | { readonly name: 'review' };

/** Everything a title's screens read: its library row, encoding opened as a book, the member's cards and answers. */
function useTitle(sourceKey: string) {
  const library = useLearnLibrary();
  const source = library.data?.find((each) => each.sourceKey === sourceKey);
  const encoding = useLearnEncoding(source);
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
    title: source?.title ?? t('player.learn.title'), book, cardMap, rows, answered: answers.data?.total ?? 0,
    // A title not in the member's library: unknown, or its licence or their tier no longer has it.
    isMissing: library.isSuccess && source === undefined,
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

/** The hub, a drill, or the review, and the way between them. */
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
  return <Hub book={book} cards={current} rows={rows} answered={answered} onStart={drill} onReview={() => setView({ name: 'review' })} />;
}

/**
 * A licensed title (#133, #136; feature learn.drills): its hub, a drill of 10, 20 or 50 spots with each verdict and the
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
