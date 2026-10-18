import { useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** The end of Profile, as the prototype has it: signing out on this phone, back to sign-in. */
export function SignOutSection() {
  const signOut = useSignOut();
  const navigate = useNavigate();
  const leave = async () => {
    await signOut.mutateAsync();
    await navigate({ to: '/sign-in', replace: true });
  };
  return (
    <Button variant="secondary" fullWidth isLoading={signOut.isPending} onClick={() => void leave()}>
      {t('common.signIn.signOut')}
    </Button>
  );
}
