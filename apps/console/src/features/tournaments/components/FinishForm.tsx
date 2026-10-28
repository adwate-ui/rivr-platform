import { zodResolver } from '@hookform/resolvers/zod';
import { DEAL_METHODS, dealSchema } from '@rivr/contracts/tournaments';
import { useTournamentPayoutActions, useTournamentSeating, type DealOrder, type FinishFailure, type TournamentSeatRow, type VenueTournament } from '@rivr/db';
import { ZERO, type Paise } from '@rivr/domain/money';
import { dealAmounts, MOST_DEAL_PLAYERS } from '@rivr/domain/tournament';
import { formatMoney, t } from '@rivr/i18n';
import { ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text, LoadState } from '@rivr/ui';
import { ChipCountForm } from './ChipCountForm.tsx';
import { ConfirmButton } from './ConfirmButton.tsx';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

type DealValues = z.input<typeof dealSchema>;

/** What each player left takes by the deal as typed, against the prizes they would play for; none until every stack is whole chips. */
function dealPreview(values: unknown, prizes: readonly Paise[]): Paise[] | null {
  const read = dealSchema.safeParse(values);
  if (!read.success || prizes.length === 0) return null;
  return dealAmounts(read.data.method, read.data.stacks.map((stack) => stack.chips), read.data.stacks.map((_stack, index) => prizes[index] ?? ZERO));
}

interface DealFormProps {
  left: readonly TournamentSeatRow[];
  prizes: readonly Paise[];
  isBusy: boolean;
  onFinish: (deal: DealOrder) => void;
}

/** A deal among the players left (#121): ICM or chip-chop on their chips as counted, what each takes, then finish with it. */
function DealForm({ left, prizes, isBusy, onFinish }: DealFormProps) {
  const [resolver] = useState(() => zodResolver(dealSchema));
  const form = useForm<DealValues, unknown, z.output<typeof dealSchema>>({
    resolver, defaultValues: { method: 'icm', stacks: left.map((row) => ({ entryId: row.entryId, chips: '' })) },
  });
  const amounts = dealPreview(useWatch({ control: form.control }), prizes);
  return (
    <Stack gap={3}>
      <Text tone="muted">{t('console.tournaments.payouts.dealHint')}</Text>
      <Controller control={form.control} name="method" render={({ field }) => (
        <ChoiceChips label={t('console.tournaments.payouts.method')} mode="one" selected={[field.value]}
          options={DEAL_METHODS.map((method) => ({ value: method, label: t(`console.tournaments.payouts.methods.${method}`) }))}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
      )} />
      <Inline gap={4} align="end" wrap>
        {left.map((row, index) => (
          <Input key={row.entryId} {...form.register(`stacks.${index}.chips`)} label={t('console.tournaments.payouts.chipsOf', { name: row.fullName })}
            inputMode="numeric" autoComplete="off" />
        ))}
      </Inline>
      {Object.keys(form.formState.errors).length > 0 ? <ErrorMessage>{t('console.tournaments.payouts.invalidChips')}</ErrorMessage> : null}
      {amounts === null ? null : left.map((row, index) => (
        <Text key={row.entryId}>{t('console.tournaments.payouts.dealShare', { name: row.fullName, amount: formatMoney(amounts[index] ?? ZERO) })}</Text>
      ))}
      <Inline>
        <ConfirmButton variant="primary" label={t('console.tournaments.payouts.finishWithDeal')} confirm={t('console.tournaments.payouts.confirmDeal')}
          isBusy={isBusy} onConfirm={() => void form.handleSubmit((deal) => onFinish(deal))()} />
      </Inline>
    </Stack>
  );
}

interface FinishChoiceProps {
  left: readonly TournamentSeatRow[];
  /** Whether anyone has played: with nobody left, the last out wins. */
  hasRuns: boolean;
  isStarted: boolean;
  /** A satellite takes no deal: with more than one left, their chips place them (#519). */
  isSatellite: boolean;
  prizes: readonly Paise[];
  isBusy: boolean;
  onFinish: (deal: DealOrder | null) => void;
}

/** Played out with one player left, a deal among two to nine (a satellite's placed by chips), or why it cannot finish yet. */
function FinishChoice({ left, hasRuns, isStarted, isSatellite, prizes, isBusy, onFinish }: FinishChoiceProps) {
  if (!isStarted || !hasRuns || (left.length > MOST_DEAL_PLAYERS && !isSatellite)) return <Text tone="muted">{t('console.tournaments.payouts.notReady')}</Text>;
  if (left.length <= 1) {
    const only = left[0];
    return (
      <Stack gap={2}>
        <Text>{only === undefined ? t('console.tournaments.payouts.lastOut') : t('console.tournaments.payouts.playedOut', { name: only.fullName })}</Text>
        <Inline>
          <ConfirmButton variant="primary" label={t('console.tournaments.payouts.finish')} confirm={t('console.tournaments.payouts.confirmFinish')}
            isBusy={isBusy} onConfirm={() => onFinish(null)} />
        </Inline>
      </Stack>
    );
  }
  if (isSatellite) {
    return (
      <ChipCountForm key={left.map((row) => row.entryId).join()} left={left} hint={t('console.tournaments.payouts.satelliteChips')}
        label={t('console.tournaments.payouts.finishByChips')} confirm={t('console.tournaments.payouts.confirmByChips')} isBusy={isBusy}
        onCount={(stacks) => onFinish({ method: null, stacks })} />
    );
  }
  return <DealForm key={left.map((row) => row.entryId).join()} left={left} prizes={prizes} isBusy={isBusy} onFinish={onFinish} />;
}

interface FinishFormProps {
  venueId: string;
  tournament: VenueTournament;
  /** The prizes as things stand, first place first; none until the shares are set. */
  prizes: readonly Paise[];
}

/**
 * Finishing the tournament (#121, #149): played out when one player is left, or a deal among the two to
 * nine left. The database pays every place, the bounties left and the overlay, and writes League points.
 */
export function FinishForm({ venueId, tournament, prizes }: FinishFormProps) {
  const seating = useTournamentSeating(tournament.id);
  const { finish } = useTournamentPayoutActions(venueId, tournament.id);
  const [failure, setFailure] = useState<string | null>(null);
  if (seating.isPending) return <LoadState />;
  if (seating.data === undefined) {
    return (
      <LoadState isError errorText={t('console.tournaments.payouts.failures.unavailable')} onRetry={() => void seating.refetch()} />
    );
  }
  const left = seating.data.filter((row) => row.status === 'seated');
  const hasRuns = seating.data.some((row) => row.status === 'seated' || row.status === 'busted');
  const isSatellite = tournament.satelliteTargetId !== null;
  // A satellite takes no deal: too many left means more than its seats.
  const failureText = (error: FinishFailure) => isSatellite && error === 'players_left' ? t('console.tournaments.payouts.satellitePlayersLeft')
    : t(`console.tournaments.payouts.failures.${error}`);
  const run = (deal: DealOrder | null) => void finish.mutateAsync(deal).then((done) => setFailure(done.ok ? null : failureText(done.error)));
  return (
    <Stack gap={3}>
      <Heading level={3} variant="subsection">{t('console.tournaments.payouts.finishTitle')}</Heading>
      <FinishChoice left={left} hasRuns={hasRuns} isStarted={tournament.clock !== null} isSatellite={isSatellite}
        prizes={prizes} isBusy={finish.isPending} onFinish={run} />
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}
