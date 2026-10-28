import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { EndOfDaySection } from './EndOfDaySection.tsx';
import { TreasurySection } from './TreasurySection.tsx';

const TABS = ['now', 'close'] as const;
type ShiftTab = (typeof TABS)[number];

const LABELS = { now: 'console.treasury.tabs.now', close: 'console.treasury.tabs.close' } as const;

/** The part a tab shows. */
function TabContent({ tab }: { tab: ShiftTab }) {
  return tab === 'close' ? <EndOfDaySection /> : <TreasurySection />;
}

/**
 * The cage's shift (#606): what the venue holds, opening the shift and counting the chips; then closing it against the
 * ledger, with every opening and close before. /treasury and /end-of-day open their tab here.
 */
export function ShiftScreen() {
  const navigate = useNavigate();
  // The tab open is in the address (`?tab=close`), so a refresh, Back or a shared link opens it.
  const { tab } = useSearch({ from: '/frame/shift' });
  const current = TABS.find((one) => one === tab) ?? TABS[0];
  return (
    <Screen title={t('console.treasury.shiftScreen')}>
      <Stack gap={8}>
        <Tabs label={t('console.treasury.shiftScreen')} current={current} onNavigate={(href) => void navigate({ href })}
          tabs={TABS.map((id) => ({ id, label: t(LABELS[id]), href: `/shift?tab=${id}` }))} />
        <TabContent tab={current} />
      </Stack>
    </Screen>
  );
}
