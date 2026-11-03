import { useStaffVenue } from '@rivr/db';
import { useLeads, useWallPosts } from '@rivr/db/social';
import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs } from '@rivr/ui';
import { LeadsTable } from './LeadsTable.tsx';
import { PublishPost } from './PublishPost.tsx';
import { RecentPosts } from './RecentPosts.tsx';
import { WallQueue } from './WallQueue.tsx';

const TABS = ['wall', 'publish', 'leads'] as const;
type SocialTab = (typeof TABS)[number];

/** Where a screen's tab sends the address: `/social?tab=leads`. */
export interface TabbedProps {
  readonly tab: string | undefined;
  readonly onNavigate: (href: string) => void;
}

/** Each tab's name, with how many wait on the wall and how many leads there are, once they are read. */
function useTabLabels(venueId: string): Record<SocialTab, string> {
  const wall = useWallPosts(venueId).data;
  const leads = useLeads(venueId).data;
  const waiting = wall?.filter((post) => post.status === 'pending').length;
  return {
    wall: waiting === undefined ? t('console.social.wall.title') : t('console.social.tabs.wall', { count: String(waiting) }),
    publish: t('console.social.publish.title'),
    leads: leads === undefined ? t('console.social.leads.title') : t('console.social.tabs.leads', { count: String(leads.length) }),
  };
}

function TabContent({ venueId, tab }: { venueId: string; tab: SocialTab }) {
  if (tab === 'wall') return <WallQueue venueId={venueId} />;
  if (tab === 'leads') return <LeadsTable venueId={venueId} />;
  return (
    <Stack gap={8}>
      <PublishPost venueId={venueId} />
      <RecentPosts venueId={venueId} />
    </Stack>
  );
}

/** The social wall to moderate, publishing with the posts made, and the inbox's leads, one tab at a time (console v3). */
export function Social({ venueId, tab, onNavigate }: TabbedProps & { venueId: string }) {
  const labels = useTabLabels(venueId);
  const current: SocialTab = TABS.find((one) => one === tab) ?? 'wall';
  const title = t('console.social.title');
  return (
    <Screen title={title}>
      <Stack gap={6}>
        <Tabs label={title} current={current} onNavigate={onNavigate} tabs={TABS.map((id) => ({ id, label: labels[id], href: `/social?tab=${id}` }))} />
        <TabContent venueId={venueId} tab={current} />
      </Stack>
    </Screen>
  );
}

/** Social (#154, #157, #587; docs/contracts/lane-d.md features/social), for staff who publish marketing: the social wall's moderation, publishing, and the inbox's leads. */
export function SocialScreen({ tab, onNavigate }: TabbedProps) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('marketing.publish')) {
    return <Screen title={t('console.social.title')} status="error" errorText={t('console.social.notAllowed')} />;
  }
  return <Social venueId={staff.venue.venueId} tab={tab} onNavigate={onNavigate} />;
}
