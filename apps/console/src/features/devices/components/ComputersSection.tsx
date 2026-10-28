import { useComputers, useStaffVenue, useThisComputer, type ThisComputer } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, Heading, Screen, Stack, Text } from '@rivr/ui';
import { ComputerRow } from './ComputerRow.tsx';
import { AddComputerForm, EnrolForm } from './EnrolForm.tsx';

const ENROLLED_AS = {
  cage: 'console.computers.enrolledAsCage', console: 'console.computers.enrolledAsConsole', agent: 'console.computers.enrolledAsAgent',
} as const;

/** The venue's cage and admin computers (#384), for staff with devices.manage: add one, enrol this one, revoke one. */
export function ComputersSection() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('devices.manage')) {
    return <Screen level={2} title={t('console.computers.title')} status="error" errorText={t('console.computers.notAllowed')} />;
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

/** This computer: what it is enrolled as or, until it is, the code to enrol it with. One browser, one computer. */
function ThisComputerSection({ venueId, here }: { venueId: string; here: ThisComputer }) {
  const mine = here.computer;
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.computers.thisComputer')}</Heading>
      <Text>{mine === null ? t('console.computers.notEnrolled') : t(ENROLLED_AS[mine.kind], { name: mine.name })}</Text>
      {mine === null ? <EnrolForm venueId={venueId} /> : null}
    </Stack>
  );
}

function Computers({ venueId, canConfigure }: { venueId: string; canConfigure: boolean }) {
  const here = useThisComputer(venueId);
  const computers = useComputers(venueId);
  const title = t('console.computers.title');
  if (here.isPending || computers.isPending) return <Screen level={2} title={title} status="loading" />;
  if (here.data === undefined || computers.data === undefined) {
    return <Screen level={2} title={title} status="error" onRetry={() => void Promise.all([here.refetch(), computers.refetch()])} />;
  }
  const mineId = here.data.computer?.deviceId ?? null;
  return (
    <Screen level={2} title={title}>
      <Stack gap={8}>
        <Notices here={here.data} canConfigure={canConfigure} />
        <ThisComputerSection venueId={venueId} here={here.data} />
        <Stack gap={4} divided>
          <Heading level={2}>{t('console.computers.enrolled')}</Heading>
          {computers.data.length === 0 ? <Text tone="muted">{t('console.computers.empty')}</Text> : null}
          {computers.data.map((computer) => (
            <ComputerRow key={computer.deviceId} venueId={venueId} computer={computer} isThisOne={computer.deviceId === mineId} />
          ))}
        </Stack>
        <AddComputerForm venueId={venueId} />
      </Stack>
    </Screen>
  );
}
