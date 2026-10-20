import { useComputers, useStaffVenue, useThisComputer, type ThisComputer } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, Heading, Screen, Stack, Text } from '@rivr/ui';
import { ComputerRow } from './ComputerRow.tsx';
import { EnrolForm } from './EnrolForm.tsx';

const ENROLLED_AS = { cage: 'console.computers.enrolledAsCage', console: 'console.computers.enrolledAsConsole' } as const;

/** The venue's cage and admin computers (#384), for staff with devices.manage: enrol this one, revoke one. */
export function ComputersScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('devices.manage')) {
    return <Screen title={t('console.computers.title')} status="error" errorText={t('console.computers.notAllowed')} />;
  }
  return <Computers venueId={staff.venue.venueId} canConfigure={staff.venue.permissions.includes('venue.configure')} />;
}

function Notice({ text }: { text: string }) {
  return <Box surface="alert" padding={3} radius="sm"><Text tone="onAlert">{text}</Text></Box>;
}

/** Super admins (venue.configure) are told while the venue enforces nothing, since only they add the networks. */
function Notices({ here, canConfigure }: { here: ThisComputer; canConfigure: boolean }) {
  if (!here.isEnforced) return canConfigure ? <Notice text={t('console.computers.notEnforced')} /> : null;
  return here.isOnStaffNetwork ? null : <Notice text={t('console.computers.offNetwork')} />;
}

function Computers({ venueId, canConfigure }: { venueId: string; canConfigure: boolean }) {
  const here = useThisComputer(venueId);
  const computers = useComputers(venueId);
  const title = t('console.computers.title');
  if (here.isPending || computers.isPending) return <Screen title={title} status="loading" />;
  if (here.data === undefined || computers.data === undefined) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([here.refetch(), computers.refetch()])} />;
  }
  const mine = here.data.computer;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Notices here={here.data} canConfigure={canConfigure} />
        <Stack gap={3}>
          <Heading level={2}>{t('console.computers.thisComputer')}</Heading>
          <Text>{mine === null ? t('console.computers.notEnrolled') : t(ENROLLED_AS[mine.kind], { name: mine.name })}</Text>
          <EnrolForm venueId={venueId} />
        </Stack>
        <Stack gap={4} divided>
          <Heading level={2}>{t('console.computers.enrolled')}</Heading>
          {computers.data.length === 0 ? <Text tone="muted">{t('console.computers.empty')}</Text> : null}
          {computers.data.map((computer) => <ComputerRow key={computer.deviceId} venueId={venueId} computer={computer} />)}
        </Stack>
      </Stack>
    </Screen>
  );
}
