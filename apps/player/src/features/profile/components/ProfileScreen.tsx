import { usePreferences } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { GamesSection } from './GamesSection.tsx';
import { IdentitySection } from './IdentitySection.tsx';
import { NotificationsSection } from './NotificationsSection.tsx';
import { ResponsiblePlaySection } from './ResponsiblePlaySection.tsx';

/**
 * Profile, behind the member's initial (design prompt, "Profile"): the identity check, the games for
 * waitlist alerts, notifications and promotions, and the way to limits and self-exclusion.
 */
export function ProfileScreen() {
  const preferences = usePreferences();
  const title = t('player.profile.title');
  if (preferences.isPending) return <Screen title={title} status="loading" />;
  if (preferences.isError) return <Screen title={title} status="error" onRetry={() => void preferences.refetch()} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <IdentitySection />
        <GamesSection preferences={preferences.data} />
        <NotificationsSection preferences={preferences.data} />
        <ResponsiblePlaySection />
      </Stack>
    </Screen>
  );
}
