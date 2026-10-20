import { useQuizAttempts, useQuizzes, useStaffVenue, type Quiz, type QuizAttempt } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { AttemptTable } from './AttemptTable.tsx';
import { QuizForm } from './QuizForm.tsx';
import { standingText } from './quizCopy.ts';

/** One quiz in the list: what it asks for a pass, where the staff member stands, and Start. */
function QuizRow({ quiz, mine, onStart }: { quiz: Quiz; mine: readonly QuizAttempt[]; onStart: () => void }) {
  return (
    <Stack gap={2}>
      <Text weight="semibold">{quiz.title}</Text>
      <Text variant="small" tone="muted">{t('console.certification.about', { count: quiz.questions.length, percent: quiz.passPercent })}</Text>
      <Text variant="small">{standingText(quiz, mine)}</Text>
      <Inline>
        <Button variant="secondary" onClick={onStart}>{t('console.certification.start', { title: quiz.title })}</Button>
      </Inline>
    </Stack>
  );
}

interface CertificationProps {
  venueId: string;
  staffId: string;
  /** Staff who manage staff see every attempt at the venue. */
  canSeeEveryone: boolean;
}

function Certification({ venueId, staffId, canSeeEveryone }: CertificationProps) {
  const quizzes = useQuizzes(venueId);
  const mine = useQuizAttempts(venueId, staffId);
  const [takingId, setTakingId] = useState<string | null>(null);
  const title = t('console.certification.title');
  if (quizzes.isPending || mine.isPending) return <Screen title={title} status="loading" />;
  if (quizzes.data === undefined || mine.data === undefined) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([quizzes.refetch(), mine.refetch()])} />;
  }
  if (quizzes.data.length === 0) return <Screen title={title} status="empty" emptyText={t('console.certification.empty')} />;
  const taking = quizzes.data.find((quiz) => quiz.quizId === takingId);
  if (taking !== undefined) return <QuizForm key={taking.quizId} venueId={venueId} quiz={taking} onDone={() => setTakingId(null)} />;
  const attempts = mine.data;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Stack gap={6} divided>
          {quizzes.data.map((quiz) => <QuizRow key={quiz.quizId} quiz={quiz} mine={attempts} onStart={() => setTakingId(quiz.quizId)} />)}
        </Stack>
        {canSeeEveryone ? <AttemptTable venueId={venueId} /> : null}
      </Stack>
    </Screen>
  );
}

/**
 * Certification (#50; tech plan item 18): the dealer and cashier quizzes, which run in the practice
 * venue. Any staff member takes them; a pass is kept on their staff record, and staff who manage staff
 * see every attempt. At the club the screen says to switch to the practice venue.
 */
export function CertificationScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { venueId, staffId, permissions } = staff.venue;
  return <Certification key={venueId} venueId={venueId} staffId={staffId} canSeeEveryone={permissions.includes('staff.manage')} />;
}
