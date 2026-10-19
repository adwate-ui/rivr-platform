import { useHandQueue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, OfflineBanner } from '@rivr/ui';

function countText(count: number, one: Parameters<typeof t>[0], many: Parameters<typeof t>[0]): string {
  return count === 1 ? t(one) : t(many, { count });
}

/**
 * The tablet's queue of hands (#43), as the prototype has it: offline, a slim banner with how many
 * hands it holds ("Offline. 3 hands queued."); back online, that it is sending them, then that they
 * reached the floor ("3 queued hands sent to the floor."), until the next hand is logged. Hands the
 * database refused for good are counted for a floor supervisor.
 */
export function HandQueueBanner() {
  const { pending, refused, held: heldOffline, sent } = useHandQueue();
  const sending = heldOffline > 0 && pending > 0 ? countText(pending, 'tablet.queue.sendingOne', 'tablet.queue.sending') : undefined;
  const landed = sent === null ? undefined : countText(sent, 'tablet.queue.sentOne', 'tablet.queue.sent');
  const held = countText(pending, 'tablet.queue.queuedOne', 'tablet.queue.queued');
  const refusal = refused === 0 ? null : countText(refused, 'tablet.queue.refusedOne', 'tablet.queue.refused');
  return (
    <>
      <OfflineBanner message={held} onlineMessage={sending ?? landed} />
      {refusal === null ? null : <ErrorMessage>{refusal}</ErrorMessage>}
    </>
  );
}
