import { useStaffVenue, type RewardItem } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Grid, Screen, Stack } from '@rivr/ui';
import { useState } from 'react';
import { CatalogueList } from './CatalogueList.tsx';
import { RedemptionList } from './RedemptionList.tsx';
import { RewardForm } from './RewardForm.tsx';

/** The catalogue and the redemptions beside the form: a new reward, or the one chosen to change. */
function RewardsBody({ venueId, canKeep, canHandOver }: { venueId: string; canKeep: boolean; canHandOver: boolean }) {
  const [editing, setEditing] = useState<RewardItem | null>(null);
  const catalogue = <CatalogueList venueId={venueId} canEdit={canKeep} onEdit={setEditing} />;
  const newReward = editing === null ? null : <Button variant="text" onClick={() => setEditing(null)}>{t('console.rewards.newReward')}</Button>;
  return (
    <Screen title={t('console.rewards.title')} actions={canKeep ? newReward : null}>
      <Stack gap={10}>
        {canKeep ? (
          <Grid columns={2} gap={12}>
            {catalogue}
            <RewardForm key={editing?.id ?? 'new'} venueId={venueId} item={editing} onDone={() => setEditing(null)} />
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
 * redemptions, which the cage, the host desk or an admin (rewards.hand_over) see and hand over.
 */
export function RewardsScreen() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready') return null;
  const canKeep = staff.venue.permissions.includes('rewards.manage');
  const canHandOver = staff.venue.permissions.includes('rewards.hand_over');
  if (!canKeep && !canHandOver) {
    return <Screen title={t('console.rewards.title')} status="error" errorText={t('console.rewards.notAllowed')} />;
  }
  return <RewardsBody venueId={staff.venue.venueId} canKeep={canKeep} canHandOver={canHandOver} />;
}
