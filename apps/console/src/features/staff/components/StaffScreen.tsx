import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { DealerPinsSection } from './DealerPinsSection.tsx';
import { StaffSection } from './StaffSection.tsx';

const TABS = ['staff', 'removed', 'dealerPins'] as const;
type StaffTab = (typeof TABS)[number];

const LABELS = { staff: 'console.staff.tabs.staff', removed: 'console.staff.tabs.removed', dealerPins: 'console.dealerPins.title' } as const;

/** The part a tab shows. */
function TabContent({ tab }: { tab: StaffTab }) {
  if (tab === 'dealerPins') return <DealerPinsSection />;
  return <StaffSection view={tab === 'removed' ? 'removed' : 'active'} />;
}

/**
 * Staff (#606), for staff who manage staff: the venue's staff with each hire's onboarding, those whose login is turned
 * off (owner, 8 Nov), and the dealers' PINs for the tablet sign-in, by tab. /dealer-pins opens its tab here.
 */
export function StaffScreen() {
  const navigate = useNavigate();
  // The tab open is in the address (`?tab=removed`, `?tab=dealerPins`), so a refresh, Back or a shared link opens it.
  const { tab } = useSearch({ from: '/frame/staff' });
  const current = TABS.find((one) => one === tab) ?? TABS[0];
  return (
    <Screen title={t('console.staff.title')}>
      <Stack gap={8}>
        <Tabs label={t('console.staff.title')} current={current} onNavigate={(href) => void navigate({ href })}
          tabs={TABS.map((id) => ({ id, label: t(LABELS[id]), href: `/staff?tab=${id}` }))} />
        <TabContent tab={current} />
      </Stack>
    </Screen>
  );
}
