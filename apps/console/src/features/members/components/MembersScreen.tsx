import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, SplitView } from '@rivr/ui';
import { useState } from 'react';
import { useTonight } from '../hooks/useTonight.ts';
import { MemberList } from './MemberList.tsx';
import { MemberRecordPanel, type RecordAccess } from './MemberRecordPanel.tsx';
import { recordHref } from './recordParts.ts';

export interface MembersScreenProps {
  /** The member whose record is open, from the address (`?member=`); none shows the list alone. */
  memberId: string | undefined;
  /** The record's part open (`?part=`): visits, membership or account. */
  part: string | undefined;
  /** Goes to an address in the console: a record, one of its parts, the list, or a seat on the floor. */
  onNavigate: (href: string) => void;
}

/**
 * Members (#60; console v3): staff who read members see every member on open (decision 0483), narrow the list by name,
 * mobile number, member number or tier, see where each is tonight, and open their record docked beside the list, in the address so Back and the floor's links reach it. On a
 * phone the record is a view of its own with a way back. Staff with members.manage change a tier there, with a reason;
 * super admins override one feature for one member (#61).
 */
export function MembersScreen(props: MembersScreenProps) {
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
    withdrawDeparture: staff.venue.role === 'super_admin',
  };
  return <Members title={title} venueId={venueId} can={can} {...props} />;
}

function Members({ title, venueId, can, memberId, part, onNavigate }: MembersScreenProps & { title: string; venueId: string; can: RecordAccess }) {
  const tonight = useTonight(venueId);
  // The table's Export sits beside the title, as the prototype has it.
  const [exportIn, setExportIn] = useState<HTMLElement | null>(null);
  return (
    <Screen title={title} onActionsSlot={setExportIn}>
      {/* The list stays in place as a record opens, so the search typed stays (C-02). */}
      <SplitView layout="docked" backLabel={t('console.members.back')} onBack={() => onNavigate('/members')}
        list={<MemberList venueId={venueId} tonight={tonight} onOpen={(id) => onNavigate(recordHref(id))} exportIn={exportIn} />}
        detail={memberId === undefined ? null : (
          <MemberRecordPanel key={memberId} venueId={venueId} memberId={memberId} can={can} part={part}
            tonight={tonight.get(memberId)} onNavigate={onNavigate} />
        )} />
    </Screen>
  );
}
