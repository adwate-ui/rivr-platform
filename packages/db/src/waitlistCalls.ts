import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { failureOf, type WaitlistFailure } from './waitlist.ts';

/**
 * The floor's call-down (#63, waitlist.manage): `call` a waiting member to a table and seat, which
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
  const call = useMutation({
    mutationFn: async ({ entryId, tableId, seat }: { entryId: string; tableId: string; seat: number }) => {
      const { error } = await client.rpc('call_from_waitlist', { p_entry_id: entryId, p_table_id: tableId, p_seat: seat });
      return settle(error);
    },
  });
  const seat = useMutation({
    mutationFn: async (entryId: string) => settle((await client.rpc('seat_from_waitlist', { p_entry_id: entryId })).error),
  });
  const away = useMutation({
    mutationFn: async ({ entryId, isAway }: { entryId: string; isAway: boolean }) =>
      settle((await client.rpc('step_away', { p_entry_id: entryId, p_is_away: isAway })).error),
  });
  return { call, seat, away };
}
