import { useMemberHoursPlayed } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { DetailRow, LoadState, Stack } from '@rivr/ui';
import { MemberVisits } from './MemberVisits.tsx';

/** The visits History shows at first; Show earlier adds as many again. */
const LAST_VISITS = 10;

/** Hours played since the member's hours were last reset, once read. */
function HoursPlayed({ venueId, memberId }: { venueId: string; memberId: string }) {
  const hours = useMemberHoursPlayed(venueId, memberId);
  if (hours.isError) return <LoadState isError onRetry={() => void hours.refetch()} />;
  if (hours.data === undefined) return <LoadState />;
  const value = hours.data === null ? t('console.todaysPlayers.none') : formatDuration(hours.data * 60);
  return <DetailRow size="small" isLast label={t('console.members.visitHistory.hoursPlayed')} value={value} />;
}

/**
 * A member's History, opened from the Door (#1073, the owner, 18 Nov): their hours played since their hours were last
 * reset, as the Members list counts them, then their last visits with the tables, time played and why they left.
 */
export function MemberHistory({ venueId, memberId }: { venueId: string; memberId: string }) {
  return (
    <Stack gap={5}>
      <HoursPlayed venueId={venueId} memberId={memberId} />
      <MemberVisits venueId={venueId} memberId={memberId} pageSize={LAST_VISITS} />
    </Stack>
  );
}
