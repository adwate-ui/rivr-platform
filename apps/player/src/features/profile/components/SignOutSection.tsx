import { useLiveStatusDeviceActions, usePushSubscriptionActions, useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button } from '@rivr/ui';
import { forgetPhone } from '../nativePhone.ts';
import { unsubscribeOnSignOut } from '../phonePush.ts';

/** The end of Profile, as the prototype has it: signing out on this phone. The frame then shows sign-in. */
export function SignOutSection() {
  const signOut = useSignOut();
  const { remove } = usePushSubscriptionActions();
  const { remove: removeDevice } = useLiveStatusDeviceActions();
  // The phone stops showing the member's notifications (#139) and lock-screen status (decision 0361) once they sign out of it.
  async function signOutHere() {
    const endpoint = await unsubscribeOnSignOut().catch(() => null);
    if (endpoint !== null) await remove.mutateAsync(endpoint);
    await forgetPhone((token) => removeDevice.mutateAsync(token)).catch(() => null);
    signOut.mutate();
  }
  return (
    <Button variant="outline" size="large" fullWidth isLoading={signOut.isPending || remove.isPending || removeDevice.isPending}
      onClick={() => void signOutHere()}>
      {t('common.signIn.signOut')}
    </Button>
  );
}
