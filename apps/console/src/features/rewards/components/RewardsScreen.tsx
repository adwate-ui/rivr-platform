import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Screen } from '@rivr/ui';
import { useState } from 'react';
import { CatalogueTab, type Editing } from './CatalogueTab.tsx';
import { PointsTab } from './PointsTab.tsx';

/** The catalogue, and the screen's one gold button, kept here because it opens the form the catalogue shows. */
function Catalogue({ venueId, canKeep }: { venueId: string; canKeep: boolean }) {
  const [editing, setEditing] = useState<Editing>('none');
  const newReward = <Button variant="primary" size="compact" onClick={() => setEditing('new')}>{t('console.rewards.newReward')}</Button>;
  return (
    <Screen title={t('console.rewards.title')} actions={canKeep && editing === 'none' ? newReward : undefined}>
      <CatalogueTab venueId={venueId} canKeep={canKeep} editing={editing} onEdit={setEditing} />
    </Screen>
  );
}

/**
 * Rewards' Catalogue tab (#145, decision 0181; console v3): the tournament seats, F&B upgrades, merchandise and hotel
 * nights, kept by staff with rewards.manage. Redemptions are handed over at the Door.
 */
export function RewardsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return <Catalogue venueId={staff.venue.venueId} canKeep={staff.venue.permissions.includes('rewards.manage')} />;
}

/**
 * Rewards' Points by hand tab: points by hand, earned or locked, and League points, one member or a CSV (points.give,
 * within the daily limit, #815), and for a super admin bonus chips by hand (the owner, 9 Nov).
 */
export function RewardsPointsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return (
    <Screen title={t('console.rewards.tabs.points')}>
      <PointsTab venueId={staff.venue.venueId} canGiveBonus={staff.venue.role === 'super_admin'} />
    </Screen>
  );
}
