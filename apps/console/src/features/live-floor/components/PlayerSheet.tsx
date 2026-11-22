import type { RequestTargets } from '@rivr/domain/floorRequests';
import { openSeatsAt, type FloorRequest, type FloorTable, type HeldSeat, type SeatedPlayer } from '@rivr/db';
import { clockTimeAfter, nearestClockMoment } from '@rivr/domain/clubDay';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Figure, Inline, Input, ProgressBar, RequestItem, Sheet, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { useBonusByHand } from './bonusByHand.ts';
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

/** The call time in words (#1076): what is left, not set once the countdown is done with none set, met, or none given. */
function callTimeWords(player: SeatedPlayer): string {
  const left = player.callTimeLeft;
  if (left === null) return t('console.floor.player.none');
  if (!player.owesCallTime) return t('console.floor.player.met');
  return left > 0 ? t('console.floor.player.left', { time: formatDuration(left) }) : t('console.floor.player.notSet');
}

/** The call time left, large, over a bar of the call time played; met or none said in words. */
function CallTime({ player, now }: { player: SeatedPlayer; now: Date }) {
  const played = waitedSeconds(player.startedAt, now);
  const left = player.callTimeLeft;
  const figure = callTimeWords(player);
  // When they leave, while the call time set is still owed; once it has run out, it is just done.
  const leaves = player.callTimeEndsAt === null || !player.owesCallTime ? null : t('console.floor.player.leaves', { time: formatTime(new Date(player.callTimeEndsAt)) });
  return (
    <Stack gap={3}>
      <Inline justify="between" align="baseline">
        <Text variant="caption" tone="muted">{t('console.floor.player.callTime')}</Text>
        <Text variant="caption" tone="muted">{t('console.floor.player.since', { time: formatTime(new Date(player.startedAt)) })}</Text>
      </Inline>
      {/* Nothing to count down: said at body size, not as the sheet's largest words (audit F-131). */}
      {left === null ? <Text tone="muted">{figure}</Text> : <Figure size="title">{figure}</Figure>}
      {left === null ? null : <ProgressBar tone="muted" fraction={played / Math.max(1, played + left)} />}
      {leaves === null ? null : <Text variant="caption" tone="muted">{leaves}</Text>}
    </Stack>
  );
}

/** What this player asks, in their own words, each with its actions, as the requests panel has them. */
function askTitle(request: FloorRequest): string {
  if (request.kind === 'top_up') return t(request.isStarted ? 'console.floor.player.toppingUp' : 'console.floor.player.asksTopUp');
  if (request.kind === 'call_time_set') return t('console.floor.requests.callTimeSet');
  return t('console.floor.player.asksLeaving');
}

/**
 * Set call time, then Extend call time, to a time on the clock, as the member app (decision 0305; #1076; #1089; the owner,
 * 22 Nov), for the floor's managers, by the member's own rule: until set, a time after the minimum playing time, which
 * counts as setting it; once set, a time after the current end. The field starts at the five minutes after that, and the
 * time is the one the clock shows nearest now, so one gone by is refused here before anything is sent.
 */
function CallTimePicker({ player, after, now, changes }: { player: SeatedPlayer; after: Date; now: Date; changes: SeatChanges }) {
  const isSet = player.callTimeSetAt !== null;
  const ids = { after: useId(), note: useId(), error: useId() };
  const [time, setTime] = useState(() => clockTimeAfter(after, 5));
  const [error, setError] = useState<string | null>(null);
  const action = t(isSet ? 'console.floor.player.extendCallTime' : 'console.floor.player.setCallTime');
  const set = () => {
    const until = nearestClockMoment(time, now);
    if (until === null || until <= after) return setError(t('console.floor.player.pickAfter', { time: formatTime(after) }));
    void changes.addTime(player, until);
  };
  const describedBy = [ids.after, isSet ? ids.note : '', error === null ? '' : ids.error].filter((id) => id !== '').join(' ');
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end">
        <Input variant="subtle" type="time" label={t('console.floor.player.until')} value={time} aria-describedby={describedBy}
          aria-invalid={error === null ? undefined : true} onChange={(event) => { setTime(event.target.value); setError(null); }} />
        <Button variant="primary" size="compact" onClick={set}>{action}</Button>
      </Inline>
      <Text id={ids.after} variant="caption" tone="muted">{t('console.floor.player.callTimeAfter', { time: formatTime(after) })}</Text>
      {isSet ? <Text id={ids.note} variant="caption" tone="muted">{t('console.floor.player.extendNote')}</Text> : null}
      {error === null ? null : <ErrorMessage id={ids.error}>{error}</ErrorMessage>}
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
 * A seated player's sheet (console v3): their call time left over a bar, what they ask with its actions, Set or Extend call
 * time to a time for the floor's managers, Move (table, then seat), Bonus by hand for staff who may add it, their member record; Leave in the foot.
 */
export function PlayerSheet(props: PlayerSheetProps) {
  const { venueId, player, table, requests, targets, now, permissions, changes, onLeave, onClose } = props;
  const drawBonusByHand = useBonusByHand();
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
      {permissions.includes('call_time.override') && player.callTimeAfterAt !== null
        ? <CallTimePicker key={`${player.sessionId}:${player.callTimeChangeId ?? ''}`} player={player} after={new Date(player.callTimeAfterAt)} now={now}
          changes={changes.seats} /> : null}
      <Move {...props} changes={changes.seats} />
      {drawBonusByHand !== null && permissions.includes('bonus.give') ? drawBonusByHand({ venueId, memberId: player.memberId }) : null}
      <MemberRecordLink memberId={player.memberId} permissions={permissions} />
    </Sheet>
  );
}

/** The member's record, for staff who may open Members, the floor among them (the owner, 22 Nov); cashiers may not (audit F-025). */
function MemberRecordLink({ memberId, permissions }: { memberId: string; permissions: readonly string[] }) {
  const navigate = useNavigate();
  if (!['members.manage', 'host_queue.manage', 'members.phone'].some((permission) => permissions.includes(permission))) return null;
  return (
    <Inline>
      <Button variant="text" onClick={() => void navigate({ href: `/members?member=${memberId}` })}>{t('console.floor.player.memberRecord')}</Button>
    </Inline>
  );
}
