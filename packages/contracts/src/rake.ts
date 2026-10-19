import { z } from 'zod';
import { CHIP_PAISE } from './settings.ts';

/** The highest cap rake.config takes, in paise: ₹1,00,000. */
const MOST_CAP_PAISE = 10_000_000;

/**
 * A rake change as the console schedules it (#37): the table type, the rate in percent (up to two
 * decimals, at most 10%), the cap in whole rupees (whole ₹50 chips), the IST date and 24-hour time
 * it takes effect from, and why. Out come the rake.config values and the time with India's offset;
 * the database checks the value again, and that the time is not past.
 */
export const rakeChangeSchema = z
  .object({
    tableTypeCode: z.string().min(1),
    ratePercent: z.string().trim().regex(/^\d{1,2}(\.\d{1,2})?$/).refine((percent) => Number(percent) <= 10),
    cap: z.string().trim().regex(/^\d{1,6}$/).refine((rupees) => {
      const paise = Number(rupees) * 100;
      return paise % CHIP_PAISE === 0 && paise <= MOST_CAP_PAISE;
    }),
    on: z.iso.date(),
    at: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    reason: z.string().trim().min(1).max(200),
  })
  .transform(({ tableTypeCode, ratePercent, cap, on, at, reason }) => ({
    tableTypeCode,
    rateBasisPoints: Math.round(Number(ratePercent) * 100),
    capPaise: Number(cap) * 100,
    effectiveFrom: `${on}T${at}:00+05:30`,
    reason,
  }));
