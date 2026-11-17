import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Why the Bonus card's line was not saved: not one who edits Content, the club frozen, or anything else. */
export type BonusLineFailure = 'not_allowed' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, BonusLineFailure>> = { '42501': 'not_allowed', RVFRZ: 'paused' };

/** The Bonus card's line as Content shows it to edit (#1065): null while the app's own is kept. For those who edit Content. */
export function useContentBonusLine(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.contentBonusLine(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await client.rpc('content_bonus_line', { p_venue_id: venueId });
      if (error) throw error;
      return data;
    },
  });
}

/** Content saves the Bonus card's line: trimmed by the server, blank to keep the app's own. Resolves to what is kept. */
export function useSaveContentBonusLine(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (line: string): Promise<Result<string | null, BonusLineFailure>> => {
      const { data, error } = await client.rpc('set_content_bonus_line', { p_venue_id: venueId, p_line: line });
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      await queryClient.invalidateQueries({ queryKey: queryKeys.contentBonusLine(userId ?? 'signed-out', venueId) });
      return ok(data);
    },
  });
}
