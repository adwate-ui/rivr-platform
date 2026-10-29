import { useRegisterTournamentEntry, type MyTournament } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

const SHOWN_FAILURES = ['short', 'registration_closed', 'identity', 'on_break', 'switched_off', 'room_full'] as const;
type ShownFailure = (typeof SHOWN_FAILURES)[number];
const shownFailure = (failure: string): ShownFailure | 'other' => SHOWN_FAILURES.find((each) => each === failure) ?? 'other';

/** The member's own standing in the tournament: their seat, waiting as an alternate, or out. */
export function MyStandingLine({ tournament }: { tournament: MyTournament }) {
  const mine = tournament.mine;
  if (mine === null || mine.status === 'refunded') return null;
  if (mine.status === 'seated') return <Text variant="small">{t('player.tonight.seatedAt', { table: mine.table ?? 0, seat: mine.seat ?? 0 })}</Text>;
  return <Text variant="small" tone="muted">{t(mine.status === 'alternate' ? 'player.tonight.alternate' : 'player.tonight.bustedOut')}</Text>;
}

/**
 * Register, re-enter or rebuy from the app (#118), paid from the member's balance: asked first, with no amount
 * (#627), then sent once; a refusal says why. Nothing when the tournament sells them nothing now.
 */
export function TournamentBuy({ tournament }: { tournament: MyTournament }) {
  const buy = useRegisterTournamentEntry();
  const [isAsking, setAsking] = useState(false);
  const [failure, setFailure] = useState<ShownFailure | 'other' | null>(null);
  // One request id until the server answers, so a retry after a lost reply never pays twice.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const offer = tournament.offer;
  if (offer === null) return null;
  const pay = () => void buy.mutateAsync({ tournamentId: tournament.id, purchase: offer, requestId }).then((done) => {
    setAsking(false);
    setFailure(done.ok ? null : shownFailure(done.error));
    if (done.ok || done.error !== 'unavailable') setRequestId(crypto.randomUUID());
  });
  return (
    <Stack gap={2}>
      {isAsking ? (
        <Inline gap={3} wrap>
          <Text variant="small">{t('player.tonight.confirmBuy')}</Text>
          <Button variant="primary" isLoading={buy.isPending} onClick={pay}>{t('player.tonight.payNow')}</Button>
          <Button variant="text" onClick={() => setAsking(false)}>{t('player.tonight.notNow')}</Button>
        </Inline>
      ) : (
        <Inline><Button variant="secondary" onClick={() => setAsking(true)}>{t(`player.tonight.offers.${offer}`)}</Button></Inline>
      )}
      {failure === null ? null : <ErrorMessage>{t(`player.tonight.buyFailures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
