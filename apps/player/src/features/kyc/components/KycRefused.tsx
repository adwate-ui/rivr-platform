import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';
import { useSignOut } from '@rivr/db';

/**
 * A check the club refused: under 18, or an identity another member already holds. The member is
 * not told which, and staff at the front desk take it from there.
 */
export function KycRefused() {
  const signOut = useSignOut();
  return (
    <StepScreen
      title={t('player.kyc.refusedTitle')}
      footer={
        // Profile, with its sign-out, waits for the check (#632), so the way out is here.
        <Button variant="secondary" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
          {t('common.signIn.signOut')}
        </Button>
      }
    >
      <Text>{t('player.kyc.refused')}</Text>
    </StepScreen>
  );
}
