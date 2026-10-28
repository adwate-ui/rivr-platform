import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { HighHandsSection } from './HighHandsSection.tsx';
import { JackpotSection } from './JackpotSection.tsx';

const TABS = ['jackpot', 'highHands'] as const;
type JackpotTab = (typeof TABS)[number];

const LABELS = { jackpot: 'console.jackpots.tabs.jackpot', highHands: 'console.highHands.title' } as const;

/** The part a tab shows. */
function TabContent({ tab }: { tab: JackpotTab }) {
  return tab === 'highHands' ? <HighHandsSection /> : <JackpotSection />;
}

/**
 * Jackpots (#606): the jackpot's pools, its payouts and bad beats, and the high hands claimed on the tablets, by tab.
 * /high-hands opens its tab here.
 */
export function JackpotsScreen() {
  const navigate = useNavigate();
  // The tab open is in the address (`?tab=highHands`), so a refresh, Back or a shared link opens it.
  const { tab } = useSearch({ from: '/frame/jackpots' });
  const current = TABS.find((one) => one === tab) ?? TABS[0];
  return (
    <Screen title={t('console.jackpots.title')}>
      <Stack gap={8}>
        <Tabs label={t('console.jackpots.title')} current={current} onNavigate={(href) => void navigate({ href })}
          tabs={TABS.map((id) => ({ id, label: t(LABELS[id]), href: `/jackpots?tab=${id}` }))} />
        <TabContent tab={current} />
      </Stack>
    </Screen>
  );
}
