import { effectiveRule } from '@rivr/drills';
import { t } from '@rivr/i18n';
import { Button, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import type { Book } from '../drill.ts';
import { markQuiz, type QuizAnswer, type QuizMark, type QuizSpot } from '../lessons.ts';
import { SpotTable } from './SpotView.tsx';

/** The question the rule asks, and for a count the range it counts: its name, then its hands. */
function questionOf(book: Book, spot: QuizSpot): { prompt: string; range: string | null } {
  const { rule } = effectiveRule(spot.principle);
  if (rule.kind === 'classify') return { prompt: rule.prompt, range: null };
  if (rule.kind !== 'count') return { prompt: '', range: null };
  const set = book.payload.range_sets.find((each) => each.id === rule.range_set_id);
  return { prompt: rule.prompt, range: set === undefined ? null : t('player.learn.lessons.range', { name: set.label ?? set.id, hands: set.hands.join(', ') }) };
}

/** The pad: the rule's labels, or a number to check. */
function QuizPad({ spot, onAnswer }: { spot: QuizSpot; onAnswer: (answer: QuizAnswer) => void }) {
  const [value, setValue] = useState('');
  const { rule } = effectiveRule(spot.principle);
  if (rule.kind === 'classify') {
    return (
      <Inline gap={2} wrap>
        {rule.labels.map((label) => (
          <Button key={label.id} variant="secondary" onClick={() => onAnswer({ kind: 'classify', label: label.id })}>{label.label}</Button>
        ))}
      </Inline>
    );
  }
  const count = /^\d{1,4}$/.test(value.trim()) ? Number(value.trim()) : null;
  return (
    <Stack gap={2}>
      <Input type="tel" label={t('player.learn.lessons.count')} value={value} maxLength={4} onChange={(event) => setValue(event.target.value)} />
      <Button variant="primary" isDisabled={count === null} onClick={() => { if (count !== null) onAnswer({ kind: 'count', value: count }); }}>
        {t('player.learn.lessons.check')}
      </Button>
    </Stack>
  );
}

/** Whether the answer was right, the right answer when not, why, and the way on. */
function Verdict({ mark, isLast, onNext }: { mark: QuizMark; isLast: boolean; onNext: () => void }) {
  return (
    <Stack gap={2}>
      <Text weight="semibold">{mark.correct ? t('player.learn.lessons.right') : t('player.learn.lessons.wrong', { answer: mark.answer })}</Text>
      <Text>{mark.explanation.text}</Text>
      <Button variant="primary" onClick={onNext}>{t(isLast ? 'player.learn.lessons.finishQuiz' : 'player.learn.lessons.nextQuestion')}</Button>
    </Stack>
  );
}

/** A lesson's quiz (#134): each question on the felt, its pad, the verdict and why; then how many were right. */
export function QuizView({ book, spots, onDone }: { book: Book; spots: readonly QuizSpot[]; onDone: (correct: number) => void }) {
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<readonly QuizMark[]>([]);
  const spot = spots[index];
  if (spot === undefined) return null;
  const mark = marks[index];
  const isLast = index === spots.length - 1;
  const { prompt, range } = questionOf(book, spot);
  const next = () => (isLast ? onDone(marks.filter((each) => each.correct).length) : setIndex(index + 1));
  return (
    <Stack gap={4}>
      <Heading level={3}>{t('player.learn.lessons.question', { current: String(index + 1), count: String(spots.length) })}</Heading>
      <SpotTable scenario={spot.scenario} />
      <Text>{prompt}</Text>
      {range === null ? null : <Text variant="small" tone="muted">{range}</Text>}
      {mark === undefined
        ? <QuizPad key={index} spot={spot} onAnswer={(answer) => setMarks([...marks, markQuiz(spot, answer)])} />
        : <Verdict mark={mark} isLast={isLast} onNext={next} />}
    </Stack>
  );
}
