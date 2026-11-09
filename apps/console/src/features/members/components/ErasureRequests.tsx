import { useMemberErasureRequests } from '@rivr/db';
import { formatDayMonth, t } from '@rivr/i18n';
import { Box, DetailRow, Heading, LoadState, Stack } from '@rivr/ui';

/**
 * The members who asked to delete their account (#813, decision 0574), oldest first. Each opens the record, where Erasure on
 * request completes it with its usual checks. Nothing shows while none wait.
 */
export function ErasureRequests({ venueId, onOpen }: { venueId: string; onOpen: (memberId: string) => void }) {
  const requests = useMemberErasureRequests(venueId);
  if (requests.isError) return <LoadState isError onRetry={() => void requests.refetch()} />;
  if (requests.data === undefined || requests.data.length === 0) return null;
  const lastIndex = requests.data.length - 1;
  return (
    <Stack gap={2}>
      <Heading level={2}>{t('console.members.erasureRequests')}</Heading>
      <Box>
        {requests.data.map((request, index) => (
          <DetailRow key={request.memberId} label={t('console.members.erasureRequest', { name: request.fullName, date: formatDayMonth(new Date(request.requestedAt)) })}
            onOpen={() => onOpen(request.memberId)} isLast={index === lastIndex} />
        ))}
      </Box>
    </Stack>
  );
}
