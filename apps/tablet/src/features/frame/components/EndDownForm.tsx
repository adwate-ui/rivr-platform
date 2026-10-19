import { zodResolver } from '@hookform/resolvers/zod';
import { dropBoxCountSchema } from '@rivr/contracts';
import { useDownActions, useHandQueue, type DownCount } from '@rivr/db';
import { fromRupees, ZERO } from '@rivr/domain/money';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Keypad, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

interface EndDownFormProps {
  /** The down is over: its count, what its hands logged and the variance. */
  onEnded: (count: DownCount) => void;
  onCancel: () => void;
}

/**
 * End of down (#44): the dealer counts the drop box and enters what it holds; the down closes with
 * the variance against the rake and drops its hands logged, and the next dealer signs in. While hands
 * wait on the tablet (#43) the down does not close: its count must include them.
 */
export function EndDownForm({ onEnded, onCancel }: EndDownFormProps) {
  const { end } = useDownActions();
  const { pending } = useHandQueue();
  const [isFailed, setIsFailed] = useState(false);
  const [resolver] = useState(() => zodResolver(dropBoxCountSchema));
  const form = useForm<z.input<typeof dropBoxCountSchema>, unknown, z.output<typeof dropBoxCountSchema>>({ resolver, defaultValues: { count: '' } });
  const typed = useWatch({ control: form.control, name: 'count' });
  const count = typed === '' ? ZERO : fromRupees(BigInt(typed));
  const close = form.handleSubmit(async () => {
    const ended = await end.mutateAsync(count);
    setIsFailed(!ended.ok);
    if (ended.ok) onEnded(ended.value);
  });
  // The keypad never starts an amount with a nought: nothing typed is an empty box.
  const submit = async () => {
    if (form.getValues('count') === '') form.setValue('count', '0');
    await close();
  };
  const waiting = pending === 0 ? null : pending === 1 ? t('tablet.endOfDown.queuedOne') : t('tablet.endOfDown.queued', { count: pending });
  return (
    <Stack gap={6}>
      <Heading level={1}>{t('tablet.endOfDown.title')}</Heading>
      <Text>{t('tablet.endOfDown.intro')}</Text>
      {form.formState.errors.count ? <ErrorMessage>{t('tablet.endOfDown.notChips', { amount: formatMoney(count) })}</ErrorMessage> : null}
      {isFailed ? <ErrorMessage>{t('tablet.dealerSignIn.endDownFailed')}</ErrorMessage> : null}
      {waiting === null ? null : <ErrorMessage>{waiting}</ErrorMessage>}
      <Controller control={form.control} name="count" render={({ field }) => (
        <Keypad label={t('tablet.endOfDown.count')} value={field.value} onChange={field.onChange} isDisabled={end.isPending} />
      )} />
      <Inline gap={3}>
        <Button variant="primary" size="large" isLoading={end.isPending} isDisabled={waiting !== null} onClick={() => void submit()}>
          {t('tablet.endOfDown.close')}
        </Button>
        <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}

/** What the last down closed with, above the next dealer's sign-in: the count, what was logged, and the variance. */
export function DownCountLine({ count }: { count: DownCount }) {
  return (
    <Text>{t('tablet.endOfDown.summary', { box: formatMoney(count.dropBox), logged: formatMoney(count.logged), variance: formatMoney(count.variance) })}</Text>
  );
}
