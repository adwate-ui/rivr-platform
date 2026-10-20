import { err, ok, type Result } from '@rivr/contracts/result';
import type { StaffRole } from '@rivr/contracts/roles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toQuizQuestions, type QuizQuestion } from './parse/quizQuestions.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A certification quiz (#50): who it certifies, the share of answers a pass needs, and its questions. */
export interface Quiz {
  readonly quizId: string;
  readonly role: StaffRole;
  readonly title: string;
  readonly passPercent: number;
  readonly questions: readonly QuizQuestion[];
}

/** An attempt at a quiz, kept on the staff record of whoever took it. */
export interface QuizAttempt {
  readonly attemptId: string;
  readonly quizId: string;
  readonly quizTitle: string;
  readonly staffId: string;
  readonly staffName: string;
  readonly correctCount: number;
  readonly questionCount: number;
  readonly isPassed: boolean;
  readonly takenAt: string;
}

/** How the database marked an attempt. */
export interface QuizResult {
  readonly correctCount: number;
  readonly questionCount: number;
  readonly isPassed: boolean;
}

/** Why an attempt was not recorded: `paused` is the venue frozen, `invalid` a question without an answer. */
export type QuizFailure = 'not_allowed' | 'paused' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, QuizFailure>> = { '42501': 'not_allowed', RVFRZ: 'paused', '22023': 'invalid' };

/** The venue's certification quizzes, with their questions but never the answers; the practice venue has them. */
export function useQuizzes(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.quizzes(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Quiz[]> => {
      const { data, error } = await client.from('quiz').select('id, role, title, pass_percent, questions').eq('venue_id', venueId).order('role');
      if (error) throw error;
      return data.map((row) => {
        const questions = toQuizQuestions(row.questions);
        // A quiz not as expected fails the list rather than show half of it.
        if (questions === null) throw new Error(`Quiz ${row.id} has questions that cannot be read`);
        return { quizId: row.id, role: row.role, title: row.title, passPercent: row.pass_percent, questions };
      });
    },
  });
}

/**
 * Attempts at the venue's quizzes, latest first, the newest 500: one staff member's when `staffId` is
 * given, else all the signed-in person may see (their own, or everyone's with staff.manage).
 */
export function useQuizAttempts(venueId: string, staffId?: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: [...queryKeys.quizAttempts(userId ?? 'signed-out', venueId), staffId ?? 'all'],
    enabled: userId !== null,
    queryFn: async (): Promise<QuizAttempt[]> => {
      const query = client.from('quiz_attempt')
        .select('id, quiz_id, staff_id, correct_count, question_count, is_passed, created_at, staff (full_name), quiz (title)')
        .eq('venue_id', venueId);
      const { data, error } = await (staffId === undefined ? query : query.eq('staff_id', staffId))
        .order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return data.map((row) => ({
        attemptId: row.id, quizId: row.quiz_id, quizTitle: row.quiz.title, staffId: row.staff_id, staffName: row.staff.full_name,
        correctCount: row.correct_count, questionCount: row.question_count, isPassed: row.is_passed, takenAt: row.created_at,
      }));
    },
  });
}

/** Hands in the signed-in staff member's answers, one choice per question; the database marks them and keeps the attempt. */
export function useSubmitQuiz(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quizId, answers }: { quizId: string; answers: readonly number[] }): Promise<Result<QuizResult, QuizFailure>> => {
      const { data, error } = await client.rpc('submit_quiz', { p_quiz_id: quizId, p_answers: [...answers] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.quizAttempts(userId ?? 'signed-out', venueId) });
      const marked = data?.[0];
      if (error || !marked) return err(error ? (FAILURE_BY_CODE[error.code] ?? 'unavailable') : 'unavailable');
      return ok({ correctCount: marked.correct_count, questionCount: marked.question_count, isPassed: marked.is_passed });
    },
  });
}
