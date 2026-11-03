import { err, ok, type FnbItemKind, type Result } from '@rivr/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** An item as a menu file gives it (#799): its name, kind and whether it is on offer. No price: the menu keeps none. */
export interface FnbMenuFileItem {
  readonly name: string;
  readonly kind: FnbItemKind;
  /** Null when the file does not say: an item the menu has stays as it is, and a new one is on offer. */
  readonly isAvailable: boolean | null;
}

/** Why the menu from a file was not saved: the role, an item out of bounds or a name twice, the venue frozen, or anything else. */
export type FnbMenuFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, FnbMenuFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused' };

/**
 * Saves the menu from a file (#799; staff who run or serve F&B): every item at once, all or none, a name the menu has (in any
 * case) changed and a new one added. A Result with how many were saved, and the menu reloads.
 */
export function useSaveFnbMenu(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: readonly FnbMenuFileItem[]): Promise<Result<number, FnbMenuFailure>> => {
      const { data, error } = await client.rpc('save_fnb_menu', {
        p_venue_id: venueId, p_items: items.map((item) => ({ name: item.name.trim(), kind: item.kind, is_available: item.isAvailable })),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.fnbItems(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}
