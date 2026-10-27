import { cellKey, useStaffVenue, useTierActions, useTierMatrix, type TierFailure, type TierMatrix } from '@rivr/db';
import { formatDate, formatList, t } from '@rivr/i18n';
import { ErrorMessage, Screen, Stack, Text, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { MatrixTable } from './MatrixTable.tsx';
import { SaveBar } from './SaveBar.tsx';
import { changeOf, stateOf, TIER_FAILURE_COPY, type CellState } from './tierCopy.ts';
import { TierPreview } from './TierPreview.tsx';

interface PendingCell {
  readonly tierId: string;
  readonly featureKey: string;
  readonly state: CellState;
}

type Outcome = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly failure: TierFailure } | null;

/**
 * The console's Tiers screen (#32; additions "Tier-gated features"), for staff with tiers.manage: the
 * tiers, the tier x feature matrix with a choice per cell, saved together from now or a later day, and a
 * preview of the player app as any tier. Members' apps follow a change within seconds.
 */
export function TiersScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('tiers.manage')) {
    return <Screen title={t('console.tiers.title')} status="error" errorText={t('console.tiers.notAllowed')} />;
  }
  return <Tiers venueId={staff.venue.venueId} />;
}

function Tiers({ venueId }: { venueId: string }) {
  const matrix = useTierMatrix(venueId);
  const title = t('console.tiers.title');
  if (matrix.isPending) return <Screen title={title} status="loading" />;
  // A failed refresh keeps what was known, so choices made on screen stay put.
  if (matrix.data === undefined) return <Screen title={title} status="error" onRetry={() => void matrix.refetch()} />;
  return (
    <Screen title={title}>
      <TiersBody venueId={venueId} matrix={matrix.data} />
    </Screen>
  );
}

function TiersBody({ venueId, matrix }: { venueId: string; matrix: TierMatrix }) {
  const { schedule, withdraw } = useTierActions(venueId);
  const [pending, setPending] = useState<ReadonlyMap<string, PendingCell>>(new Map());
  const [outcome, setOutcome] = useState<Outcome>(null);
  const choose = (tierId: string, featureKey: string, state: CellState) => {
    const key = cellKey(tierId, featureKey);
    const saved = matrix.cells.get(key);
    const next = new Map(pending);
    // Choosing what is already saved is no change.
    if (saved !== undefined && stateOf(saved) === state) next.delete(key);
    else next.set(key, { tierId, featureKey, state });
    setPending(next);
  };
  const save = async (from: string | null) => {
    const cells = [...pending.values()].map((cell) => changeOf(cell.tierId, cell.featureKey, cell.state));
    const result = await schedule.mutateAsync({ cells, from });
    if (!result.ok) return setOutcome({ ok: false, failure: result.error });
    setPending(new Map());
    setOutcome({ ok: true, text: from === null ? t('console.tiers.saved') : t('console.tiers.savedLater', { date: formatDate(new Date(from)) }) });
  };
  const withdrawCell = async (cellId: string) => {
    const result = await withdraw.mutateAsync(cellId);
    setOutcome(result.ok ? null : { ok: false, failure: result.error });
  };
  return (
    <Stack gap={8}>
      <Text>{t('console.tiers.tierList', { tiers: formatList(matrix.tiers.map((tier) => tier.name)) })}</Text>
      <MatrixTable matrix={matrix} pending={new Map([...pending].map(([key, cell]) => [key, cell.state]))} isBusy={schedule.isPending || withdraw.isPending}
        onChange={choose} onWithdraw={(cellId) => void withdrawCell(cellId)} />
      {pending.size > 0 ? <SaveBar count={pending.size} isSaving={schedule.isPending} onSave={(from) => void save(from)} onDiscard={() => { setPending(new Map()); setOutcome(null); }} /> : null}
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{t(TIER_FAILURE_COPY[outcome.failure])}</ErrorMessage> : null}
      <TierPreview matrix={matrix} />
    </Stack>
  );
}
