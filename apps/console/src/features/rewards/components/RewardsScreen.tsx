import { useRewardItems, useStaffVenue, useVenueRedemptions } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, Screen, Stack, Tabs } from '@rivr/ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { CatalogueTab, type Editing } from './CatalogueTab.tsx';
import { PointsTab } from './PointsTab.tsx';
import { RedemptionList } from './RedemptionList.tsx';
import { accessOf, partHref, partsFor, type RewardsAccess, type RewardsPart } from './rewardsTabs.ts';

const LABELS = { catalogue: 'console.rewards.tabs.catalogue', handover: 'console.rewards.tabs.handover', points: 'console.rewards.tabs.points' } as const;

/** What waits under a part, counted on its tab: the rewards in the catalogue and the redemptions to hand over. */
type Counts = Readonly<Partial<Record<RewardsPart, number | undefined>>>;

function partLabel(part: RewardsPart, count: number | undefined): string {
  const name = t(LABELS[part]);
  return count === undefined ? name : t('console.rewards.tabs.counted', { label: name, count: formatNumber(count) });
}

/** The catalogue's count, read only while the catalogue is a part. */
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
  readonly parts: readonly RewardsPart[];
  readonly current: RewardsPart;
  readonly onNavigate: (href: string) => void;
}

/** What a part shows. */
function PartContent({ props, editing, onEdit }: { props: BodyProps; editing: Editing; onEdit: (editing: Editing) => void }) {
  const { venueId, access, current } = props;
  if (current === 'handover') return <RedemptionList venueId={venueId} />;
  if (current === 'points') return <PointsTab venueId={venueId} />;
  return <CatalogueTab venueId={venueId} canKeep={access.keep} editing={editing} onEdit={onEdit} />;
}

function RewardsBody({ props, counts }: { props: BodyProps; counts: Counts }) {
  // Kept here: the one gold button beside the heading opens the form the catalogue shows.
  const [editing, setEditing] = useState<Editing>('none');
  const canAdd = props.current === 'catalogue' && props.access.keep && editing === 'none';
  const newReward = <Button variant="primary" size="compact" onClick={() => setEditing('new')}>{t('console.rewards.newReward')}</Button>;
  const tabs = props.parts.map((id) => ({ id, label: partLabel(id, counts[id]), href: partHref(id) }));
  return (
    <Screen title={t('console.rewards.title')} actions={canAdd ? newReward : null}>
      <Stack gap={8}>
        <Tabs label={t('console.rewards.tabs.label')} tabs={tabs} current={props.current} onNavigate={props.onNavigate} />
        <PartContent props={props} editing={editing} onEdit={setEditing} />
      </Stack>
    </Screen>
  );
}

/** The screen with each part's count, read only where the role may read it. */
function CountedBody(props: BodyProps) {
  const withWaiting = (catalogue: number | undefined) => {
    const body = (handover: number | undefined) => <RewardsBody props={props} counts={{ catalogue, handover }} />;
    return props.access.handOver ? <WaitingCount venueId={props.venueId}>{body}</WaitingCount> : body(undefined);
  };
  return props.parts.includes('catalogue') ? <CatalogueCount venueId={props.venueId}>{withWaiting}</CatalogueCount> : withWaiting(undefined);
}

/**
 * Rewards (#145, decision 0181; console v3), by part: the catalogue of tournament seats, F&B upgrades, merchandise and
 * hotel nights, kept by staff with rewards.manage; the redemptions to hand over (rewards.hand_over); and points by hand,
 * earned or locked, and League points, one member or a CSV (points.give, within the daily limit, #815). A part the role
 * has not falls back to the first it has. `part` is the address's; `onNavigate` takes a part's address.
 */
export function RewardsParts({ part, onNavigate }: { part: string | undefined; onNavigate: (href: string) => void }) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const access = accessOf(staff.venue.permissions);
  const parts = partsFor(access);
  const first = parts[0];
  if (first === undefined) return <Screen title={t('console.rewards.title')} status="error" errorText={t('console.rewards.notAllowed')} />;
  const current = parts.find((one) => one === part) ?? first;
  return <CountedBody venueId={staff.venue.venueId} access={access} parts={parts} current={current} onNavigate={onNavigate} />;
}

/** The Rewards tab of /rewards (the spin wheel is the other): its part from the address, `?tab=rewards&part=points`. */
export function RewardsScreen() {
  const navigate = useNavigate();
  const part = new URLSearchParams(useRouterState({ select: (state) => state.location.searchStr })).get('part') ?? undefined;
  return <RewardsParts part={part} onNavigate={(href) => void navigate({ href })} />;
}
