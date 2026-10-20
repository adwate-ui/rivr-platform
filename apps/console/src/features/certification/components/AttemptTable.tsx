import { useQuizAttempts, type QuizAttempt } from '@rivr/db';
import { formatDate, formatTime, t } from '@rivr/i18n';
import { DataTable, Heading, Stack, Text, type DataTableColumn } from '@rivr/ui';

function columns(): readonly DataTableColumn<QuizAttempt>[] {
  return [
    { key: 'name', header: t('console.certification.name'), cell: (attempt) => attempt.staffName, sortValue: (attempt) => attempt.staffName },
    { key: 'quiz', header: t('console.certification.quiz'), cell: (attempt) => attempt.quizTitle, sortValue: (attempt) => attempt.quizTitle },
    {
      key: 'score', header: t('console.certification.score'), align: 'end', sortValue: (attempt) => attempt.correctCount / attempt.questionCount,
      cell: (attempt) => t('console.certification.scoreValue', { correct: attempt.correctCount, count: attempt.questionCount }),
    },
    {
      key: 'result', header: t('console.certification.result'),
      cell: (attempt) => (
        <Text weight={attempt.isPassed ? 'semibold' : 'regular'}>{t(attempt.isPassed ? 'console.certification.pass' : 'console.certification.fail')}</Text>
      ),
    },
    {
      key: 'when', header: t('console.certification.when'), sortValue: (attempt) => attempt.takenAt,
      cell: (attempt) => `${formatDate(new Date(attempt.takenAt))}, ${formatTime(new Date(attempt.takenAt))}`,
    },
  ];
}

/** The attempts as a table, or its loading or error state. */
function AttemptRows({ venueId }: { venueId: string }) {
  const attempts = useQuizAttempts(venueId);
  const base = { label: t('console.certification.attempts'), columns: columns(), rowKey: (attempt: QuizAttempt) => attempt.attemptId };
  if (attempts.data === undefined && attempts.isError) return <DataTable {...base} status="error" onRetry={() => void attempts.refetch()} />;
  if (attempts.data === undefined) return <DataTable {...base} status="loading" />;
  return (
    <DataTable {...base} rows={attempts.data} emptyText={t('console.certification.noAttempts')}
      filter={{ label: t('console.certification.filter'), text: (attempt) => attempt.staffName }} />
  );
}

/** Every attempt at the venue's quizzes, on each staff record, for staff who manage staff: latest first. */
export function AttemptTable({ venueId }: { venueId: string }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.certification.attempts')}</Heading>
      <AttemptRows venueId={venueId} />
    </Stack>
  );
}
