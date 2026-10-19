import { usePreferences, useRestrictions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { AcademySection } from './AcademySection.tsx';
import { GamesSection } from './GamesSection.tsx';
import { IdentitySection } from './IdentitySection.tsx';
import { LimitsSection } from './LimitsSection.tsx';
import { NotificationsSection } from './NotificationsSection.tsx';
import { SignOutSection } from './SignOutSection.tsx';

/**
 * Profile, behind the member's initial (design prompt, "Profile"): the identity check, the games for
 * waitlist alerts, the session reminder and a break from play (#56), notifications and promotions, the
 * way to any Academy seats, and sign out, in the prototype's order.
 */
export function ProfileScreen() {
  const preferences = usePreferences();
  const restrictions = useRestrictions();
  const title = t('player.profile.title');
  if (preferences.isPending || preferences.isError || restrictions.isPending || restrictions.isError) {
    // Sign out works offline, so it stays within reach when Profile cannot load.
    return (
      <Stack gap={8}>
        {preferences.isPending || restrictions.isPending ? (
          <Screen title={title} status="loading" />
        ) : (
          <Screen title={title} status="error" onRetry={() => void Promise.all([preferences.refetch(), restrictions.refetch()])} />
        )}
        <SignOutSection />
      </Stack>
    );
  }
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <IdentitySection />
        <GamesSection preferences={preferences.data} />
        <LimitsSection restrictions={restrictions.data} />
        <NotificationsSection preferences={preferences.data} />
        <AcademySection />
        <SignOutSection />
      </Stack>
    </Screen>
  );
}
