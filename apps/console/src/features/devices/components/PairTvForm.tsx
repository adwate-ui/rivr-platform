import { zodResolver } from '@hookform/resolvers/zod';
import { tvPairSchema } from '@rivr/contracts';
import { useTvActions, type TvFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ModeChips, TV_FAILURE_COPY } from './tvCopy.tsx';

interface PairTvFormProps {
  venueId: string;
  venueName: string;
  /** The practice venue: a TV paired there shows training figures, so the form says so. */
  isPractice: boolean;
}

/**
 * Pairs a TV by the six-digit code it shows, with a name and what it shows, at the venue the console
 * is on. The TV picks up its login and mode on its next ask, a few seconds later, and joins the list.
 */
export function PairTvForm({ venueId, venueName, isPractice }: PairTvFormProps) {
  const { pair } = useTvActions(venueId);
  const [failure, setFailure] = useState<TvFailure | null>(null);
  const [pairedName, setPairedName] = useState<string | null>(null);
  const [resolver] = useState(() => zodResolver(tvPairSchema));
  const form = useForm<z.input<typeof tvPairSchema>, unknown, z.output<typeof tvPairSchema>>({
    resolver, defaultValues: { code: '', name: '', mode: 'waitlist' },
  });
  const submit = form.handleSubmit(async (values) => {
    const paired = await pair.mutateAsync(values);
    setFailure(paired.ok ? null : paired.error);
    setPairedName(paired.ok ? values.name : null);
    if (paired.ok) form.reset();
  });
  const errors = form.formState.errors;
  const codeField = form.register('code');
  const nameField = form.register('name');
  return (
    <Stack gap={4}>
      <Text tone="muted">{t(isPractice ? 'console.tvs.practiceVenue' : 'console.tvs.venue', { venue: venueName })}</Text>
      <Inline gap={3} align="start" wrap>
        <Input {...codeField} label={t('console.tvs.code')} hint={t('console.tvs.codeHint')} inputMode="numeric" autoComplete="off"
          error={errors.code ? t('console.tvs.invalidCode') : undefined} />
        <Input {...nameField} label={t('console.tvs.name')} hint={t('console.tvs.nameHint')} autoComplete="off"
          error={errors.name ? t('console.tvs.invalidName') : undefined} />
      </Inline>
      <Controller control={form.control} name="mode" render={({ field }) => (
        <ModeChips label={t('console.tvs.mode')} value={field.value} onChange={field.onChange} isDisabled={pair.isPending} />
      )} />
      <Inline gap={3}>
        <Button variant="secondary" isLoading={pair.isPending} onClick={() => void submit()}>{t('console.tvs.pair')}</Button>
      </Inline>
      {pairedName === null ? null : <Text>{t('console.tvs.pairedNow', { name: pairedName })}</Text>}
      {failure === null ? null : <ErrorMessage>{t(TV_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
