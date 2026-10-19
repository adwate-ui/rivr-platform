import { useDownActions, useTabletDealers, type DealerSignInFailure, type TabletDealer } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, PinPad, Screen, Stack } from '@rivr/ui';
import { useState } from 'react';

const REFUSAL_COPY: Readonly<Record<Exclude<DealerSignInFailure['reason'], 'wrong_pin'>, MessageKey>> = {
  locked: 'tablet.dealerSignIn.locked',
  paused: 'tablet.dealerSignIn.paused',
  unavailable: 'tablet.dealerSignIn.unavailable',
};

function failureText(failure: DealerSignInFailure): string {
  if (failure.reason !== 'wrong_pin') return t(REFUSAL_COPY[failure.reason]);
  return failure.triesLeft === 1 ? t('tablet.dealerSignIn.wrongPinLast') : t('tablet.dealerSignIn.wrongPin', { count: failure.triesLeft });
}

/** The chosen dealer's PIN pad and Sign in: the right PIN starts their down at this table. */
function DealerPin({ dealer }: { dealer: TabletDealer }) {
  const { signIn } = useDownActions();
  const [pin, setPin] = useState('');
  const [failure, setFailure] = useState<DealerSignInFailure | null>(null);
  const signInNow = async () => {
    const signedIn = await signIn.mutateAsync({ staffId: dealer.staffId, pin });
    setPin('');
    setFailure(signedIn.ok ? null : signedIn.error);
  };
  return (
    <Stack gap={4}>
      <PinPad label={t('tablet.dealerSignIn.pinFor', { name: dealer.fullName })} value={pin} onChange={setPin}
        isDisabled={signIn.isPending} error={failure === null ? undefined : failureText(failure)} />
      <Button variant="primary" isLoading={signIn.isPending} isDisabled={pin.length !== 4} onClick={() => void signInNow()}>
        {t('tablet.dealerSignIn.signIn')}
      </Button>
    </Stack>
  );
}

/**
 * Between downs (#41): the dealer picks their name and enters their PIN, as in the prototype's
 * dealer sign-in. Only dealers with a PIN at this venue are listed.
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
