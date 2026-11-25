import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, SplitView } from '@rivr/ui';
import { useState } from 'react';
import { useTonight } from '../hooks/useTonight.ts';
import { BonusFilePanel } from './BonusFileImport.tsx';
import { MemberList } from './MemberList.tsx';
import { ErasureRequests } from './ErasureRequests.tsx';
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
    seesIdentity: staff.venue.role === 'super_admin',
    manage: permissions.includes('members.manage'),
    // The floor and up see the selfie too (the owner, 22 Nov): authorize_kyc_image lets members.phone see it.
    seePhoto: permissions.includes('kyc.review') || permissions.includes('cage.transact') || permissions.includes('members.phone'),
    override: permissions.includes('members.override_features'),
    erase: permissions.includes('members.erase'),
    changePhone: permissions.includes('members.change_phone'),
    withdrawDeparture: staff.venue.role === 'super_admin',
    resetHours: staff.venue.role === 'super_admin',
    giveBonus: permissions.includes('bonus.give'),
    // Super admins and cashiers reverse a Bonus given and add a use a seat missed (the owner, 22 Nov; decision 0709).
    correctBonus: permissions.includes('bonus.correct'),
    viewsAll: permissions.includes('members.phone'),
    setReferrer: permissions.includes('members.referrer'),
  };
  // Floor and up open a member's History of changes by staff, as the Door's History (#1073).
  return <Members title={title} venueId={venueId} can={can} seesHistory={permissions.includes('members.phone')} usesFiles={staff.venue.role === 'super_admin'} {...props} />;
}

interface MembersProps extends MembersScreenProps {
  title: string;
  venueId: string;
  can: RecordAccess;
  seesHistory: boolean;
  /** Bonus from a file: super admins alone (the owner, 22 Nov). */
  usesFiles: boolean;
}

function Members({ title, venueId, can, seesHistory, usesFiles, memberId, part, onNavigate }: MembersProps) {
  const tonight = useTonight(venueId);
  // The table's Export sits beside the title, as the prototype has it.
  const [exportIn, setExportIn] = useState<HTMLElement | null>(null);
  // Bonus from a file beside it, for super admins (the owner, 22 Nov).
  return (
    <Screen title={title} actions={usesFiles ? <BonusFilePanel venueId={venueId} /> : undefined} onActionsSlot={setExportIn}>
      {can.erase ? <ErasureRequests venueId={venueId} onOpen={(id) => onNavigate(recordHref(id))} /> : null}
      {/* The list stays in place as a record opens, so the search typed stays (C-02). */}
      <SplitView layout="docked" recordKey={memberId} backLabel={t('console.members.back')} onBack={() => onNavigate('/members')} onClose={() => onNavigate('/members')}
        list={<MemberList venueId={venueId} tonight={tonight} onOpen={(id) => onNavigate(recordHref(id))} exportIn={exportIn} seesPhone={can.viewsAll} exportsPhone={can.changePhone}
          seesIdentity={can.seesIdentity} isDocked={memberId !== undefined} seesHistory={seesHistory} />}
        detail={memberId === undefined ? null : (
          <MemberRecordPanel key={memberId} venueId={venueId} memberId={memberId} can={can} part={part}
            tonight={tonight.get(memberId)} onNavigate={onNavigate} />
        )} />
    </Screen>
  );
}
