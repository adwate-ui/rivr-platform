import { usePushSubscriptionActions, useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button } from '@rivr/ui';
import { unsubscribeOnSignOut } from '../phonePush.ts';

/** The end of Profile, as the prototype has it: signing out on this phone. The frame then shows sign-in. */
export function SignOutSection() {
  const signOut = useSignOut();
  const { remove } = usePushSubscriptionActions();
  // The phone stops showing the member's notifications once they sign out of it (#139).
  async function signOutHere() {
    const endpoint = await unsubscribeOnSignOut().catch(() => null);
    if (endpoint !== null) await remove.mutateAsync(endpoint);
    signOut.mutate();
  }
  return (
    <Button variant="secondary" fullWidth isLoading={signOut.isPending || remove.isPending} onClick={() => void signOutHere()}>
      {t('common.signIn.signOut')}
    </Button>
  );
}
