import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Grid, Screen } from '@rivr/ui';
import { useState } from 'react';
import { MemberList } from './MemberList.tsx';
import { MemberRecordPanel, type RecordAccess } from './MemberRecordPanel.tsx';

/**
 * Members (#60; design prompt console rail "Members"; scope-v1 module 1): staff who read members find
 * one by name, mobile number or member number and open their record beside the list; staff with
 * members.manage change their tier there, with a reason; super admins override one feature for one member (#61).
 */
export function MembersScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.members.title');
  const { permissions, venueId } = staff.venue;
  if (!permissions.includes('members.read')) return <Screen title={title} status="error" errorText={t('console.members.notAllowed')} />;
  const can: RecordAccess = {
    manage: permissions.includes('members.manage'),
    seePhoto: permissions.includes('kyc.review') || permissions.includes('cage.transact'),
    override: permissions.includes('members.override_features'),
    erase: permissions.includes('members.erase'),
    changePhone: permissions.includes('members.change_phone'),
  };
  return <Members title={title} venueId={venueId} can={can} />;
}

function Members({ title, venueId, can }: { title: string; venueId: string; can: RecordAccess }) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8} stackBelow="medium">
        <MemberList venueId={venueId} onOpen={setChosenId} />
        {chosenId === null ? null : <MemberRecordPanel key={chosenId} venueId={venueId} memberId={chosenId} can={can} />}
      </Grid>
    </Screen>
  );
}
