import type { Result } from '@rivr/contracts/result';
import { useTournamentActions, type TournamentFailure, type VenueTournament } from '@rivr/db';
import { poolShare } from '@rivr/domain/tournament';
import { formatMoney, formatNumber, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack, Switch, Text } from '@rivr/ui';
import { useState } from 'react';
import { ClockPanel } from './ClockPanel.tsx';
import { FloorPanel } from './FloorPanel.tsx';

/** The rules under the clock: registration, the guarantee, the buy-in and what reaches the pool, any add-on, the places paid. */
function ruleLines(tournament: VenueTournament): string[] {
  const registration = tournament.lastRegistrationLevel === 0 ? t('console.tournaments.registrationAtStart')
    : t(`console.tournaments.registration.${tournament.format}`, { level: tournament.lastRegistrationLevel });
  const pool = formatMoney(poolShare(tournament.buyIn, tournament.fee));
  const lines = [registration];
  if (tournament.guarantee !== null) lines.push(t('console.tournaments.guarantee', { amount: formatMoney(tournament.guarantee) }));
  lines.push(t('console.tournaments.buyIn', { buyIn: formatMoney(tournament.buyIn), pool }));
  if (tournament.addOn !== null) {
    lines.push(t('console.tournaments.addOnLine', { price: formatMoney(tournament.addOn.price), chips: formatNumber(tournament.addOn.chips) }));
  }
  if (tournament.placesPaid !== null) lines.push(t('console.tournaments.placesPaid', { count: tournament.placesPaid }));
  return lines;
}

/** Remove, asked twice: the first press asks, the second removes. */
function RemoveTournament({ tournament, isBusy, onRemove }: { tournament: VenueTournament; isBusy: boolean; onRemove: () => void }) {
  const [isAsking, setAsking] = useState(false);
  if (!isAsking) return <Inline><Button variant="text" onClick={() => setAsking(true)}>{t('console.tournaments.remove')}</Button></Inline>;
  return (
    <Inline gap={4} align="center" wrap>
      <Text>{t('console.tournaments.removeConfirm', { name: tournament.name })}</Text>
      <Button variant="danger" isLoading={isBusy} onClick={onRemove}>{t('console.tournaments.removeYes')}</Button>
      <Button variant="text" onClick={() => setAsking(false)}>{t('console.tournaments.keep')}</Button>
    </Inline>
  );
}

/**
 * One tournament on the console (#115, #119): its clock and controls, the rules its template set, whether
 * members see it, and removing one made by mistake. Keyed by the tournament, so another one starts afresh.
 */
export function TournamentDetail({ venueId, tournament, canRun, canTakeCash }: { venueId: string; tournament: VenueTournament; canRun: boolean; canTakeCash: boolean }) {
  const actions = useTournamentActions(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const report = (done: Result<null, TournamentFailure>) => setFailure(done.ok ? null : t(`console.tournaments.failures.${done.error}`));
  return (
    <Stack gap={6}>
      <ClockPanel venueId={venueId} tournament={tournament} canRun={canRun} />
      <Inline gap={6} wrap>{ruleLines(tournament).map((line) => <Text key={line} variant="small" tone="muted">{line}</Text>)}</Inline>
      <FloorPanel venueId={venueId} tournament={tournament} canRun={canRun} canTakeCash={canTakeCash} />
      {canRun ? (
        <>
          <Switch label={t('console.tournaments.shown')} hint={t('console.tournaments.shownHint')} isOn={tournament.isPublished}
            isDisabled={actions.list.isPending}
            onChange={(isPublished) => void actions.list.mutateAsync({ tournament, isPublished }).then(report)} />
          <RemoveTournament tournament={tournament} isBusy={actions.remove.isPending}
            onRemove={() => void actions.remove.mutateAsync(tournament.id).then(report)} />
        </>
      ) : null}
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}
