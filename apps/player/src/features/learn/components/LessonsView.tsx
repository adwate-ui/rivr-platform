import { useLearnLessons, type LearnLesson } from '@rivr/db/learn';
import { t } from '@rivr/i18n';
import { Button, Heading, LoadState, Stack, Text } from '@rivr/ui';
import { useMemo } from 'react';
import type { Book } from '../drill.ts';
import { lessonsOf, type Lesson } from '../lessons.ts';

/** How a finished lesson went: its quiz's right answers, or done for a lesson with no quiz. */
const doneOf = (row: LearnLesson) =>
  (row.asked === 0 ? t('player.learn.lessons.doneNoQuiz') : t('player.learn.lessons.done', { correct: String(row.correct), asked: String(row.asked) }));

/** The lessons, each opening, with how it went where the member finished it; or that the book has none. */
function LessonList({ lessons, done, onOpen }: { lessons: readonly Lesson[]; done: readonly LearnLesson[]; onOpen: (lesson: Lesson) => void }) {
  if (lessons.length === 0) return <Text tone="muted">{t('player.learn.lessons.none')}</Text>;
  const byUnit = new Map(done.map((row) => [row.unitId, row]));
  return (
    <>
      {lessons.map((lesson) => {
        const row = byUnit.get(lesson.unitId);
        return (
          <Stack key={lesson.unitId} gap={1}>
            <Button variant="secondary" onClick={() => onOpen(lesson)}>{lesson.label}</Button>
            {row === undefined ? null : <Text variant="small" tone="muted">{doneOf(row)}</Text>}
          </Stack>
        );
      })}
    </>
  );
}

/** A book's lessons (#134; learn.academy_lessons): each unit, done or not, opening it; and the way back to the drills. */
export function LessonsView({ book, sourceKey, onOpen, onBack }: { book: Book; sourceKey: string; onOpen: (lesson: Lesson) => void; onBack: () => void }) {
  const done = useLearnLessons(sourceKey);
  const lessons = useMemo(() => lessonsOf(book), [book]);
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('player.learn.lessons.title')}</Heading>
      <Text tone="muted">{t('player.learn.lessons.hint')}</Text>
      {done.data === undefined
        ? <LoadState isError={done.isError} onRetry={() => void done.refetch()} />
        : <LessonList lessons={lessons} done={done.data} onOpen={onOpen} />}
      <Button variant="text" onClick={onBack}>{t('player.learn.lessons.toHub')}</Button>
    </Stack>
  );
}
