import { zodResolver } from '@hookform/resolvers/zod';
import { tvPairSchema } from '@rivr/contracts';
import { useTvActions, type TvFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Sheet, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ModeChips, TV_FAILURE_COPY } from './tvCopy.tsx';

interface PairTvFormProps {
  venueId: string;
  venueName: string;
  /** The practice venue: a TV paired there shows training figures, so the panel says so. */
  isPractice: boolean;
}

/**
 * Pairs a TV by the six-digit code it shows, with a name and what it shows, at the venue the console is on, in the panel
 * at the side (redesign RD-38). The TV picks up its login and mode on its next ask, a few seconds later, and joins the
 * list. Paired, it says so in a toast and closes; a code that is wrong stays open to be typed again.
 */
function PairTvSheet({ venueId, venueName, isPractice, onClose }: PairTvFormProps & { onClose: () => void }) {
  const { pair } = useTvActions(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<TvFailure | null>(null);
  const [resolver] = useState(() => zodResolver(tvPairSchema));
  const form = useForm<z.input<typeof tvPairSchema>, unknown, z.output<typeof tvPairSchema>>({ resolver, defaultValues: { code: '', name: '', mode: 'waitlist' } });
  const submit = form.handleSubmit(async (values) => {
    const paired = await pair.mutateAsync(values);
    setFailure(paired.ok ? null : paired.error);
    if (!paired.ok) return;
    toast(t('console.tvs.pairedNow', { name: values.name }));
    onClose();
  });
  const errors = form.formState.errors;
  const fields = { code: form.register('code'), name: form.register('name') };
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={pair.isPending} onClick={() => void submit()}>{t('console.tvs.pair')}</Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={onClose} footer={footer} title={t('console.tvs.pairTitle')}>
      <Stack gap={4}>
        <Text tone="muted">{t(isPractice ? 'console.tvs.practiceVenue' : 'console.tvs.venue', { venue: venueName })}</Text>
        <Input {...fields.code} label={t('console.tvs.code')} hint={t('console.tvs.codeHint')} inputMode="numeric" autoComplete="off"
          error={errors.code ? t('console.tvs.invalidCode') : undefined} />
        <Input {...fields.name} label={t('console.tvs.name')} hint={t('console.tvs.nameHint')} autoComplete="off"
          error={errors.name ? t('console.tvs.invalidName') : undefined} />
        <Controller control={form.control} name="mode" render={({ field }) => (
          <ModeChips label={t('console.tvs.mode')} value={field.value} onChange={field.onChange} isDisabled={pair.isPending} />
        )} />
        {failure === null ? null : <ErrorMessage>{t(TV_FAILURE_COPY[failure])}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}

/** Add a TV, in the TVs' title row: it opens the panel, a fresh one each time. Not "Pair a TV", which opens the pairing window (#325). */
export function PairTvForm(props: PairTvFormProps) {
  const [opened, setOpened] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="primary" size="compact" onClick={() => { setOpened(opened + 1); setIsOpen(true); }}>{t('console.tvs.pairOpen')}</Button>
      {isOpen ? <PairTvSheet key={opened} {...props} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
