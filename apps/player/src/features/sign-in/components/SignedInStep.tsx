import { useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';

/**
 * Sign-in opened over a live session, from a bookmark or a restored tab on a shared phone: who is
 * signed in, the way into the app, and signing out so someone else can sign in (#227).
 */
export function SignedInStep({ name, onContinue }: { name: string | undefined; onContinue: () => void }) {
  const signOut = useSignOut();
  return (
    <StepScreen
      title={t('common.signIn.signedInTitle')}
      footer={
        <>
          <Button variant="primary" fullWidth onClick={onContinue}>
            {t('common.signIn.continue')}
          </Button>
          <Button variant="secondary" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
            {t('common.signIn.signOut')}
          </Button>
        </>
      }
    >
      <Text>{name ? t('common.signIn.signedInAs', { name }) : t('common.signIn.signedInSomeone')}</Text>
    </StepScreen>
  );
}
