import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { TallyDayFile } from './TallyDayFile.tsx';
import { TallyLedgers } from './TallyLedgers.tsx';

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
// The club's day turns over at 06:00 IST, so the last one that has ended began the day before 6 hours ago.
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Tally (#96; tech plan item 16): a club day's vouchers as a file Tally imports, and which Tally ledger
 * each money account posts to. For treasury managers; the practice venue is never exported.
 */
export function TallyScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.tally.title');
  const { permissions, venueId, isPractice } = staff.venue;
  if (!permissions.includes('treasury.manage')) return <Screen title={title} status="error" errorText={t('console.tally.notAllowed')} />;
  if (isPractice) return <Screen title={title} status="error" errorText={t('console.tally.practice')} />;
  const now = new Date();
  const yesterday = IST_DAY.format(new Date(now.getTime() - SIX_HOURS_MS - DAY_MS));
  return (
    <Screen title={title}>
      {/* One above the other: the ledgers' table needs the width for its account codes. */}
      <Stack gap={8}>
        <TallyDayFile venueId={venueId} yesterday={yesterday} />
        <TallyLedgers venueId={venueId} />
      </Stack>
    </Screen>
  );
}
