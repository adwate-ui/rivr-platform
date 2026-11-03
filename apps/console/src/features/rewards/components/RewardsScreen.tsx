import { useRewardItems, useStaffVenue, useVenueRedemptions } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, Screen, Stack, Tabs } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { CatalogueTab, type Editing } from './CatalogueTab.tsx';
import { PointsTab } from './PointsTab.tsx';
import { RedemptionList } from './RedemptionList.tsx';
import { accessOf, tabsFor, type RewardsAccess, type RewardsTab } from './rewardsTabs.ts';
import { SpinTab } from './SpinTab.tsx';

const LABELS = {
  catalogue: 'console.rewards.tabs.catalogue', handover: 'console.rewards.tabs.handover', points: 'console.rewards.tabs.points', spin: 'console.rewards.tabs.spin',
} as const;

/** What waits under a tab, counted on it: the rewards in the catalogue and the redemptions to hand over; none elsewhere. */
type Counts = Readonly<Partial<Record<RewardsTab, number | undefined>>>;

function tabLabel(tab: RewardsTab, count: number | undefined): string {
  const name = t(LABELS[tab]);
  return count === undefined ? name : t('console.rewards.tabs.counted', { label: name, count: formatNumber(count) });
}

/** The catalogue's count, read only while the catalogue is a tab. */
function CatalogueCount({ venueId, children }: { venueId: string; children: (count: number | undefined) => ReactNode }) {
  return children(useRewardItems(venueId).data?.length);
}

/** The redemptions waiting, read only for staff who hand them over. */
function WaitingCount({ venueId, children }: { venueId: string; children: (count: number | undefined) => ReactNode }) {
  return children(useVenueRedemptions(venueId).data?.filter((row) => row.handedOverAt === null).length);
}

interface BodyProps {
  readonly venueId: string;
  readonly access: RewardsAccess;
  readonly tabs: readonly RewardsTab[];
  readonly current: RewardsTab;
  readonly onNavigate: (href: string) => void;
}

/** The part a tab shows. */
function TabContent({ props, editing, onEdit }: { props: BodyProps; editing: Editing; onEdit: (editing: Editing) => void }) {
  const { venueId, access, current } = props;
  if (current === 'handover') return <RedemptionList venueId={venueId} />;
  if (current === 'points') return <PointsTab venueId={venueId} />;
  if (current === 'spin') return <SpinTab venueId={venueId} />;
  return <CatalogueTab venueId={venueId} canKeep={access.keep} editing={editing} onEdit={onEdit} />;
}

function RewardsBody({ props, counts }: { props: BodyProps; counts: Counts }) {
  // Kept here: the one gold button beside the heading opens the form the catalogue shows.
  const [editing, setEditing] = useState<Editing>('none');
  const canAdd = props.current === 'catalogue' && props.access.keep && editing === 'none';
  const newReward = <Button variant="primary" size="compact" onClick={() => setEditing('new')}>{t('console.rewards.newReward')}</Button>;
  const tabs = props.tabs.map((id) => ({ id, label: tabLabel(id, counts[id]), href: `/rewards?tab=${id}` }));
  return (
    <Screen title={t('console.rewards.title')} actions={canAdd ? newReward : null}>
      <Stack gap={8}>
        <Tabs label={t('console.rewards.title')} tabs={tabs} current={props.current} onNavigate={props.onNavigate} />
        <TabContent props={props} editing={editing} onEdit={setEditing} />
      </Stack>
    </Screen>
  );
}

/** The screen with each tab's count, read only where the role may read it. */
function CountedBody(props: BodyProps) {
  const withWaiting = (catalogue: number | undefined) => {
    const body = (handover: number | undefined) => <RewardsBody props={props} counts={{ catalogue, handover }} />;
    return props.access.handOver ? <WaitingCount venueId={props.venueId}>{body}</WaitingCount> : body(undefined);
  };
  return props.tabs.includes('catalogue') ? <CatalogueCount venueId={props.venueId}>{withWaiting}</CatalogueCount> : withWaiting(undefined);
}

/**
 * Rewards (#145, decision 0181; console v3), by tab: the catalogue of tournament seats, F&B upgrades, merchandise and hotel
 * nights, kept by staff with rewards.manage; the redemptions to hand over (rewards.hand_over); points by hand, earned or
 * locked, and League points, one member or a CSV (points.give, within the daily limit, #815); and the spin wheel (#150),
 * for staff who run promotions. A tab the role has not falls back to the first it has.
 */
export function RewardsScreen({ tab, onNavigate }: { tab: string | undefined; onNavigate: (href: string) => void }) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const access = accessOf(staff.venue.permissions);
  const tabs = tabsFor(access);
  const first = tabs[0];
  if (first === undefined) return <Screen title={t('console.rewards.title')} status="error" errorText={t('console.rewards.notAllowed')} />;
  const current = tabs.find((one) => one === tab) ?? first;
  return <CountedBody venueId={staff.venue.venueId} access={access} tabs={tabs} current={current} onNavigate={onNavigate} />;
}
