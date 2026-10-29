import { useApproveWaitlistRequest, useFloorWaitlistActions, type WaitlistFailure, type WaitlistRequest } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { ENTRY_FAILURE_COPY } from './failureCopy.ts';

/**
 * A game's joins from the app, oldest first (#633): the floor approves each onto the list, in the order the member asked,
 * or removes it. Nothing when none wait.
 */
export function RequestList({ venueId, requests }: { venueId: string; requests: readonly WaitlistRequest[] }) {
  const approve = useApproveWaitlistRequest();
  const { remove } = useFloorWaitlistActions(venueId);
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  if (requests.length === 0) return null;
  const act = async (done: Promise<{ ok: true } | { ok: false; error: WaitlistFailure }>) => {
    const outcome = await done;
    setFailure(outcome.ok ? null : outcome.error);
  };
  return (
    <Stack gap={2}>
      <Heading level={3}>{t('console.waitlist.requests')}</Heading>
      {requests.map((request) => (
        <Inline key={request.entryId} gap={4} justify="between" align="center">
          <Text>{t('console.waitlist.requestLine', { name: request.fullName, time: formatTime(new Date(request.joinedAt)) })}</Text>
          <Inline gap={2}>
            <Button variant="primary" isLoading={approve.isPending} aria-label={t('console.waitlist.approve', { name: request.fullName })}
              onClick={() => void act(approve.mutateAsync(request.entryId))}>
              {t('console.waitlist.approveShort')}
            </Button>
            <Button variant="text" isLoading={remove.isPending} aria-label={t('console.waitlist.remove', { name: request.fullName })}
              onClick={() => void act(remove.mutateAsync(request.entryId))}>
              {t('console.waitlist.removeShort')}
            </Button>
          </Inline>
        </Inline>
      ))}
      {failure === null ? null : <ErrorMessage>{t(ENTRY_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
