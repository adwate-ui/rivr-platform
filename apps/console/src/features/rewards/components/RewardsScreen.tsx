import { type RewardItem, useRewardItems, useStaffVenue, useVenueRedemptions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Grid, Screen, Stack, StatusMessage } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { CatalogueList } from './CatalogueList.tsx';
import { LeagueCsvImport } from './LeagueCsvImport.tsx';
import { PointsByHand } from './PointsByHand.tsx';
import { RedemptionList } from './RedemptionList.tsx';
import { RewardForm } from './RewardForm.tsx';

/**
 * The screen laid out once its lists have come (UI polish audit E-07), so the redemptions never push the catalogue down;
 * each role reads only what it is shown. The catalogue, for everyone here.
 */
function CatalogueReady({ venueId, children }: { venueId: string; children: ReactNode }) {
  return useRewardItems(venueId).isPending ? <Screen title={t('console.rewards.title')} status="loading" /> : children;
}

/** For staff who hand rewards over, the redemptions too, then the catalogue. */
function HandOverReady({ venueId, children }: { venueId: string; children: ReactNode }) {
  if (useVenueRedemptions(venueId).isPending) return <Screen title={t('console.rewards.title')} status="loading" />;
  return <CatalogueReady venueId={venueId}>{children}</CatalogueReady>;
}

/** The catalogue and the redemptions beside the form: a new reward, or the one chosen to change. */
function RewardsBody({ venueId, canKeep, canHandOver, canGive }: { venueId: string; canKeep: boolean; canHandOver: boolean; canGive: boolean }) {
  const [editing, setEditing] = useState<RewardItem | null>(null);
  // Kept here: a change saved closes its form, so the form's own words would go with it (F2-23).
  const [saved, setSaved] = useState<string | null>(null);
  const edit = (item: RewardItem | null) => { setEditing(item); setSaved(null); };
  const catalogue = <CatalogueList venueId={venueId} canEdit={canKeep} onEdit={edit} />;
  const newReward = editing === null ? null : <Button variant="text" onClick={() => edit(null)}>{t('console.rewards.newReward')}</Button>;
  return (
    <Screen title={t('console.rewards.title')} actions={canKeep ? newReward : null}>
      <Stack gap={10}>
        {canGive ? <PointsByHand venueId={venueId} /> : null}
        {canGive ? <LeagueCsvImport venueId={venueId} /> : null}
        {canKeep ? (
          <Grid columns={2} gap={12} stackBelow="medium">
            {catalogue}
            <Stack gap={4}>
              <RewardForm key={editing?.id ?? 'new'} venueId={venueId} item={editing} onCancel={() => edit(null)}
                onOutcome={(text) => { setSaved(text); if (text !== null) setEditing(null); }} />
              <StatusMessage>{saved}</StatusMessage>
            </Stack>
          </Grid>
        ) : catalogue}
        {canHandOver ? <RedemptionList venueId={venueId} /> : null}
      </Stack>
    </Screen>
  );
}

/**
 * Rewards (#145, decision 0181; design prompt "Rewards"): the venue's catalogue of tournament seats, F&B
 * upgrades, merchandise and hotel nights, kept by staff with rewards.manage beside the form; and members'
 * redemptions, which the cage, the host desk or an admin (rewards.hand_over) see and hand over. Staff with points.give give
 * points by hand, earned or locked, and release them (#645), and give League points, to one member or from a CSV (L-01).
 */
export function RewardsScreen() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready') return null;
  const canKeep = staff.venue.permissions.includes('rewards.manage');
  const canHandOver = staff.venue.permissions.includes('rewards.hand_over');
  const canGive = staff.venue.permissions.includes('points.give');
  if (!canKeep && !canHandOver && !canGive) {
    return <Screen title={t('console.rewards.title')} status="error" errorText={t('console.rewards.notAllowed')} />;
  }
  const { venueId } = staff.venue;
  const body = <RewardsBody venueId={venueId} canKeep={canKeep} canHandOver={canHandOver} canGive={canGive} />;
  return canHandOver ? <HandOverReady venueId={venueId}>{body}</HandOverReady> : <CatalogueReady venueId={venueId}>{body}</CatalogueReady>;
}
