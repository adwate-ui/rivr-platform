import { zodResolver } from '@hookform/resolvers/zod';
import { payoutSharesSchema, sharePercentSchema } from '@rivr/contracts/tournaments';
import { useTournamentPayoutActions, type VenueTournament } from '@rivr/db';
import { MOST_PLACES } from '@rivr/domain/tournament';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { SaveRow, type SaveOutcome } from './SaveRow.tsx';

type SharesValues = z.input<typeof payoutSharesSchema>;

/** The shares as set, in percent; or a blank one for each of the template's places paid. */
function initialShares(tournament: VenueTournament): SharesValues {
  const set = tournament.payoutShares?.map((share) => String(share / 100));
  return { shares: (set ?? Array.from({ length: tournament.placesPaid ?? 1 }, () => '')).map((percent) => ({ percent })) };
}

/** What the typed shares add up to, in basis points; a share not yet a percent counts as nothing. */
function totalOf(shares: SharesValues['shares']): number {
  return shares.reduce((sum, share) => {
    const read = sharePercentSchema.safeParse(share.percent);
    return sum + (read.success ? read.data : 0);
  }, 0);
}

/**
 * Each paid place's share of the prize pool, as the floor sets them for this tournament (#121, question
 * #470): a place added or taken away at the end, and the shares adding up to exactly 100%.
 */
export function SharesForm({ venueId, tournament }: { venueId: string; tournament: VenueTournament }) {
  const { shares } = useTournamentPayoutActions(venueId, tournament.id);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [resolver] = useState(() => zodResolver(payoutSharesSchema));
  const form = useForm<SharesValues, unknown, z.output<typeof payoutSharesSchema>>({ resolver, defaultValues: initialShares(tournament) });
  const list = useFieldArray({ control: form.control, name: 'shares' });
  const typed = useWatch({ control: form.control, name: 'shares' });
  const save = form.handleSubmit(async (basisPoints) => {
    const done = await shares.mutateAsync(basisPoints);
    setOutcome(done.ok ? { ok: true, text: t('console.tournaments.payouts.sharesSaved') } : { ok: false, text: t(`console.tournaments.payouts.failures.${done.error}`) });
  });
  return (
    <Stack gap={3}>
      <Heading level={3} variant="subsection">{t('console.tournaments.payouts.placesPaid')}</Heading>
      <Text variant="small" tone="muted">{t('console.tournaments.payouts.sharesHint')}</Text>
      <Inline gap={4} align="end" wrap>
        {list.fields.map((field, index) => (
          <Input key={field.id} {...form.register(`shares.${index}.percent`)} label={t('console.tournaments.payouts.placeShare', { place: index + 1 })}
            inputMode="decimal" autoComplete="off" />
        ))}
      </Inline>
      <Inline gap={4} align="center" wrap>
        <Button variant="text" isDisabled={list.fields.length >= MOST_PLACES} onClick={() => list.append({ percent: '' })}>{t('console.tournaments.payouts.addPlace')}</Button>
        <Button variant="text" isDisabled={list.fields.length <= 1} onClick={() => list.remove(list.fields.length - 1)}>{t('console.tournaments.payouts.removePlace')}</Button>
        <Text>{t('console.tournaments.payouts.sharesTotal', { percent: String(totalOf(typed) / 100) })}</Text>
      </Inline>
      {Object.keys(form.formState.errors).length > 0 ? <ErrorMessage>{t('console.tournaments.payouts.notWhole')}</ErrorMessage> : null}
      <SaveRow isSaving={shares.isPending} onSave={() => void save()} outcome={outcome} />
    </Stack>
  );
}
