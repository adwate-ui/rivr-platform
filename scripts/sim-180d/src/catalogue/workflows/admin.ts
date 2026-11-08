/** Running the club: staff, devices, tables, settings, members, identity checks, the controls only super admins hold. */
import type { Workflow } from '../types.ts';
import { refusal, step } from './step.ts';

export const ADMIN: readonly Workflow[] = [
  {
    key: 'staff',
    title: 'A super admin adds a member of staff and later removes them',
    steps: [step('super_admin', 'console', '/staff', 'adds staff with a role, then removes one; removed staff show apart')],
    refusals: [refusal('host', '/staff', 'a host cannot manage staff')],
    endState: 'removed staff can no longer sign in to the console',
  },
  {
    key: 'devices',
    title: 'An admin pairs a tablet, a door kiosk and a TV, and sets a dealer’s PIN',
    steps: [
      step('admin', 'console', '/settings?tab=devices', 'pairs a tablet at a table, a door kiosk and a TV set to the waitlist'),
      step('admin', 'console', '/staff', 'sets a dealer’s PIN'),
      step('device', 'tablet', '/', 'shows the table, ready for the dealer'),
    ],
    refusals: [],
    endState: 'each device shows its own screen',
  },
  {
    key: 'tables-setup',
    title: 'An admin adds a table at a new stake',
    steps: [step('admin', 'console', '/tables', 'adds a table and its stakes'), step('member', 'player', '/', 'sees it on Home with its minimum buy-in')],
    refusals: [],
    endState: 'the table can be opened tonight',
  },
  {
    key: 'settings',
    title: 'A super admin sets the club’s rules',
    steps: [
      step('super_admin', 'console', '/settings?tab=settings', 'sets the play-time bonus steps and the launch settings'),
      step('admin', 'console', '/settings?tab=games-history', 'reads the games history'),
    ],
    refusals: [],
    endState: 'the rules take effect from their start',
  },
  {
    key: 'members-table',
    title: 'An admin finds members in the members table',
    steps: [step('admin', 'console', '/members', 'filters by KYC status and city, and reads the columns and the sign-up details')],
    refusals: [refusal('admin', '/members', 'only a super admin sees phone numbers')],
    endState: 'the right members are found',
  },
  {
    key: 'kyc-queue',
    title: 'An admin works the identity-check queue',
    steps: [step('admin', 'console', '/kyc-review', 'works the queue, oldest first')],
    refusals: [],
    endState: 'the queue is empty and each member was told',
  },
  {
    key: 'erase-member',
    title: 'A super admin erases a member on request',
    steps: [step('super_admin', 'console', '/members', 'erases the member, after settling anything they hold')],
    refusals: [refusal('admin', '/members', 'only a super admin can erase')],
    endState: 'no trace of the member is left but what the law keeps',
  },
  {
    key: 'freeze',
    title: 'A super admin freezes the venue and releases it',
    steps: [step('super_admin', 'console', '/kill-switch', 'engages the freeze, then releases it')],
    refusals: [refusal('floor', '/', 'the floor cannot seat anyone while frozen')],
    endState: 'nothing moved during the freeze',
  },
  {
    key: 'practice-reset',
    title: 'A super admin resets the practice venue',
    steps: [step('super_admin', 'console', '/practice-reset', 'resets the practice venue')],
    refusals: [],
    endState: 'the live venue is unchanged',
  },
  {
    key: 'purge',
    title: 'The purge screen holds its guard',
    steps: [step('super_admin', 'console', '/purge', 'reads the purge screen and backs out')],
    refusals: [refusal('admin', '/purge', 'only a super admin opens it')],
    endState: 'nothing is purged',
  },
  {
    key: 'owner-view',
    title: 'The investor looks at the club',
    steps: [step('owner_view', 'console', '/', 'reads the live floor')],
    refusals: [refusal('owner_view', '/members', 'the investor cannot read members')],
    endState: 'no member’s name or phone reached the investor',
  },
];
