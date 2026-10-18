import { useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button } from '@rivr/ui';

/** Signs out on this computer. Offered whatever the frame shows, so nobody is ever stuck signed in. */
export function SignOutButton({ variant = 'secondary', fullWidth = false }: { variant?: 'primary' | 'secondary'; fullWidth?: boolean }) {
  const signOut = useSignOut();
  return (
    <Button variant={variant} fullWidth={fullWidth} isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
      {t('common.signIn.signOut')}
    </Button>
  );
}
