import type { PushSubscriptionInput } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

/**
 * The member's phone for push notifications (#139): `save` keeps its subscription (moving it to them if the browser was
 * another member's), `remove` forgets it by its push address. Each resolves to a Result.
 */
export function usePushSubscriptionActions() {
  const { client } = useRivrData();
  const settle = ({ error }: { error: unknown }): Result<null, 'unavailable'> => (error ? err('unavailable') : ok(null));
  const save = useMutation({
    mutationFn: async ({ endpoint, keys }: PushSubscriptionInput) =>
      settle(await client.rpc('save_push_subscription', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth })),
  });
  const remove = useMutation({
    mutationFn: async (endpoint: string) => settle(await client.rpc('remove_push_subscription', { p_endpoint: endpoint })),
  });
  return { save, remove };
}
