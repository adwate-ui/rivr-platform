import { useCompleteLearnLesson } from '@rivr/db/learn';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import type { Book } from '../drill.ts';
import { dealQuiz, type Lesson } from '../lessons.ts';
import { QuizView } from './QuizView.tsx';

/** Where the member is in a lesson: a card, the quiz, or done with so many right. */
type Step = { readonly name: 'card'; readonly index: number } | { readonly name: 'quiz' } | { readonly name: 'done'; readonly correct: number };

interface CardStepProps {
  lesson: Lesson;
  index: number;
  hasQuiz: boolean;
  onNext: () => void;
  onQuiz: () => void;
  onFinish: () => void;
}

/** The way on from a card: the next card, the quiz, or the end of a lesson with no quiz. */
function WayOn({ isLast, hasQuiz, onNext, onQuiz, onFinish }: Omit<CardStepProps, 'lesson' | 'index'> & { isLast: boolean }) {
  if (!isLast) return <Button variant="primary" onClick={onNext}>{t('player.learn.lessons.nextCard')}</Button>;
  if (hasQuiz) return <Button variant="primary" onClick={onQuiz}>{t('player.learn.lessons.startQuiz')}</Button>;
  return <Button variant="primary" onClick={onFinish}>{t('player.learn.lessons.finish')}</Button>;
}

/** One card: the principle's name and the author's reasoning. */
function CardStep({ lesson, index, ...wayOn }: CardStepProps) {
  const card = lesson.cards[index];
  if (card === undefined) return null;
  return (
    <Stack gap={3}>
      <Text variant="small" tone="muted">{t('player.learn.lessons.card', { current: String(index + 1), count: String(lesson.cards.length) })}</Text>
      <Heading level={3}>{card.name}</Heading>
      <Text>{card.rationale}</Text>
      <WayOn isLast={index === lesson.cards.length - 1} {...wayOn} />
    </Stack>
  );
}

/**
 * A lesson (#134; learn.academy_lessons): its cards one at a time, then its quiz where it has one, then how it went,
 * kept for the member.
 */
export function LessonView({ book, sourceKey, lesson, onBack }: { book: Book; sourceKey: string; lesson: Lesson; onBack: () => void }) {
  const [step, setStep] = useState<Step>({ name: 'card', index: 0 });
  const [spots] = useState(() => dealQuiz(book, lesson, `${lesson.unitId}:${String(Date.now())}`));
  const complete = useCompleteLearnLesson(sourceKey);
  const finish = (correct: number) => {
    setStep({ name: 'done', correct });
    complete.mutate({ unitId: lesson.unitId, correct, asked: spots.length });
  };
  return (
    <Stack gap={4}>
      <Heading level={2}>{lesson.label}</Heading>
      {step.name === 'card' ? <CardStep lesson={lesson} index={step.index} hasQuiz={spots.length > 0}
        onNext={() => setStep({ name: 'card', index: step.index + 1 })} onQuiz={() => setStep({ name: 'quiz' })} onFinish={() => finish(0)} /> : null}
      {step.name === 'quiz' ? <QuizView book={book} spots={spots} onDone={finish} /> : null}
      {step.name === 'done' ? (
        <Stack gap={3}>
          <Heading level={3}>{t('player.learn.lessons.doneTitle')}</Heading>
          {spots.length === 0 ? null : <Text>{t('player.learn.lessons.summary', { correct: String(step.correct), asked: String(spots.length) })}</Text>}
          {complete.data?.ok === false ? <ErrorMessage>{t('player.learn.lessons.saveFailed')}</ErrorMessage> : null}
          <Button variant="secondary" onClick={onBack}>{t('player.learn.lessons.back')}</Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
