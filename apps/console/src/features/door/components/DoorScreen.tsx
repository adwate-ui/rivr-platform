import { t, type MessageKey } from '@rivr/i18n';
import { Stack, Tabs } from '@rivr/ui';
import { CheckInTab } from './CheckInTab.tsx';
import { TodaysPlayersTab } from './TodaysPlayersTab.tsx';

const TABS = ['checkin', 'today'] as const;
type DoorTab = (typeof TABS)[number];

const LABELS: Readonly<Record<DoorTab, MessageKey>> = { checkin: 'console.checkIn.title', today: 'console.todaysPlayers.title' };

interface DoorScreenProps {
  /** The tab in the address (`/door?tab=today`); anything else opens Check-in. */
  tab: string | undefined;
  onNavigate: (href: string) => void;
}

/**
 * The Door (console v3): Check-in, for the front desk, and Today's players, for staff who read members, as two tabs above
 * the part open, whose heading names the page. /check-in and /players-today open their tab here.
 */
export function DoorScreen({ tab, onNavigate }: DoorScreenProps) {
  const current = TABS.find((one) => one === tab) ?? 'checkin';
  return (
    <Stack gap={6}>
      <Tabs look="pill" label={t('console.checkIn.door')} current={current} onNavigate={onNavigate}
        tabs={TABS.map((id) => ({ id, label: t(LABELS[id]), href: `/door?tab=${id}` }))} />
      {current === 'checkin' ? <CheckInTab /> : <TodaysPlayersTab />}
    </Stack>
  );
}
