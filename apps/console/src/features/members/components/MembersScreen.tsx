import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Grid, Screen } from '@rivr/ui';
import { useState } from 'react';
import { MemberList } from './MemberList.tsx';
import { MemberRecordPanel } from './MemberRecordPanel.tsx';

/**
 * Members (#60; design prompt console rail "Members"; scope-v1 module 1): staff who read members find
 * one by name, mobile number or member number and open their record beside the list; staff with
 * members.manage change their tier there, with a reason. Feature overrides join with #61.
 */
export function MembersScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.members.title');
  const { permissions, venueId } = staff.venue;
  if (!permissions.includes('members.read')) return <Screen title={title} status="error" errorText={t('console.members.notAllowed')} />;
  const canSeePhoto = permissions.includes('kyc.review') || permissions.includes('cage.transact');
  return <Members title={title} venueId={venueId} canManage={permissions.includes('members.manage')} canSeePhoto={canSeePhoto} />;
}

function Members({ title, venueId, canManage, canSeePhoto }: { title: string; venueId: string; canManage: boolean; canSeePhoto: boolean }) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8}>
        <MemberList venueId={venueId} onOpen={setChosenId} />
        {chosenId === null ? null : <MemberRecordPanel key={chosenId} venueId={venueId} memberId={chosenId} canManage={canManage} canSeePhoto={canSeePhoto} />}
      </Grid>
    </Screen>
  );
}
