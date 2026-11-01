import { type RewardItem, useRewardItems, useStaffVenue, useVenueRedemptions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Grid, Screen, Stack, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { CatalogueList } from './CatalogueList.tsx';
import { PointsByHand } from './PointsByHand.tsx';
import { RedemptionList } from './RedemptionList.tsx';
import { RewardForm } from './RewardForm.tsx';

/** The catalogue and the redemptions beside the form: a new reward, or the one chosen to change. */
function RewardsBody({ venueId, canKeep, canHandOver, canGive }: { venueId: string; canKeep: boolean; canHandOver: boolean; canGive: boolean }) {
  const [editing, setEditing] = useState<RewardItem | null>(null);
  // Kept here: a change saved closes its form, so the form's own words would go with it (F2-23).
  const [saved, setSaved] = useState<string | null>(null);
  const edit = (item: RewardItem | null) => { setEditing(item); setSaved(null); };
  // The catalogue and the redemptions read these too (one query each): waiting for both lays the screen out once (E-07).
  const lists = [useRewardItems(venueId), useVenueRedemptions(venueId)];
  const catalogue = <CatalogueList venueId={venueId} canEdit={canKeep} onEdit={edit} />;
  const newReward = editing === null ? null : <Button variant="text" onClick={() => edit(null)}>{t('console.rewards.newReward')}</Button>;
  if (lists.some((list) => list.isPending)) return <Screen title={t('console.rewards.title')} status="loading" />;
  return (
    <Screen title={t('console.rewards.title')} actions={canKeep ? newReward : null}>
      <Stack gap={10}>
        {canGive ? <PointsByHand venueId={venueId} /> : null}
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
 * points by hand, earned or locked, and release them (#645).
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
  return <RewardsBody venueId={staff.venue.venueId} canKeep={canKeep} canHandOver={canHandOver} canGive={canGive} />;
}
