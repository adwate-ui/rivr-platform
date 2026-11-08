import type { RequestTargets } from '@rivr/domain/floorRequests';
import { openSeatsAt, useAddTimeChoices, type FloorRequest, type FloorTable, type HeldSeat, type SeatedPlayer } from '@rivr/db';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { Button, ChoiceChips, Figure, Grid, Inline, ProgressBar, RequestItem, Sheet, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { requestActions, type LeaveRequest } from './requestActions.ts';
import { wordsOf, waitedSeconds } from './requestView.ts';
import type { RequestChanges } from './useRequestChanges.ts';
import type { SeatChanges } from './useSeatChanges.ts';

export interface PlayerSheetProps {
  venueId: string;
  player: SeatedPlayer;
  table: FloorTable;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  held: readonly HeldSeat[];
  /** The floor's requests: this player's asks are among them. */
  requests: readonly FloorRequest[];
  targets: RequestTargets;
  now: Date;
  permissions: readonly string[];
  changes: { readonly requests: RequestChanges; readonly seats: SeatChanges };
  onLeave: (request?: LeaveRequest) => void;
  onClose: () => void;
}

/** The call time in words: what is left, met, or none given. */
function callTimeWords(left: number | null): string {
  if (left === null) return t('console.floor.player.none');
  return left > 0 ? t('console.floor.player.left', { time: formatDuration(left) }) : t('console.floor.player.met');
}

/** The call time left, large, over a bar of the call time played; met or none said in words. */
function CallTime({ player, now }: { player: SeatedPlayer; now: Date }) {
  const played = waitedSeconds(player.startedAt, now);
  const left = player.callTimeLeft;
  const figure = callTimeWords(left);
  return (
    <Stack gap={3}>
      <Inline justify="between" align="baseline">
        <Text variant="caption" tone="muted">{t('console.floor.player.callTime')}</Text>
        <Text variant="caption" tone="muted">{t('console.floor.player.since', { time: formatTime(new Date(player.startedAt)) })}</Text>
      </Inline>
      {/* Nothing to count down: said at body size, not as the sheet's largest words (audit F-131). */}
      {left === null ? <Text tone="muted">{figure}</Text> : <Figure size="title">{figure}</Figure>}
      {left === null ? null : <ProgressBar tone="muted" fraction={played / Math.max(1, played + left)} />}
    </Stack>
  );
}

/** What this player asks, in their own words, each with its actions, as the requests panel has them. */
function askTitle(request: FloorRequest): string {
  if (request.kind === 'time') return t('console.floor.player.asksTime', { time: formatDuration(request.minutes * 60) });
  if (request.kind === 'top_up') return t(request.isStarted ? 'console.floor.player.toppingUp' : 'console.floor.player.asksTopUp');
  return t('console.floor.player.asksLeaving');
}

/** Add time (decision 0305): the lengths the club offers, for the floor's managers. */
function AddTime({ venueId, player, changes }: { venueId: string; player: SeatedPlayer; changes: SeatChanges }) {
  const choices = useAddTimeChoices(venueId).data ?? [];
  if (choices.length === 0) return null;
  return (
    <Stack gap={3}>
      <Text variant="caption" tone="muted">{t('console.floor.player.addTime')}</Text>
      <Grid columns={3} gap={2}>
        {choices.map((minutes) => (
          <Button key={minutes} variant="subtle" fullWidth onClick={() => void changes.addTime(player, minutes)}>
            {t('console.floor.player.addTimeChoice', { time: formatDuration(minutes * 60) })}
          </Button>
        ))}
      </Grid>
    </Stack>
  );
}

/** Move: a table with open seats first, then one of its open seats, which moves the player there at once. */
function Move({ player, tables, seats, held, changes }: Pick<PlayerSheetProps, 'player' | 'tables' | 'seats' | 'held'> & { changes: SeatChanges }) {
  const [tableId, setTableId] = useState<string | null>(null);
  const taken = [...seats, ...held];
  const open = tables.filter((table) => table.isOpen && openSeatsAt(table, taken).length > 0);
  const chosen = open.find((table) => table.id === tableId);
  return (
    <Stack gap={3}>
      <Text variant="caption" tone="muted">{t('console.floor.player.move')}</Text>
      <ChoiceChips look="subtle" mode="one" label={t('console.floor.player.moveTable')} isLabelVisuallyHidden selected={chosen ? [chosen.id] : []}
        options={open.map((table) => ({ value: table.id, label: t('console.floor.player.tableOption', { table: table.name, count: openSeatsAt(table, taken).length }) }))}
        onChange={([value]) => setTableId(value ?? null)} />
      {chosen === undefined ? null : (
        <ChoiceChips look="subtle" mode="one" label={t('console.floor.player.moveSeat')} isLabelVisuallyHidden selected={[]}
          options={openSeatsAt(chosen, taken).map((seat) => ({ value: String(seat), label: String(seat) }))}
          onChange={([value]) => { if (value !== undefined) void changes.move(player, chosen, Number(value)); }} />
      )}
    </Stack>
  );
}

/**
 * A seated player's sheet (console v3): their call time left over a bar, what they ask with its actions, Add time for the
 * floor's managers, Move (table, then seat), their member record; Leave in the foot.
 */
export function PlayerSheet(props: PlayerSheetProps) {
  const { venueId, player, table, requests, targets, now, permissions, changes, onLeave, onClose } = props;
  const asks = requests.filter((request) => request.kind !== 'left_owing' && 'sessionId' in request && request.sessionId === player.sessionId);
  // One Leave: the card's, when the player has asked to go (audit F-131).
  const hasAskedToLeave = asks.some((request) => request.kind === 'leaving');
  const footer = (
    <Inline justify={hasAskedToLeave ? 'end' : 'between'} grow>
      {hasAskedToLeave ? null : <Button variant="text" onClick={() => onLeave()}>{t('console.floor.player.leave')}</Button>}
      <Button variant="text" onClick={onClose}>{t('console.floor.player.close')}</Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={onClose} title={player.fullName} footer={footer}
      subtitle={t('console.floor.player.subtitle', { table: table.name, seat: player.seat, tier: player.tierName })}>
      <CallTime player={player} now={now} />
      {asks.map((request) => {
        const words = wordsOf(request, table, now, targets);
        const actions = requestActions(request, { changes: changes.requests, tableName: table.name, onLeave });
        return (
          <RequestItem key={request.kind} look="ask" title={askTitle(request)} age={words.age} isLate={words.isLate}
            primary={{ label: actions.primary.label, onClick: () => void actions.primary.run() }}
            secondary={actions.secondary && { label: actions.secondary.label, onClick: () => void actions.secondary?.run() }} />
        );
      })}
      {permissions.includes('call_time.override') && player.callTimeLeft !== null ? <AddTime venueId={venueId} player={player} changes={changes.seats} /> : null}
      <Move {...props} changes={changes.seats} />
      <MemberRecordLink memberId={player.memberId} permissions={permissions} />
    </Sheet>
  );
}

/** The member's record, for staff who may open Members; the floor and cashiers may not (audit F-025). */
function MemberRecordLink({ memberId, permissions }: { memberId: string; permissions: readonly string[] }) {
  const navigate = useNavigate();
  if (!permissions.includes('members.manage') && !permissions.includes('host_queue.manage')) return null;
  return (
    <Inline>
      <Button variant="text" onClick={() => void navigate({ href: `/members?member=${memberId}` })}>{t('console.floor.player.memberRecord')}</Button>
    </Inline>
  );
}
