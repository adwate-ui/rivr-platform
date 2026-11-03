import { useNativePhone } from './useNativePhone.ts';
import { usePhonePush } from './usePhonePush.ts';

/**
 * This phone's notifications, one switch for both: in the native app, the lock-screen live status (decision 0361); in a
 * browser, web push (#139). Each stays idle where it has no support.
 */
export function usePhone() {
  const web = usePhonePush();
  const native = useNativePhone();
  return native.state === 'unsupported' ? web : native;
}
