import { z } from 'zod';

// Paise and counts as the database's jsonb gives them: whole JSON numbers.
const whole = z.number().int();
const rakeRow = z.object({ key: z.string(), label: z.string(), hands: whole, rake_paise: whole, drop_paise: whole });
const accountRow = z.object({ code: z.string(), name: z.string(), paise: whole });
const promotionRow = z.object({
  id: z.string(), name: z.string(), grants: whole, cost_paise: whole, cost_to_date_paise: whole, budget_paise: whole.nullable(),
  budget_grants: whole.nullable(),
});
const cohortMonthRow = z.object({ month: z.string(), returned: whole, percent: whole });
const cohortRow = z.object({ month: z.string(), members: whole, months: z.array(cohortMonthRow) });

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
  // #111: a month stored before has neither.
  promotions: z.array(promotionRow).default([]),
  cohorts: z.array(cohortRow).default([]),
});

export type MisReportJson = z.output<typeof misReportSchema>;
