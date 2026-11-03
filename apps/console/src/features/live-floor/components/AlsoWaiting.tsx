import { useStaffQueueCounts } from '@rivr/db';
import { useWaitingSpins } from '@rivr/db/spin';
import { t, type MessageKey } from '@rivr/i18n';
import { DetailRow, Divider, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

interface Line {
  readonly label: MessageKey;
  readonly count: number;
  readonly href: string;
}

/** The lines with something waiting, each a way to its screen; nothing when none waits. */
function Lines({ venueId, spins }: { venueId: string; spins: number }) {
  const counts = useStaffQueueCounts(venueId).data ?? {};
  const navigate = useNavigate();
  const lines: Line[] = [
    { label: 'console.floor.requests.spins', count: spins, href: '/spin-wheel' },
    { label: 'console.floor.requests.tournament', count: counts['tournamentInterest'] ?? 0, href: '/tournament-interest' },
    { label: 'console.floor.requests.kyc', count: counts['kycReview'] ?? 0, href: '/kyc-review' },
    { label: 'console.floor.requests.feedback', count: counts['feedback'] ?? 0, href: '/feedback' },
  ];
  const waiting = lines.filter((line) => line.count > 0);
  if (waiting.length === 0) return null;
  return (
    <Stack gap={3}>
      <Divider />
      <Text variant="caption" tone="muted">{t('console.floor.requests.alsoWaiting')}</Text>
      <Stack gap={0}>
        {waiting.map((line) => (
          <DetailRow key={line.href} label={t(line.label)} value={String(line.count)} size="small" valueTone="muted"
            onOpen={() => void navigate({ href: line.href })} />
        ))}
      </Stack>
    </Stack>
  );
}

/** The spins waiting, read only by staff who run the wheel. */
function WithSpins({ venueId }: { venueId: string }) {
  return <Lines venueId={venueId} spins={useWaitingSpins(venueId).data?.length ?? 0} />;
}

/**
 * Under the requests (console v3): what else waits tonight, each line opening its screen: spins to do, tournament
 * sign-ups, KYC checks and feedback tickets, for the staff who handle them. Old addresses redirect to their new tabs.
 */
export function AlsoWaiting({ venueId, permissions }: { venueId: string; permissions: readonly string[] }) {
  return permissions.includes('promotions.manage') ? <WithSpins venueId={venueId} /> : <Lines venueId={venueId} spins={0} />;
}
