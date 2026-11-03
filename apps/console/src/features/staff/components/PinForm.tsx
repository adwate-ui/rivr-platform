import { zodResolver } from '@hookform/resolvers/zod';
import { dealerPinSchema } from '@rivr/contracts';
import { useSetDealerPin, type DealerPinFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, StatusMessage, Text } from '@rivr/ui';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

const FAILURE_COPY: Readonly<Record<DealerPinFailure, MessageKey>> = {
  not_allowed: 'console.dealerPins.notAllowedAction',
  invalid: 'console.dealerPins.invalid',
  unavailable: 'console.dealerPins.unavailable',
};

/** Sets one dealer's PIN, which also unlocks a locked one. The PIN is typed hidden and never shown again. */
export function PinForm({ venueId, staffId, name }: { venueId: string; staffId: string; name: string }) {
  const setPin = useSetDealerPin(venueId);
  const [failure, setFailure] = useState<DealerPinFailure | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [resolver] = useState(() => zodResolver(dealerPinSchema));
  const form = useForm<z.input<typeof dealerPinSchema>, unknown, z.output<typeof dealerPinSchema>>({ resolver, defaultValues: { pin: '' } });
  const submit = form.handleSubmit(async ({ pin }) => {
    const saved = await setPin.mutateAsync({ staffId, pin });
    setFailure(saved.ok ? null : saved.error);
    setIsSaved(saved.ok);
    if (saved.ok) form.reset();
  });
  const pinField = form.register('pin', { onChange: () => setIsSaved(false) });
  // The rule, or what is wrong, sits under the row and is read with the field.
  const noteId = useId();
  const isWrong = form.formState.errors.pin !== undefined;
  return (
    <Stack gap={2}>
      {/* The console's field beside its button (console v3): one height, centred on one line; the rule under them both. */}
      <Inline gap={3} wrap>
        <Input {...pinField} variant="subtle" type="password" inputMode="numeric" maxLength={4} autoComplete="off" label={t('console.dealerPins.pin', { name })}
          aria-describedby={noteId} aria-invalid={isWrong || undefined} />
        <Button variant="primary" size="compact" aria-label={t('console.dealerPins.save', { name })} isLoading={setPin.isPending} onClick={() => void submit()}>
          {t('console.dealerPins.saveShort')}
        </Button>
      </Inline>
      {isWrong ? <ErrorMessage id={noteId}>{t('console.dealerPins.invalid')}</ErrorMessage>
        : <Text id={noteId} variant="small" tone="muted">{t('console.dealerPins.pinHint')}</Text>}
      <StatusMessage>{isSaved ? t('console.dealerPins.saved', { name }) : null}</StatusMessage>
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
