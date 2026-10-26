import { zodResolver } from '@hookform/resolvers/zod';
import { leagueSeasonSchema } from '@rivr/contracts';
import { useSaveLeagueSeason, type LeagueSeason } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import type { z } from 'zod';

type SeasonValues = z.input<typeof leagueSeasonSchema>;

const EMPTY: SeasonValues = { name: '', firstMonth: '', lastMonth: '' };

/** What is wrong with the last month: not a month, or before the first. */
function lastMonthError(errors: FieldErrors<SeasonValues>): string | undefined {
  if (errors.lastMonth === undefined) return undefined;
  return t(errors.lastMonth.message === 'before_first' ? 'console.league.lastBeforeFirst' : 'console.league.invalidMonth');
}

/**
 * Adds a League season, or changes the one chosen (`season`): a name and its first and last months, typed
 * as `2026-11`. `onDone` runs once a change is saved or cancelled.
 */
export function SeasonForm({ venueId, season, onDone }: { venueId: string; season: LeagueSeason | null; onDone: () => void }) {
  const save = useSaveLeagueSeason(venueId);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const [resolver] = useState(() => zodResolver(leagueSeasonSchema));
  const defaults = season === null ? EMPTY : { name: season.name, firstMonth: season.firstMonth.slice(0, 7), lastMonth: season.lastMonth.slice(0, 7) };
  const form = useForm<SeasonValues, unknown, z.output<typeof leagueSeasonSchema>>({ resolver, defaultValues: defaults });
  const errors = form.formState.errors;
  const fields = { name: form.register('name'), firstMonth: form.register('firstMonth'), lastMonth: form.register('lastMonth') };
  const submit = form.handleSubmit(async (values) => {
    const saved = await save.mutateAsync({ ...values, seasonId: season?.id ?? null });
    setOutcome(saved.ok ? { ok: true, text: t('console.league.saved', { name: values.name }) } : { ok: false, text: t(`console.league.failures.${saved.error}`) });
    if (saved.ok && season === null) form.reset(EMPTY);
    if (saved.ok && season !== null) onDone();
  });
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{season === null ? t('console.league.newSeason') : t('console.league.editSeason', { name: season.name })}</Heading>
      <Input {...fields.name} label={t('console.league.name')} autoComplete="off" error={errors.name ? t('console.league.invalidName') : undefined} />
      <Inline gap={4} align="start" wrap>
        <Input {...fields.firstMonth} label={t('console.league.firstMonth')} hint={t('console.league.monthHint')} autoComplete="off"
          error={errors.firstMonth ? t('console.league.invalidMonth') : undefined} />
        <Input {...fields.lastMonth} label={t('console.league.lastMonth')} hint={t('console.league.monthHint')} autoComplete="off"
          error={lastMonthError(errors)} />
      </Inline>
      <Inline gap={4} align="center">
        <Button variant="primary" isLoading={save.isPending} onClick={() => void submit()}>{t('console.league.save')}</Button>
        {season === null ? null : <Button variant="text" onClick={onDone}>{t('console.league.cancel')}</Button>}
        {outcome?.ok === true ? <Text>{outcome.text}</Text> : null}
      </Inline>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
