import { zodResolver } from '@hookform/resolvers/zod';
import { jackpotReversalSchema } from '@rivr/contracts';
import { useJackpotActions, type JackpotEvent, type JackpotFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { jackpotFailureText, whenText } from './jackpotCopy.ts';

/** Reverses one payout made in error, with a reason: the same amounts go back to the jackpot. */
export function ReverseForm({ venueId, payout }: { venueId: string; payout: JackpotEvent }) {
  const { reverse } = useJackpotActions(venueId);
  const [requestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<JackpotFailure | null>(null);
  const [resolver] = useState(() => zodResolver(jackpotReversalSchema));
  const form = useForm<z.input<typeof jackpotReversalSchema>, unknown, z.output<typeof jackpotReversalSchema>>({ resolver, defaultValues: { reason: '' } });
  const submit = form.handleSubmit(async ({ reason }) => {
    const reversed = await reverse.mutateAsync({ eventId: payout.eventId, reason, requestId });
    setFailure(reversed.ok ? null : reversed.error);
  });
  const reason = form.register('reason');
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end" wrap>
        <Input {...reason} label={t('console.jackpots.reason')} error={form.formState.errors.reason ? t('console.jackpots.invalidReason') : undefined} />
        <Button variant="secondary" isLoading={reverse.isPending} onClick={() => void submit()}>
          {t('console.jackpots.reverse', { when: whenText(payout) })}
        </Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{jackpotFailureText(failure)}</ErrorMessage>}
    </Stack>
  );
}
