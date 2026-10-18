import { usePreferences } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { GamesSection } from './GamesSection.tsx';
import { IdentitySection } from './IdentitySection.tsx';
import { NotificationsSection } from './NotificationsSection.tsx';
import { ResponsiblePlaySection } from './ResponsiblePlaySection.tsx';
import { SignOutSection } from './SignOutSection.tsx';

/**
 * Profile, behind the member's initial (design prompt, "Profile"): the identity check, the games for
 * waitlist alerts, notifications and promotions, the way to limits and self-exclusion, and sign out.
 */
export function ProfileScreen() {
  const preferences = usePreferences();
  const title = t('player.profile.title');
  if (preferences.isPending || preferences.isError) {
    // Sign out works offline, so it stays within reach when Profile cannot load.
    return (
      <Stack gap={8}>
        {preferences.isPending ? (
          <Screen title={title} status="loading" />
        ) : (
          <Screen title={title} status="error" onRetry={() => void preferences.refetch()} />
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
        <NotificationsSection preferences={preferences.data} />
        <ResponsiblePlaySection />
        <SignOutSection />
      </Stack>
    </Screen>
  );
}
