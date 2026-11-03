import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { CamerasSection } from './CamerasSection.tsx';
import { ComputersSection } from './ComputersSection.tsx';
import { TabletsSection } from './TabletsSection.tsx';
import { TvsSection } from './TvsSection.tsx';

// The TVs first, then the tablets the club keeps (owner, 29 Oct, #626 and #630); the computers and cameras are hidden,
// their sections kept for when the club wants them back.
const TABS = ['tvs', 'tablets'] as const;
type DeviceTab = (typeof TABS)[number] | 'computers' | 'cameras';

const LABELS = { tablets: 'console.tablets.title', tvs: 'console.tvs.title', computers: 'console.computers.title', cameras: 'console.cameras.title' } as const;

/** The part a tab shows. */
function TabContent({ tab }: { tab: DeviceTab }) {
  if (tab === 'tvs') return <TvsSection />;
  if (tab === 'computers') return <ComputersSection />;
  return tab === 'cameras' ? <CamerasSection /> : <TabletsSection />;
}

/**
 * Devices (#606), for staff who manage devices: the TVs and the dealer tablets and door kiosks, one kind at a time by
 * tab, each with its pairing form. A part of Settings (console v3): its kind is in Settings' address
 * (`/settings?tab=tablets`), so a refresh, Back or a shared link opens it.
 */
export function DevicesScreen({ tab }: { tab?: string | undefined }) {
  const navigate = useNavigate();
  const current = TABS.find((one) => one === tab) ?? TABS[0];
  return (
    <Screen title={t('console.devices.title')}>
      <Stack gap={8}>
        <Tabs label={t('console.devices.title')} current={current} onNavigate={(href) => void navigate({ href })}
          tabs={TABS.map((id) => ({ id, label: t(LABELS[id]), href: `/settings?tab=${id}` }))} />
        <TabContent tab={current} />
      </Stack>
    </Screen>
  );
}
