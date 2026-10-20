import { zodResolver } from '@hookform/resolvers/zod';
import { quizAnswersSchema } from '@rivr/contracts';
import { useSubmitQuiz, type Quiz, type QuizFailure, type QuizResult } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { quizFailureText, resultText } from './quizCopy.ts';

interface QuizFormProps {
  venueId: string;
  quiz: Quiz;
  /** Back to the list of quizzes. */
  onDone: () => void;
}

/** The mark for an attempt just handed in, with a way to try again after a fail. */
function QuizMark({ quiz, result, onRetry, onDone }: { quiz: Quiz; result: QuizResult; onRetry: () => void; onDone: () => void }) {
  return (
    <Screen title={quiz.title}>
      <Stack gap={4}>
        <Text weight="medium">{resultText(result, quiz.passPercent)}</Text>
        <Inline gap={3}>
          {result.isPassed ? null : <Button variant="primary" onClick={onRetry}>{t('console.certification.tryAgain')}</Button>}
          <Button variant="secondary" onClick={onDone}>{t('console.certification.back')}</Button>
        </Inline>
      </Stack>
    </Screen>
  );
}

/**
 * One certification quiz (#50): each question with its choices as chips, one answer each. The
 * database marks the answers and keeps the attempt on the staff member's record; the screen shows the mark.
 */
export function QuizForm({ venueId, quiz, onDone }: QuizFormProps) {
  const submit = useSubmitQuiz(venueId);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [failure, setFailure] = useState<QuizFailure | null>(null);
  const [resolver] = useState(() => zodResolver(quizAnswersSchema));
  const unanswered = quiz.questions.map(() => -1);
  const form = useForm<z.input<typeof quizAnswersSchema>, unknown, z.output<typeof quizAnswersSchema>>({ resolver, defaultValues: { answers: unanswered } });
  const handIn = form.handleSubmit(async ({ answers }) => {
    const marked = await submit.mutateAsync({ quizId: quiz.quizId, answers });
    setFailure(marked.ok ? null : marked.error);
    setResult(marked.ok ? marked.value : null);
  });
  const retry = () => {
    form.reset({ answers: unanswered });
    setResult(null);
  };
  if (result !== null) return <QuizMark quiz={quiz} result={result} onRetry={retry} onDone={onDone} />;
  return (
    <Screen title={quiz.title} actions={<Button variant="text" onClick={onDone}>{t('console.certification.back')}</Button>}>
      <Stack gap={6}>
        {quiz.questions.map((question, index) => (
          <Controller key={question.prompt} control={form.control} name={`answers.${index}`} render={({ field }) => (
            <ChoiceChips label={t('console.certification.question', { number: index + 1, prompt: question.prompt })} mode="one"
              selected={field.value >= 0 ? [String(field.value)] : []} onChange={(chosen) => field.onChange(chosen.length === 0 ? -1 : Number(chosen[0]))}
              options={question.choices.map((choice, at) => ({ value: String(at), label: choice }))} isDisabled={submit.isPending} />
          )} />
        ))}
        {form.formState.errors.answers ? <ErrorMessage>{t('console.certification.unanswered')}</ErrorMessage> : null}
        {failure === null ? null : <ErrorMessage>{quizFailureText(failure)}</ErrorMessage>}
        <Inline>
          <Button variant="primary" isLoading={submit.isPending} onClick={() => void handIn()}>{t('console.certification.submit')}</Button>
        </Inline>
      </Stack>
    </Screen>
  );
}
