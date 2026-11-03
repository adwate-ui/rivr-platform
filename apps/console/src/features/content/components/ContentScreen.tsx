import type { Permission } from '@rivr/contracts';
import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs } from '@rivr/ui';
import { LearnTab } from './LearnTab.tsx';
import { WebsiteTab } from './WebsiteTab.tsx';

const TABS = ['website', 'learn'] as const;
type ContentTab = (typeof TABS)[number];

/** The permission each tab needs: the website's editors, and the super admins who add Learn content. */
const PERMISSION: Readonly<Record<ContentTab, Permission>> = { website: 'website.edit', learn: 'learn.manage_sources' };

/** Where a screen's tab sends the address: `/content?tab=learn`. */
export interface TabbedProps {
  readonly tab: string | undefined;
  readonly onNavigate: (href: string) => void;
}

/** The tabs a staff member may open, the one in the address or the first, and its part (console v3). */
export function Content({ venueId, tabs, tab, onNavigate }: TabbedProps & { venueId: string; tabs: readonly ContentTab[] }) {
  const current = tabs.find((one) => one === tab) ?? tabs[0] ?? 'website';
  const title = t('console.content.title');
  return (
    <Screen title={title}>
      <Stack gap={6}>
        <Tabs label={title} current={current} onNavigate={onNavigate}
          tabs={tabs.map((id) => ({ id, label: t(`console.content.tabs.${id}`), href: `/content?tab=${id}` }))} />
        {current === 'website' ? <WebsiteTab venueId={venueId} /> : <LearnTab venueId={venueId} />}
      </Stack>
    </Screen>
  );
}

/**
 * Content (console v3): the website editor (#129, decision 0270), for super admins and marketing (website.edit), and the
 * Learn content behind the player app's Learn (#131, decision 0016), for super admins (learn.manage_sources); Learn
 * itself stays off for members at launch (decision 0284).
 */
export function ContentScreen({ tab, onNavigate }: TabbedProps) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  const tabs = TABS.filter((id) => permissions.includes(PERMISSION[id]));
  if (tabs.length === 0) return <Screen title={t('console.content.title')} status="error" errorText={t('console.content.notAllowed')} />;
  return <Content venueId={venueId} tabs={tabs} tab={tab} onNavigate={onNavigate} />;
}
