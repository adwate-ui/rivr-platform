import { err, ok, type Result } from '@rivr/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Why a member's cancel did not go through: the bar accepted the order first, or anything else. */
export type CancelMyOrderFailure = 'accepted' | 'unavailable';

/** A member cancels their own order before the bar accepts it (F-048): a Result, and their orders are read again. */
export function useCancelMyFnbOrder() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string): Promise<Result<null, CancelMyOrderFailure>> => {
      const { error } = await client.rpc('cancel_my_fnb_order', { p_order_id: orderId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myFnbOrders(userId ?? 'signed-out') });
      if (error === null) return ok(null);
      return err(error.code === '22023' ? 'accepted' : 'unavailable');
    },
  });
}
