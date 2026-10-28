import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { LeadsTable } from './LeadsTable.tsx';
import { PublishPost } from './PublishPost.tsx';
import { RecentPosts } from './RecentPosts.tsx';
import { WallQueue } from './WallQueue.tsx';
import { WinnerCards } from './WinnerCards.tsx';

/** Social (#154, #157, #587; docs/contracts/lane-d.md features/social), for staff who publish marketing: publishing, the inbox's leads, and the social wall's moderation. */
export function SocialScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('marketing.publish')) {
    return <Screen title={t('console.social.title')} status="error" errorText={t('console.social.notAllowed')} />;
  }
  return (
    <Screen title={t('console.social.title')}>
      <Stack gap={8}>
        <PublishPost venueId={staff.venue.venueId} />
        <RecentPosts venueId={staff.venue.venueId} />
        <WinnerCards venueId={staff.venue.venueId} />
        <LeadsTable venueId={staff.venue.venueId} />
        <WallQueue venueId={staff.venue.venueId} />
      </Stack>
    </Screen>
  );
}
