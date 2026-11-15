import { err, ok, type FnbDiet, type FnbItemKind, type Result } from '@rivr/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** An item as a menu file gives it (#799): its name, kind and whether it is on offer. No price: the menu keeps none. */
export interface FnbMenuFileItem {
  readonly name: string;
  readonly kind: FnbItemKind;
  /** Null when the file does not say: an item the menu has stays as it is, and a new one is on offer. */
  readonly isAvailable: boolean | null;
  /** Veg, egg or non-veg, and a line on what it is (F-052); null leaves an item the menu has as it is. */
  readonly diet: FnbDiet | null;
  readonly description: string | null;
}

/** Why the menu was not changed, from a file or an item at a time: the role, an item out of bounds or a name twice, the venue frozen, or anything else. */
export type FnbMenuFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, FnbMenuFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused' };

/**
 * Saves the menu from a file (#799; staff who run F&B, redesign RD-33): every item at once, all or none, a name the menu has (in any
 * case) changed and a new one added. A Result with how many were saved, and the menu reloads.
 */
export function useSaveFnbMenu(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: readonly FnbMenuFileItem[]): Promise<Result<number, FnbMenuFailure>> => {
      const { data, error } = await client.rpc('save_fnb_menu', {
        p_venue_id: venueId, p_items: items.map((item) => ({ name: item.name.trim(), kind: item.kind, is_available: item.isAvailable, diet: item.diet, description: item.description })),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.fnbItems(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}

/**
 * An item of the menu hidden or shown again, by anyone who serves food and drink, and an item deleted, by staff who run
 * it (redesign RD-33). Each is a Result, and the menu reloads. An order that had a deleted item keeps its own line.
 */
export function useFnbMenuItemActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, FnbMenuFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.fnbItems(userId ?? 'signed-out', venueId) });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const setItemAvailable = useMutation({
    mutationFn: async ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) =>
      settle((await client.rpc('set_fnb_item_available', { p_item_id: itemId, p_is_available: isAvailable })).error),
  });
  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => settle((await client.rpc('delete_fnb_item', { p_item_id: itemId })).error),
  });
  return { setItemAvailable, deleteItem };
}
