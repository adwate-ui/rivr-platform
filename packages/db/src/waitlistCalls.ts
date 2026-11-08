import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { bonusArg } from './seats.ts';
import { failureOf, type WaitlistFailure } from './waitlist.ts';

/**
 * The floor's call-down (#63, waitlist.manage): `call` a waiting member to the first free seat, which
 * holds it and sends the seat call; `seat` a called member there, which takes the place off every
 * list; `away` steps a place away (Skip) or back. Each resolves to a Result and reloads the lists.
 */
export function useWaitlistCallActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
  const settle = async (error: { code: string } | null): Promise<Result<null, WaitlistFailure>> => {
    await reload();
    return error ? err(failureOf(error)) : ok(null);
  };
  const seat = useMutation({
    mutationFn: async (entryId: string) => settle((await client.rpc('seat_from_waitlist', { p_entry_id: entryId })).error),
  });
  // Assign (decision 0299): the call and the seating in one step, with the call time the floor chose, and any bonus chips the
  // member redeems with their buy-in (decision 0504).
  const assign = useMutation({
    mutationFn: async ({ entryId, tableId, seat: number, callMinutes, bonusChips }:
                       { entryId: string; tableId: string; seat: number; callMinutes: number; bonusChips?: number }) =>
      settle((await client.rpc('assign_from_waitlist', {
        p_entry_id: entryId, p_table_id: tableId, p_seat: number, p_call_minutes: callMinutes, ...bonusArg(bonusChips),
      })).error),
  });
  // Call (the owner, 8 Nov): the first free seat at the list's table held for the member, who is told by WhatsApp and push.
  const call = useMutation({
    mutationFn: async (entryId: string) => settle((await client.rpc('call_to_seat', { p_entry_id: entryId })).error),
  });
  const away = useMutation({
    mutationFn: async ({ entryId, isAway }: { entryId: string; isAway: boolean }) =>
      settle((await client.rpc('step_away', { p_entry_id: entryId, p_is_away: isAway })).error),
  });
  return { seat, assign, call, away };
}
