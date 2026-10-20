import { z } from 'zod';

/** A quiz as staff answer it on the console (#50): one choice, counted from 0, for every question; -1 is not yet answered. */
export const quizAnswersSchema = z.object({ answers: z.array(z.number().int().min(0)).min(1) });
