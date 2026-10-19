import { useHandQueue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, OfflineBanner, Stack } from '@rivr/ui';

function countText(count: number, one: Parameters<typeof t>[0], many: Parameters<typeof t>[0]): string {
  return count === 1 ? t(one) : t(many, { count });
}

/**
 * The tablet's queue of hands (#43), as the prototype has it: offline, a slim banner with how many
 * hands it holds ("Offline. 3 hands queued."); back online, that it is sending them, then that they
 * reached the floor ("3 queued hands sent to the floor."), until the next hand is logged. Hands and
 * high-hand claims the database refused for good are listed for the floor, who clears them once seen.
 */
export function HandQueueBanner() {
  const { queued, refusedHands, refusedClaims, held: heldOffline, sent, clearRefused } = useHandQueue();
  const sending = heldOffline > 0 && queued.length > 0 ? countText(queued.length, 'tablet.queue.sendingOne', 'tablet.queue.sending') : undefined;
  const landed = sent === null ? undefined : countText(sent, 'tablet.queue.sentOne', 'tablet.queue.sent');
  const held = countText(queued.length, 'tablet.queue.queuedOne', 'tablet.queue.queued');
  const refusals = [
    ...(refusedHands === 0 ? [] : [countText(refusedHands, 'tablet.queue.refusedOne', 'tablet.queue.refused')]),
    ...refusedClaims.map((claim) => t('tablet.queue.claimRefused', { seat: claim.seat })),
  ];
  const seen = t('tablet.queue.seen');
  return (
    <>
      <OfflineBanner message={held} onlineMessage={sending ?? landed} />
      {refusals.length === 0 ? null : (
        <Inline gap={3} align="center">
          <Stack gap={1}>{refusals.map((line, index) => <ErrorMessage key={index}>{line}</ErrorMessage>)}</Stack>
          <Button variant="text" onClick={() => void clearRefused()}>{seen}</Button>
        </Inline>
      )}
    </>
  );
}
