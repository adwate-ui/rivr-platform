import { z } from 'zod';

/** A partner or an investor to add to the shareholding register (#97). */
export const shareholderSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['partner', 'investor']),
});

/** A share as typed, in percent with up to two decimals ("12.5"), read as basis points (1250) without floating point. */
const percentSchema = z.string().trim().regex(/^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/).transform((text) => {
  const [whole = '0', fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
});

/** What a holder holds from a day on (#97): their share in percent, the day (`2026-06-01`) and a note. */
export const holdingSchema = z.object({
  shareholderId: z.string().uuid(),
  percent: percentSchema,
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(200),
});

/** A holding as the form gives it: the share in basis points. */
export type Holding = z.output<typeof holdingSchema>;
