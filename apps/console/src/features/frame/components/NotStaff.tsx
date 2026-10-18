import { useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';

/** Someone signed in who is not active staff at any venue: they can only sign out. */
export function NotStaff() {
  const signOut = useSignOut();
  return (
    <StepScreen
      title={t('console.notStaff.title')}
      footer={
        <Button variant="primary" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
          {t('common.signIn.signOut')}
        </Button>
      }
    >
      <Text>{t('console.notStaff.body')}</Text>
    </StepScreen>
  );
}
