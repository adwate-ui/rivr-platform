import { z } from 'zod';
import { clockTimeSchema } from './staff.ts';
import { istMoment } from './tournaments.ts';

const day = z.union([z.literal(''), z.iso.date()]);
// Blank, or a time on India's 24-hour clock, as an incident's time is (incidents.ts); spaces alone are blank.
const time = z.string().trim().pipe(z.union([z.literal(''), clockTimeSchema]));

/**
 * An IST day and 24-hour time as the moment they name, or null when blank or not a real day and time: zod runs the checks
 * across fields even when a field's own check has failed, and that field says why.
 */
function momentOf(on: string, at: string): string | null {
  const moment = istMoment(on, at.trim());
  return on === '' || Number.isNaN(moment.getTime()) ? null : moment.toISOString();
}

/**
 * A notice as the console puts one up or edits it (decision 0424): its words, and when it shows, a start and an end, each an
 * IST day and 24-hour time, both blank for now and for until ended. A day without its time (`needs_time`), a time without
 * its day (`needs_day`) or a time not as 19:00 is that field's error, and so is an end not after the start
 * (`before_start`). Out come the words and the moments, null where blank; the database checks them all again.
 */
export const noticeFormSchema = z
  .object({ body: z.string(), startDay: day, startTime: time, endDay: day, endTime: time })
  .superRefine((form, context) => {
    for (const [onField, atField] of [['startDay', 'startTime'], ['endDay', 'endTime']] as const) {
      if (form[onField] !== '' && form[atField] === '') context.addIssue({ code: 'custom', path: [atField], message: 'needs_time' });
      if (form[onField] === '' && form[atField] !== '') context.addIssue({ code: 'custom', path: [onField], message: 'needs_day' });
    }
    const [startsAt, endsAt] = [momentOf(form.startDay, form.startTime), momentOf(form.endDay, form.endTime)];
    if (startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) {
      context.addIssue({ code: 'custom', path: ['endTime'], message: 'before_start' });
    }
  })
  .transform((form) => ({ body: form.body, startsAt: momentOf(form.startDay, form.startTime), endsAt: momentOf(form.endDay, form.endTime) }));

export type NoticeFormValues = z.input<typeof noticeFormSchema>;
