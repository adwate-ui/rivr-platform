import { useLearnProgressQueue } from '@rivr/db/learn';
import { isDue, type CardState, type Principle } from '@rivr/drills';
import { t } from '@rivr/i18n';
import { Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { asJson, dealSpot, markAnswer, type Book, type Marked, type PadAnswer, type Spot } from '../drill.ts';
import { SpotView } from './SpotView.tsx';
import { SummaryView } from './SummaryView.tsx';
import { VerdictView } from './VerdictView.tsx';

/** The principles in the order a drill takes them: those due first, then the rest. */
function orderOf(book: Book, cards: ReadonlyMap<string, CardState>, now: number): Principle[] {
  const isWaiting = (principle: Principle) => { const card = cards.get(principle.id); return card === undefined || isDue(card, now); };
  return [...book.principles.filter(isWaiting), ...book.principles.filter((principle) => !isWaiting(principle))];
}

/** The spot for the n-th answer: the next principle in order that deals one. */
function spotFor(book: Book, order: readonly Principle[], number: number, sessionId: string): Spot | null {
  for (let step = 0; step < order.length; step += 1) {
    const principle = order[(number + step) % order.length];
    const spot = principle === undefined ? null : dealSpot(book, principle, `${sessionId}:${String(number)}`);
    if (spot !== null) return spot;
  }
  return null;
}

interface SessionProps {
  book: Book;
  sourceKey: string;
  length: number;
  cards: ReadonlyMap<string, CardState>;
  onAgain: () => void;
  onReview: () => void;
  onHub: () => void;
}

/**
 * A drill (#133, #136): spots one after another, each answered on the pad, graded, explained and kept (the answer and
 * the principle's card, through the offline queue), then the summary with the points it earned.
 */
export function Session({ book, sourceKey, length, cards, onAgain, onReview, onHub }: SessionProps) {
  const queue = useLearnProgressQueue();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [order] = useState(() => orderOf(book, cards, Date.now()));
  const [held] = useState(() => new Map(cards));
  const [results, setResults] = useState<Marked[]>([]);
  const [spot, setSpot] = useState(() => spotFor(book, order, 0, sessionId));
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [answered, setAnswered] = useState<{ answer: PadAnswer; marked: Marked } | null>(null);
  if (spot === null) return <Text tone="muted">{t('player.learn.spot.noSpot')}</Text>;
  if (results.length === length && answered === null) {
    return <SummaryView book={book} sessionId={sessionId} sourceKey={sourceKey} results={results} onAgain={onAgain} onReview={onReview} onHub={onHub} />;
  }
  const answer = (given: PadAnswer) => {
    const now = Date.now();
    const id = crypto.randomUUID();
    const marked = markAnswer(book, spot, { answer: given, id, sessionId, latencyMs: now - shownAt, card: held.get(spot.principle.id), now });
    held.set(spot.principle.id, marked.card);
    void queue.enqueue({
      answers: [{ id, sessionId, sourceKey, principleId: spot.principle.id, answeredAt: new Date(now).toISOString(), attempt: asJson(marked.attempt) }],
      cards: [{ sourceKey, cardKey: marked.card.cardKey, state: asJson(marked.card), dueAt: new Date(marked.card.dueAt ?? now).toISOString() }],
    }, id);
    setResults([...results, marked]);
    setAnswered({ answer: given, marked });
  };
  const next = () => {
    setAnswered(null);
    if (results.length < length) { setSpot(spotFor(book, order, results.length, sessionId)); setShownAt(Date.now()); }
  };
  return (
    <Stack gap={4}>
      <Inline gap={4}>
        <Text weight="medium">{t('player.learn.spot.progress', { number: Math.min(results.length + (answered === null ? 1 : 0), length), total: length })}</Text>
        <Text tone="muted">{t('player.learn.spot.score', { correct: results.filter((result) => result.grade.correct).length })}</Text>
      </Inline>
      {answered === null ? <SpotView spot={spot} onAnswer={answer} />
        : <VerdictView spot={spot} answer={answered.answer} marked={answered.marked} bookTitle={book.payload.source.title} isLast={results.length === length} onNext={next} />}
    </Stack>
  );
}
