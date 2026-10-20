import { z } from 'zod';

/** A certification quiz's questions as the database keeps them (#50): each prompt with its choices; never the answers. */
export const quizQuestionsSchema = z.array(
  z.object({ prompt: z.string().min(1), choices: z.array(z.string().min(1)).min(2) }),
).min(1);

/** One question of a quiz. */
export type QuizQuestion = z.infer<typeof quizQuestionsSchema>[number];

/** A quiz as staff answer it on the console: one choice, counted from 0, for every question; -1 is not yet answered. */
export const quizAnswersSchema = z.object({ answers: z.array(z.number().int().min(0)).min(1) });
