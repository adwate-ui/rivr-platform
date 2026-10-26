import { zodResolver } from '@hookform/resolvers/zod';
import { cageBuySchema, PURCHASES } from '@rivr/contracts/tournaments';
import { useCageMembers, useTournamentFloorActions, type CageMember, type VenueTournament } from '@rivr/db';
import type { Purchase } from '@rivr/domain/tournament';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

type BuyValues = z.input<typeof cageBuySchema>;

/** What a buy costs at this tournament: the add-on's own price, or the buy-in. */
function priceOf(tournament: VenueTournament, purchase: Purchase): bigint {
  return purchase === 'add_on' && tournament.addOn !== null ? tournament.addOn.price : tournament.buyIn;
}

interface MemberChoiceProps {
  form: UseFormReturn<BuyValues, unknown, z.output<typeof cageBuySchema>>;
  query: string;
  onQuery: (query: string) => void;
  members: { data?: CageMember[] | undefined; isError: boolean };
}

/** The member, found by name or mobile and chosen from what matches; or that nothing matches. */
function MemberChoice({ form, query, onQuery, members }: MemberChoiceProps) {
  return (
    <>
      <Input label={t('console.tournaments.findMember')} value={query} autoComplete="off"
        onChange={(event) => { onQuery(event.target.value); form.setValue('memberId', ''); }} />
      {query.trim().length >= 2 && members.data?.length === 0 ? <Text tone="muted">{t('console.tournaments.noMemberFound')}</Text> : null}
      {members.isError ? <ErrorMessage>{t('console.tournaments.buyFailures.unavailable')}</ErrorMessage> : null}
      <Controller control={form.control} name="memberId" render={({ field }) => (
        <ChoiceChips label={t('console.tournaments.player')} mode="one" selected={field.value === '' ? [] : [field.value]}
          options={(members.data ?? []).map((each) => ({ value: each.memberId, label: each.fullName }))}
          onChange={(chosen) => field.onChange(chosen[0] ?? '')} />
      )} />
    </>
  );
}

/**
 * A buy taken in cash at the cage (#118), for a cashier: the member found by name or mobile, the buy, and
 * the cash, once per request id until the server answers. The tournament's rules and the cage's checks
 * refuse what they must, and say why.
 */
export function CageBuyForm({ venueId, tournament }: { venueId: string; tournament: VenueTournament }) {
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [resolver] = useState(() => zodResolver(cageBuySchema));
  const form = useForm<BuyValues, unknown, z.output<typeof cageBuySchema>>({ resolver, defaultValues: { memberId: '', purchase: 'entry' } });
  const members = useCageMembers(venueId, query);
  const { cash } = useTournamentFloorActions(venueId, tournament.id);
  const [chosenMember, purchase] = useWatch({ control: form.control, name: ['memberId', 'purchase'] });
  const amount = formatMoney(priceOf(tournament, purchase));
  const take = form.handleSubmit(async (values) => {
    const done = await cash.mutateAsync({ ...values, requestId });
    const name = members.data?.find((each) => each.memberId === values.memberId)?.fullName ?? '';
    setOutcome(done.ok ? { ok: true, text: t('console.tournaments.taken', { name, purchase: t(`console.tournaments.purchases.${values.purchase}`) }) }
      : { ok: false, text: t(`console.tournaments.buyFailures.${done.error}`) });
    if (done.ok || done.error !== 'unavailable') setRequestId(crypto.randomUUID());
  });
  return (
    <Stack gap={4}>
      <Heading level={3} variant="subsection">{t('console.tournaments.cage')}</Heading>
      <MemberChoice form={form} query={query} onQuery={setQuery} members={members} />
      <Controller control={form.control} name="purchase" render={({ field }) => (
        <ChoiceChips label={t('console.tournaments.purchase')} mode="one" selected={[field.value]}
          options={PURCHASES.map((value) => ({ value, label: t(`console.tournaments.purchases.${value}`) }))}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
      )} />
      <Button variant="secondary" isDisabled={chosenMember === ''} isLoading={cash.isPending} onClick={() => void take()}>
        {t('console.tournaments.takeCash', { amount })}
      </Button>
      {outcome?.ok === true ? <Text>{outcome.text}</Text> : null}
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
