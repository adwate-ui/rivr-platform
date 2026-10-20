import type { Quiz, QuizAttempt, QuizFailure, QuizResult } from '@rivr/db';
import { formatDate, t, type MessageKey } from '@rivr/i18n';

const FAILURE_COPY: Readonly<Record<QuizFailure, MessageKey>> = {
  not_allowed: 'console.certification.notAllowed',
  paused: 'console.certification.paused',
  invalid: 'console.certification.invalid',
  unavailable: 'console.certification.unavailable',
};

/** Where the signed-in staff member stands on a quiz: their latest pass, else their latest try, else not taken. `mine` is latest first. */
export function standingText(quiz: Quiz, mine: readonly QuizAttempt[]): string {
  const attempts = mine.filter((attempt) => attempt.quizId === quiz.quizId);
  const shown = attempts.find((attempt) => attempt.isPassed) ?? attempts[0];
  if (shown === undefined) return t('console.certification.notTaken');
  const params = { date: formatDate(new Date(shown.takenAt)), correct: shown.correctCount, count: shown.questionCount };
  return t(shown.isPassed ? 'console.certification.passed' : 'console.certification.notPassed', params);
}

/** How the database marked the attempt just handed in. */
export function resultText(result: QuizResult, passPercent: number): string {
  const params = { correct: result.correctCount, count: result.questionCount, percent: passPercent };
  return t(result.isPassed ? 'console.certification.resultPassed' : 'console.certification.resultNotPassed', params);
}

/** Why an attempt was not recorded. */
export function quizFailureText(failure: QuizFailure): string {
  return t(FAILURE_COPY[failure]);
}
