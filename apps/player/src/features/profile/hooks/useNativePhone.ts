import { useLiveStatusDeviceActions, type LiveStatusDeviceToSave } from '@rivr/db';
import { liveStatusDeviceSchema, type LiveStatusDeviceInput } from '@rivr/contracts';
import type { Result } from '@rivr/contracts/result';
import { t } from '@rivr/i18n';
import { useEffect, useState } from 'react';
import { forgetPhone, LIVE_STATUS_PLUGIN, type LiveStatusPlugin } from '../nativePhone.ts';
import type { PhonePushState } from './usePhonePush.ts';

/** Where a change left the phone, and whether it did not take. */
interface Outcome {
  readonly state: PhonePushState;
  readonly failed: boolean;
}

/** A registered phone as the database takes it, or null when the plugin gave something else. */
export function deviceOf(registered: { platform: string; token: string }): LiveStatusDeviceInput | null {
  const parsed = liveStatusDeviceSchema.safeParse(registered);
  return parsed.success ? parsed.data : null;
}

type SaveDevice = (device: LiveStatusDeviceToSave) => Promise<Result<string, 'unavailable'>>;

async function isDenied(plugin: LiveStatusPlugin): Promise<boolean> {
  return (await plugin.checkPermissions()).notifications === 'denied';
}

/** Asks the member's leave and the phone's token, saves the phone with the key it kept, and keeps its new key. */
async function turnOn(plugin: LiveStatusPlugin, saveDevice: SaveDevice, keptKey: string | null): Promise<Outcome> {
  const registered = await plugin.register({ channelName: t('player.profile.liveStatusChannel') }).catch(() => null);
  if (registered === null) return (await isDenied(plugin)) ? { state: 'blocked', failed: false } : { state: 'off', failed: true };
  const device = deviceOf(registered);
  const saved = device === null ? null : await saveDevice({ ...device, deviceKey: keptKey });
  if (saved === null || !saved.ok) return { state: 'off', failed: true };
  await plugin.keepDeviceKey({ deviceKey: saved.value });
  return { state: 'on', failed: false };
}

/** Forgets the phone, then ends what its lock screen shows; off either way, as the phone no longer shows it. */
async function turnOff(plugin: LiveStatusPlugin, removeDevice: (token: string) => Promise<Result<null, 'unavailable'>>): Promise<Outcome> {
  const removed = await forgetPhone(removeDevice, plugin);
  return { state: 'off', failed: removed?.ok === false };
}

/** Where a phone stands when the app opens: on (saved again), off, or blocked in its settings. */
async function standing(plugin: LiveStatusPlugin, saveDevice: SaveDevice): Promise<PhonePushState> {
  if (await isDenied(plugin)) return 'blocked';
  const { deviceKey } = await plugin.current();
  // Saved again on opening: a new token is kept, and a phone now signed in by another member moves to them.
  return deviceKey === null ? 'off' : (await turnOn(plugin, saveDevice, deviceKey)).state;
}

/**
 * The lock-screen live status on this phone, in the native app (decision 0361), as usePhonePush is web push in a browser:
 * the same states, and turning it on or off. Unsupported in a browser. `failed` when the last change did not take.
 */
export function useNativePhone(plugin: LiveStatusPlugin | null = LIVE_STATUS_PLUGIN) {
  const [state, setState] = useState<PhonePushState>(plugin === null ? 'unsupported' : 'loading');
  const [isBusy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { save, remove } = useLiveStatusDeviceActions();
  const { mutateAsync: saveDevice } = save;
  const { mutateAsync: removeDevice } = remove;

  useEffect(() => {
    if (plugin === null) return;
    standing(plugin, saveDevice).then(setState, () => setState('off'));
  }, [plugin, saveDevice]);

  async function change(isOn: boolean) {
    if (plugin === null) return;
    setBusy(true);
    try {
      const outcome = isOn ? await turnOn(plugin, saveDevice, (await plugin.current()).deviceKey) : await turnOff(plugin, removeDevice);
      setState(outcome.state);
      setFailed(outcome.failed);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return { state, isBusy, failed, change };
}
