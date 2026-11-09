import { useStaffVenue, type ControlFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, Screen, Stack, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { CONTROL_FAILURE_COPY } from './controlCopy.ts';
import { EngagedControls } from './EngagedControls.tsx';
import { EngageForm } from './EngageForm.tsx';
import { PastControls } from './PastControls.tsx';

const DONE_COPY = {
  engaged: 'console.killSwitch.engaged',
  released: 'console.killSwitch.released',
  awaiting_second: 'console.killSwitch.awaitingSecond',
} as const;
type Done = keyof typeof DONE_COPY;
type Outcome = Done | ControlFailure | null;

const isDone = (outcome: Outcome): outcome is Done => outcome !== null && outcome in DONE_COPY;

/** What the last engage or release did, read out as it appears (F1-23), or why it was refused. */
function OutcomeLine({ outcome }: { outcome: Outcome }) {
  return (
    <>
      <StatusMessage>{isDone(outcome) ? t(DONE_COPY[outcome]) : null}</StatusMessage>
      {outcome === null || isDone(outcome) ? null : <ErrorMessage>{t(CONTROL_FAILURE_COPY[outcome])}</ErrorMessage>}
    </>
  );
}

/**
 * Kill switch (#27; features "Kill switch"; additions flow 15), for super admins: what is engaged now,
 * each released with a reason (a venue freeze by a second super admin), and a new control engaged at
 * any level with a reason, and what has been released. Every app shows the venue-freeze banner within seconds; the owner is alerted.
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
      <Stack gap={8}>
        <OutcomeLine outcome={outcome} />
        <EngagedControls venueId={staff.venue.venueId} onOutcome={setOutcome} />
        <EngageForm venueId={staff.venue.venueId} onOutcome={setOutcome} />
        <PastControls venueId={staff.venue.venueId} />
      </Stack>
    </Screen>
  );
}
