import { zodResolver } from '@hookform/resolvers/zod';
import { dealerPinEntrySchema } from '@rivr/contracts';
import { useDownActions, useTabletDealers, type DealerSignInFailure, type TabletDealer } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, PinPad, Screen, Stack } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { signInFailureText } from './signInCopy.ts';

/** The chosen dealer's PIN pad and Sign in: the right PIN starts their down at this table. */
function DealerPin({ dealer }: { dealer: TabletDealer }) {
  const { signIn } = useDownActions();
  const [failure, setFailure] = useState<DealerSignInFailure | null>(null);
  const [resolver] = useState(() => zodResolver(dealerPinEntrySchema));
  const form = useForm<z.input<typeof dealerPinEntrySchema>, unknown, z.output<typeof dealerPinEntrySchema>>({ resolver, defaultValues: { pin: '' } });
  const submit = form.handleSubmit(async ({ pin }) => {
    const signedIn = await signIn.mutateAsync({ staffId: dealer.staffId, pin });
    form.reset();
    setFailure(signedIn.ok ? null : signedIn.error);
  });
  const isComplete = useWatch({ control: form.control, name: 'pin' }).length === 4;
  return (
    <Stack gap={4}>
      <Controller control={form.control} name="pin" render={({ field }) => (
        <PinPad label={t('tablet.dealerSignIn.pinFor', { name: dealer.fullName })} value={field.value} onChange={field.onChange}
          isDisabled={signIn.isPending} error={failure === null ? undefined : signInFailureText(failure)} />
      )} />
      <Button variant="primary" isLoading={signIn.isPending} isDisabled={!isComplete} onClick={() => void submit()}>
        {t('tablet.dealerSignIn.signIn')}
      </Button>
    </Stack>
  );
}

/**
 * Between downs (#41): the dealer picks their name and enters their PIN, as in the prototype's
 * dealer sign-in. Only dealers with a PIN at this venue are listed; the list refreshes by itself,
 * so a PIN set on the console appears without touching the locked tablet.
 */
export function DealerSignInScreen() {
  const dealers = useTabletDealers();
  const [chosen, setChosen] = useState<string[]>([]);
  const title = t('tablet.dealerSignIn.title');
  if (dealers.isPending) return <Screen title={title} status="loading" />;
  if (dealers.data === undefined) return <Screen title={title} status="error" onRetry={() => void dealers.refetch()} />;
  if (dealers.data.length === 0) return <Screen title={title} status="empty" emptyText={t('tablet.dealerSignIn.noDealers')} />;
  const dealer = dealers.data.find((candidate) => candidate.staffId === chosen[0]);
  return (
    <Screen title={title}>
      <Stack gap={6}>
        <ChoiceChips label={t('tablet.dealerSignIn.who')} mode="one" selected={chosen} onChange={setChosen}
          options={dealers.data.map((candidate) => ({ value: candidate.staffId, label: candidate.fullName }))} />
        {dealer === undefined ? null : <DealerPin key={dealer.staffId} dealer={dealer} />}
      </Stack>
    </Screen>
  );
}
