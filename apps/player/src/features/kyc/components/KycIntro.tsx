import { useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';
import type { ReactNode } from 'react';
import { KycSteps, type KycRoute, type KycStage } from './KycSteps.tsx';

interface KycIntroProps {
  at: KycStage;
  /** A member back with the check partly done: "Pick up where you left off". */
  isResume: boolean;
  /** The step's one action: Take a selfie, or Continue to DigiLocker. */
  action: ReactNode;
  /** Why the action did not go through, under the steps. */
  notice?: ReactNode;
  /** In the app, or at the club's desk once the selfie is in (decision 0502). */
  route?: KycRoute;
}

/**
 * Identity's first screen and where a member picks it up again (decision 0320): step 2 of 2, the three steps, what is kept,
 * the step's action and Sign out. No front-desk alternative here: it is named only once a check is refused, or when the
 * club checks identity at the desk (decision 0502).
 */
export function KycIntro({ at, isResume, action, notice, route = 'app' }: KycIntroProps) {
  const signOut = useSignOut();
  return (
    <StepScreen
      title={t(isResume ? 'player.kyc.resumeTitle' : 'player.kyc.startTitle')}
      look={{ eyebrow: t('player.kyc.eyebrow') }}
      footer={
        <>
          {action}
          <Button variant="text" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>{t('common.signIn.signOut')}</Button>
        </>
      }
    >
      <KycSteps at={at} route={route} />
      {notice}
      <Text variant="small" tone="muted">{t(route === 'club' ? 'player.kyc.clubKept' : 'player.kyc.kept')}</Text>
    </StepScreen>
  );
}
