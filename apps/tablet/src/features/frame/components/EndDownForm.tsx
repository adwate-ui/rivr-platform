import { useDownActions, useHandQueue } from '@rivr/db';
import { ZERO } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

interface EndDownFormProps {
  /** The down is over: the next dealer signs in. */
  onEnded: () => void;
  onCancel: () => void;
}

/**
 * End of down (#44): the dealer hands the table over and the next dealer signs in. The tablet asks for no drop-box count
 * (owner, 29 Oct, #630): nothing tracks money, so the down closes with nothing counted. While hands wait on the tablet
 * (#43) the down does not close.
 */
export function EndDownForm({ onEnded, onCancel }: EndDownFormProps) {
  const { end } = useDownActions();
  const { pending } = useHandQueue();
  const [isFailed, setIsFailed] = useState(false);
  const close = async () => {
    const ended = await end.mutateAsync(ZERO);
    setIsFailed(!ended.ok);
    if (ended.ok) onEnded();
  };
  const waiting = pending === 0 ? null : pending === 1 ? t('tablet.endOfDown.queuedOne') : t('tablet.endOfDown.queued', { count: pending });
  return (
    <Stack gap={6}>
      <Heading level={1}>{t('tablet.endOfDown.title')}</Heading>
      <Text>{t('tablet.endOfDown.intro')}</Text>
      {isFailed ? <ErrorMessage>{t('tablet.dealerSignIn.endDownFailed')}</ErrorMessage> : null}
      {waiting === null ? null : <ErrorMessage>{waiting}</ErrorMessage>}
      <Inline gap={3}>
        <Button variant="primary" size="large" isLoading={end.isPending} isDisabled={waiting !== null} onClick={() => void close()}>
          {t('tablet.endOfDown.close')}
        </Button>
        <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}
