import { t } from '@rivr/i18n';
import { StepList, type StepState } from '@rivr/ui';

/** Where the member is in the check: taking the selfie, or at DigiLocker. */
export type KycStage = 'selfie' | 'digilocker';

/** How the identity is checked: in the app, through DigiLocker, or at the club's desk (decision 0502). */
export type KycRoute = 'app' | 'club';

const stateOf = (step: number, at: number): StepState => (step < at ? 'done' : step === at ? 'current' : 'next');

/** The three steps of the identity check between hairlines (decision 0320), and where the member is (K-09). */
export function KycSteps({ at, route = 'app' }: { at: KycStage; route?: KycRoute }) {
  const current = at === 'selfie' ? 0 : 1;
  const second = route === 'club'
    ? { title: t('player.kyc.clubStep'), detail: t('player.kyc.clubStepDetail') }
    : { title: t('player.kyc.digilockerStep'), detail: t('player.kyc.digilockerStepDetail') };
  return (
    <StepList
      label={t('player.kyc.stepsLabel')}
      look="ruled"
      steps={[
        { title: t('player.kyc.selfieStep'), detail: t('player.kyc.selfieStepDetail'), state: stateOf(0, current) },
        { ...second, state: stateOf(1, current) },
        { title: t('player.kyc.verifiedStep'), state: stateOf(2, current) },
      ]}
    />
  );
}
