import { describe, expect, it } from 'vitest';
import { noticeFormSchema } from './notices.ts';

const BLANK = { body: 'Quiz night.', startDay: '', startTime: '', endDay: '', endTime: '' };

describe('noticeFormSchema (decision 0424)', () => {
  it('reads blank times as now and until ended', () => {
    expect(noticeFormSchema.parse(BLANK)).toEqual({ body: 'Quiz night.', startsAt: null, endsAt: null });
  });

  it('reads an IST day and 24-hour time as the moment they name', () => {
    expect(noticeFormSchema.parse({ ...BLANK, startDay: '2026-11-14', startTime: '19:00', endDay: '2026-11-15', endTime: ' 02:00 ' })).toEqual({
      body: 'Quiz night.', startsAt: '2026-11-14T13:30:00.000Z', endsAt: '2026-11-14T20:30:00.000Z',
    });
  });

  it('wants a day and its time together, a time as 19:00, and an end after the start, each on its own field', () => {
    const issues = (form: Partial<typeof BLANK>) =>
      noticeFormSchema.safeParse({ ...BLANK, ...form }).error?.issues.map((issue) => `${String(issue.path[0])}:${issue.message}`) ?? [];
    expect(issues({ endDay: '2026-11-15' })).toEqual(['endTime:needs_time']);
    expect(issues({ startTime: '19:00' })).toEqual(['startDay:needs_day']);
    expect(issues({ startDay: '2026-11-14', startTime: '7pm' }).map((issue) => issue.split(':')[0])).toEqual(['startTime']);
    expect(issues({ startDay: '2026-11-14', startTime: '24:00' }).map((issue) => issue.split(':')[0])).toEqual(['startTime']);
    expect(issues({ startDay: '2026-11-14', startTime: '19:00', endDay: '2026-11-14', endTime: '19:00' })).toEqual(['endTime:before_start']);
  });

  it('reads a time of spaces alone as blank', () => {
    expect(noticeFormSchema.parse({ ...BLANK, endTime: '   ' })).toEqual({ body: 'Quiz night.', startsAt: null, endsAt: null });
  });

  it('says a time is wrong, and does not fail itself, when every field is filled in and one time is not as 19:00', () => {
    const result = noticeFormSchema.safeParse({ ...BLANK, startDay: '2026-11-02', startTime: '15:30', endDay: '2026-11-15', endTime: '7pm' });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['endTime']);
  });
});
