import type { StaffVenueState } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Stack, Switch, Text } from '@rivr/ui';
import { SignOutButton } from './SignOutButton.tsx';

/** The foot of the rail: who is signed in and at which venue, the switch to the practice venue, and signing out. */
export function StaffFooter({ staff }: { staff: Extract<StaffVenueState, { status: 'ready' }> }) {
  return (
    <Stack gap={3}>
      <Stack gap={1}>
        <Text weight="medium">{staff.venue.fullName}</Text>
        <Text variant="small" tone="muted">{staff.venue.venueName}</Text>
      </Stack>
      {staff.canPractise ? <Switch label={t('console.practice')} isOn={staff.venue.isPractice} onChange={staff.setPractice} /> : null}
      <SignOutButton />
    </Stack>
  );
}
