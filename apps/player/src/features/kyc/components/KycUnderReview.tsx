import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';
import { useSignOut } from '@rivr/db';

/** A check staff finish at the club: a PAN alone, with no DigiLocker photo, or a DigiLocker record in another name. */
export function KycUnderReview() {
  const signOut = useSignOut();
  return (
    <StepScreen
      title={t('player.kyc.reviewTitle')}
      footer={
        // Profile, with its sign-out, waits for the check (#632), so the way out is here.
        <Button variant="secondary" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
          {t('common.signIn.signOut')}
        </Button>
      }
    >
      <Text>{t('player.kyc.review')}</Text>
    </StepScreen>
  );
}
