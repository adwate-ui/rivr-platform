import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The session reminders a member chooses from, in hours seated. */
export const SESSION_REMINDERS = [4, 6, 8] as const;
export type SessionReminder = (typeof SESSION_REMINDERS)[number];

/** The breaks a member takes from Profile, in days: 24 hours, 7 days and 30 days, as the prototype offers. */
export const BREAK_DAYS = [1, 7, 30] as const;
export type BreakDays = (typeof BREAK_DAYS)[number];

/** What restricts the signed-in member now (#56). */
export interface Restrictions {
  /** When the break running now ends, or null with none. */
  readonly breakUntil: string | null;
  /** Hours seated before the app reminds them, or null for none. */
  readonly sessionReminder: SessionReminder | null;
}

function reminderOf(hours: number | null): SessionReminder | null {
  return SESSION_REMINDERS.find((choice) => choice === hours) ?? null;
}

/** The signed-in member's break and session reminder. */
export function useRestrictions() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.restrictions(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<Restrictions> => {
      const { data, error } = await client.rpc('my_restrictions');
      if (error) throw error;
      const row = data[0];
      return { breakUntil: row?.break_until ?? null, sessionReminder: reminderOf(row?.session_reminder_hours ?? null) };
    },
  });
}

/**
 * The member's own changes: `setReminder` (null for none) and `takeBreak`, which resolves to when the
 * break ends. A break takes them off every waitlist, so both reload the restrictions and the places.
 */
export function useRestrictionActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.restrictions(userId ?? 'signed-out') }),
    queryClient.invalidateQueries({ queryKey: queryKeys.myWaitlist(userId ?? 'signed-out') }),
  ]);
  const setReminder = useMutation({
    mutationFn: async (hours: SessionReminder | null): Promise<Result<null, 'unavailable'>> => {
      const { error } = await client.rpc('set_session_reminder', hours === null ? {} : { p_hours: hours });
      await reload();
      return error ? err('unavailable') : ok(null);
    },
  });
  const takeBreak = useMutation({
    mutationFn: async (days: BreakDays): Promise<Result<string, 'unavailable'>> => {
      const { data, error } = await client.rpc('take_break', { p_days: days });
      await reload();
      return error ? err('unavailable') : ok(data);
    },
  });
  return { setReminder, takeBreak };
}
