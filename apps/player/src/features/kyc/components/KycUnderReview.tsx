import { useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, StepScreen } from '@rivr/ui';

/** Where a check that has left the member's hands stands: with staff, or refused. */
function KycHeld({ title, body }: { title: string; body: string }) {
  const signOut = useSignOut();
  return (
    <StepScreen
      title={title}
      look={{ serifSize: 40, eyebrow: t('player.kyc.title'), subtitle: body }}
      align="center"
      footer={
        // Profile, with its sign-out, waits for the check (#632), so the way out is here.
        <Button variant="outline" size="tall" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
          {t('common.signIn.signOut')}
        </Button>
      }
    >
      {null}
    </StepScreen>
  );
}

/** Under review (decision 0320): staff finish the check, a PAN alone, another face than the selfie's or a possible duplicate. */
export function KycUnderReview() {
  return <KycHeld title={t('player.kyc.reviewTitle')} body={t('player.kyc.review')} />;
}

/**
 * Not verified (decision 0320): under 18, or an identity another member already holds. The member is not told which; the
 * front desk takes it from there, the one place this flow names it.
 */
export function KycRefused() {
  return <KycHeld title={t('player.kyc.refusedTitle')} body={t('player.kyc.refused')} />;
}
