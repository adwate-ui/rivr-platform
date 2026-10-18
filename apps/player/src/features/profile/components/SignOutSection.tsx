import { useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button } from '@rivr/ui';

/** The end of Profile, as the prototype has it: signing out on this phone. The frame then shows sign-in. */
export function SignOutSection() {
  const signOut = useSignOut();
  return (
    <Button variant="secondary" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
      {t('common.signIn.signOut')}
    </Button>
  );
}
