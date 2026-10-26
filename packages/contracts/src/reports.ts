import { z } from 'zod';

// Paise and counts as the database's jsonb gives them: whole JSON numbers.
const whole = z.number().int();
const rakeRow = z.object({ key: z.string(), label: z.string(), hands: whole, rake_paise: whole, drop_paise: whole });
const accountRow = z.object({ code: z.string(), name: z.string(), paise: whole });

/** A club month's investor MIS as private.mis_for keeps it (#99, decision 0188). */
export const misReportSchema = z.object({
  month: z.string(),
  hands: whole,
  rake_paise: whole,
  drop_paise: whole,
  rake_by_table: z.array(rakeRow),
  rake_by_dealer: z.array(rakeRow),
  rake_by_variant: z.array(rakeRow),
  revenue: z.array(accountRow),
  expenses: z.array(accountRow),
  revenue_paise: whole,
  expense_paise: whole,
  net_paise: whole,
  visits: whole,
  members: whole,
});

export type MisReportJson = z.output<typeof misReportSchema>;
