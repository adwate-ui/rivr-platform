import { t } from '@rivr/i18n';
import { StepList, type StepState } from '@rivr/ui';

/** Where the member is in the check: taking the selfie, at DigiLocker, or back from it while the documents are read. */
export type KycStage = 'selfie' | 'digilocker';

const stateOf = (step: number, at: number): StepState => (step < at ? 'done' : step === at ? 'current' : 'next');

/** The three steps of the identity check, and where the member is (K-09). */
export function KycSteps({ at }: { at: KycStage }) {
  const current = at === 'selfie' ? 0 : 1;
  return (
    <StepList
      label={t('player.kyc.stepsLabel')}
      steps={[
        { title: t('player.kyc.selfieStep'), detail: t('player.kyc.selfieStepDetail'), state: stateOf(0, current) },
        { title: t('player.kyc.digilockerStep'), detail: t('player.kyc.digilockerStepDetail'), state: stateOf(1, current) },
        { title: t('player.kyc.verifiedStep'), detail: t('player.kyc.verifiedStepDetail'), state: stateOf(2, current) },
      ]}
    />
  );
}
