import type { LiveStatusDeviceInput } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

/** A phone to save, with the key it kept from its last save (null for a phone saved for the first time). */
export type LiveStatusDeviceToSave = LiveStatusDeviceInput & { readonly deviceKey: string | null };

/**
 * The member's phone for the lock-screen live status in the native app (decision 0361): `save` keeps it and resolves to the
 * new key the phone keeps (the same phone signed in by another member moves to them with its last key), `remove` forgets
 * it by its token. Each resolves to a Result.
 */
export function useLiveStatusDeviceActions() {
  const { client } = useRivrData();
  const save = useMutation({
    mutationFn: async (device: LiveStatusDeviceToSave): Promise<Result<string, 'unavailable'>> => {
      const { platform, token, deviceKey } = device;
      const alertToken = device.platform === 'ios' ? device.alertToken : null;
      const { data, error } = await client.rpc('save_live_status_device', {
        p_platform: platform, p_token: token, ...(deviceKey === null ? {} : { p_device_key: deviceKey }), ...(alertToken ? { p_alert_token: alertToken } : {}),
      });
      return error || typeof data !== 'string' ? err('unavailable') : ok(data);
    },
  });
  const remove = useMutation({
    mutationFn: async (token: string): Promise<Result<null, 'unavailable'>> => {
      const { error } = await client.rpc('remove_live_status_device', { p_token: token });
      return error ? err('unavailable') : ok(null);
    },
  });
  return { save, remove };
}
