import { useStaffVenue, type ControlFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, Grid, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CONTROL_FAILURE_COPY } from './controlCopy.ts';
import { EngagedControls } from './EngagedControls.tsx';
import { EngageForm } from './EngageForm.tsx';

type Outcome = 'engaged' | 'released' | 'awaiting_second' | ControlFailure | null;

function OutcomeLine({ outcome }: { outcome: Outcome }) {
  if (outcome === null) return null;
  if (outcome === 'engaged') return <Text>{t('console.killSwitch.engaged')}</Text>;
  if (outcome === 'released') return <Text>{t('console.killSwitch.released')}</Text>;
  if (outcome === 'awaiting_second') return <Text>{t('console.killSwitch.awaitingSecond')}</Text>;
  return <ErrorMessage>{t(CONTROL_FAILURE_COPY[outcome])}</ErrorMessage>;
}

/**
 * Kill switch (#27; features "Kill switch"; additions flow 15), for super admins: what is engaged now,
 * each released with a reason (a venue freeze by a second super admin), and a new control engaged at
 * any level with a reason. Every app shows the venue-freeze banner within seconds; the owner is alerted.
 */
export function KillSwitchScreen() {
  const staff = useStaffVenue();
  const [outcome, setOutcome] = useState<Outcome>(null);
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.killSwitch.title');
  if (!staff.venue.permissions.includes('control.engage')) return <Screen title={title} status="error" errorText={t('console.killSwitch.notAllowed')} />;
  return (
    <Screen title={title}>
      <Stack gap={6}>
        <OutcomeLine outcome={outcome} />
        <Grid columns={2} gap={8}>
          <EngagedControls venueId={staff.venue.venueId} onOutcome={setOutcome} />
          <EngageForm venueId={staff.venue.venueId} onOutcome={setOutcome} />
        </Grid>
      </Stack>
    </Screen>
  );
}
