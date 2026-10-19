import { zodResolver } from '@hookform/resolvers/zod';
import { devicePairSchema } from '@rivr/contracts';
import { usePairDevice, type PairFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Input, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

const FAILURE_COPY: Readonly<Record<PairFailure, MessageKey>> = {
  wrong_code: 'tablet.pairing.wrongCode',
  too_many: 'tablet.pairing.tooMany',
  unavailable: 'tablet.pairing.unavailable',
};

/**
 * Pairs the tablet (#41): a floor manager adds it on the console and reads out a six-digit code,
 * which signs the tablet in as itself. The frame then shows the tablet's screens.
 */
export function PairScreen() {
  const pair = usePairDevice();
  const [failure, setFailure] = useState<PairFailure | null>(null);
  const [resolver] = useState(() => zodResolver(devicePairSchema));
  const form = useForm<z.input<typeof devicePairSchema>, unknown, z.output<typeof devicePairSchema>>({
    resolver, defaultValues: { code: '' },
  });
  const submit = form.handleSubmit(async ({ code }) => {
    const paired = await pair.mutateAsync(code);
    setFailure(paired.ok ? null : paired.error);
  });
  const shown = form.formState.errors.code ? 'wrong_code' : failure;
  // Digits only: a code typed with a space or a dash still pairs.
  const codeField = form.register('code', { setValueAs: (value: string) => value.replace(/\D/g, '').slice(0, 6) });
  return (
    <Screen title={t('tablet.pairing.title')}>
      <Stack gap={6}>
        <Text>{t('tablet.pairing.intro')}</Text>
        <Input {...codeField} variant="code" label={t('tablet.pairing.code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
        <Button variant="primary" isLoading={pair.isPending} onClick={() => void submit()}>{t('tablet.pairing.pair')}</Button>
        {shown === null ? null : <ErrorMessage>{t(FAILURE_COPY[shown])}</ErrorMessage>}
      </Stack>
    </Screen>
  );
}
