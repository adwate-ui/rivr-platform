import { zodResolver } from '@hookform/resolvers/zod';
import { tvPairSchema } from '@rivr/contracts';
import { useTvActions, type TvFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Sheet, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import type { z } from 'zod';
import { ModeChips, RotationChips, TableChips, TV_FAILURE_COPY, useVenueTables } from './tvCopy.tsx';

interface PairTvFormProps {
  venueId: string;
  venueName: string;
  /** The practice venue: a TV paired there shows training figures, so the panel says so. */
  isPractice: boolean;
}

type PairValues = z.input<typeof tvPairSchema>;

/**
 * Its boards as its row has them (the owner, 22 Nov): what it shows, its main board, then what it turns to in between, in
 * the order pressed; the two make the boards in order. Then the tables of its call time board while that is among them.
 */
function BoardsAndTables({ control, venueId, isDisabled }: { control: Control<PairValues>; venueId: string; isDisabled: boolean }) {
  const tables = useVenueTables(venueId);
  const boards = useWatch({ control, name: 'boards' });
  const main = boards[0] ?? 'waitlist';
  return (
    <>
      <Controller control={control} name="boards" render={({ field }) => (
        <>
          <ModeChips label={t('console.tvs.boards')} value={main} isDisabled={isDisabled}
            onChange={(mode) => field.onChange([mode, ...field.value.slice(1).filter((board) => board !== mode)])} />
          <Stack gap={1}>
            <RotationChips label={t('console.tvs.turnsTo')} mode={main} value={field.value.slice(1)} isDisabled={isDisabled}
              onChange={(rotation) => field.onChange([main, ...rotation])} />
            <Text variant="small" tone="muted">{t('console.tvs.rotationHint')}</Text>
          </Stack>
        </>
      )} />
      {boards.includes('call_time') ? (
        <Controller control={control} name="tables" render={({ field }) => (
          <TableChips label={t('console.tvs.tables')} tables={tables} value={field.value} onChange={field.onChange} isDisabled={isDisabled} />
        )} />
      ) : null}
    </>
  );
}

/**
 * Pairs a TV by the six-digit code it shows, with a name, the boards it shows in order (the first its main one, the rest in
 * turn) and the tables of its call time board (the owner, 22 Nov), at the venue the console is on, in the panel at the side
 * (redesign RD-38). The TV picks up its login and boards on its next ask, a few seconds later, and joins the list. Paired,
 * it says so in a toast and closes; a code that is wrong stays open to be typed again.
 */
function PairTvSheet({ venueId, venueName, isPractice, onClose }: PairTvFormProps & { onClose: () => void }) {
  const { pair } = useTvActions(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<TvFailure | null>(null);
  const [resolver] = useState(() => zodResolver(tvPairSchema));
  const form = useForm<PairValues, unknown, z.output<typeof tvPairSchema>>({ resolver, defaultValues: { code: '', name: '', boards: ['waitlist'], tables: [] } });
  const submit = form.handleSubmit(async (values) => {
    // Tables matter only to the call time board.
    const paired = await pair.mutateAsync({ ...values, tables: values.boards.includes('call_time') ? values.tables : [] });
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
        <BoardsAndTables control={form.control} venueId={venueId} isDisabled={pair.isPending} />
        {failure === null ? null : <ErrorMessage>{t(TV_FAILURE_COPY[failure])}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}

/** Add a TV, in the TVs' title row: it opens the panel, a fresh one each time. */
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
