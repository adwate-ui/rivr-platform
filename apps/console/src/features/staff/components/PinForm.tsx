import { zodResolver } from '@hookform/resolvers/zod';
import { dealerPinSchema } from '@rivr/contracts';
import { useSetDealerPin, type DealerPinFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Sheet, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

const FAILURE_COPY: Readonly<Record<DealerPinFailure, MessageKey>> = {
  not_allowed: 'console.dealerPins.notAllowedAction',
  invalid: 'console.dealerPins.invalid',
  unavailable: 'console.dealerPins.unavailable',
};

interface PinSheetProps {
  venueId: string;
  staffId: string;
  name: string;
  /** Whether the dealer has a PIN already: the panel is then titled Change, else Set. */
  hasPin: boolean;
  onClose: () => void;
}

/**
 * Sets one dealer's PIN, which also unlocks a locked one, in the panel at the side (redesign RD-38). The PIN is typed
 * hidden and never shown again. Saved, it says so in a toast and closes; the caller draws it only while it is open.
 */
export function PinSheet({ venueId, staffId, name, hasPin, onClose }: PinSheetProps) {
  const setPin = useSetDealerPin(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<DealerPinFailure | null>(null);
  const [resolver] = useState(() => zodResolver(dealerPinSchema));
  const form = useForm<z.input<typeof dealerPinSchema>, unknown, z.output<typeof dealerPinSchema>>({ resolver, defaultValues: { pin: '' } });
  const submit = form.handleSubmit(async ({ pin }) => {
    const saved = await setPin.mutateAsync({ staffId, pin });
    setFailure(saved.ok ? null : saved.error);
    if (!saved.ok) return;
    toast(t('console.dealerPins.saved', { name }));
    onClose();
  });
  const pinField = form.register('pin');
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="primary" size="compact" aria-label={t('console.dealerPins.save', { name })} isLoading={setPin.isPending} onClick={() => void submit()}>
        {t('console.dealerPins.saveShort')}
      </Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={onClose} footer={footer} title={t(hasPin ? 'console.dealerPins.changeFor' : 'console.dealerPins.setFor', { name })}>
      <Stack gap={3}>
        <Input {...pinField} type="password" inputMode="numeric" maxLength={4} autoComplete="off" label={t('console.dealerPins.pin', { name })}
          hint={t('console.dealerPins.pinHint')} error={form.formState.errors.pin === undefined ? undefined : t('console.dealerPins.invalid')} />
        {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
