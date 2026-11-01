import { useSeatActions, useSetTopUp, type FloorTable, type HeldSeat, type SeatedPlayer, type SeatFailure, type TableNight } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, CallTimeTimer, ConfirmButton, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CallTimeForm } from './CallTimeForm.tsx';
import { EarlyLeaveForm } from './EarlyLeaveForm.tsx';
import { MoveForm } from './MoveForm.tsx';
import { SEAT_FAILURE_COPY } from './seatCopy.ts';
import { SeatForm } from './SeatForm.tsx';
import { TableControls } from './TableControls.tsx';
import { TableHeader } from './TableHeader.tsx';

interface TableDetailProps {
  venueId: string;
  table: FloorTable;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  held: readonly HeldSeat[];
  permissions: readonly string[];
  /** The table's night so far; undefined until it is read. */
  night: TableNight | undefined;
}

/**
 * One seat's row, as in the prototype: who sits there and their tier, their must-move turn, away, leaving, their top-up (#634),
 * their call time left (#78), held for a waitlist call, or Open.
 */
function SeatLine({ number, player, heldFor, isOpen }: { number: number; player: SeatedPlayer | undefined; heldFor: HeldSeat | undefined; isOpen: boolean }) {
  if (player === undefined) {
    const free = isOpen ? t('console.liveFloor.seatOpen') : t('console.liveFloor.seatFree');
    const state = heldFor === undefined ? free : t('console.liveFloor.heldFor', { name: heldFor.fullName });
    return <Inline gap={4}><Text tone="muted">{number}</Text><Text tone="muted">{state}</Text></Inline>;
  }
  return (
    <Inline gap={4} align="center">
      <Text tone="muted">{number}</Text>
      <Text>{player.fullName}</Text>
      <Text tone="muted">{player.tierName}</Text>
      {player.mustMoveOrder === null ? null : <Text variant="small" tone="muted">{t('console.liveFloor.mustMove', { order: player.mustMoveOrder })}</Text>}
      {player.isAway ? <Text variant="small" tone="muted">{t('console.liveFloor.away')}</Text> : null}
      {player.leavingAt === null ? null : <Text variant="small" weight="semibold">{t('console.liveFloor.leaving')}</Text>}
      {player.topUp === null ? null
        : <Text variant="small" weight="semibold">{t(player.topUp === 'requested' ? 'console.liveFloor.topUpRequested' : 'console.liveFloor.topUpInProgress')}</Text>}
      {player.callTimeLeft === null ? null : <CallTimeTimer secondsLeft={player.callTimeLeft} isPaused={player.isAway} />}
    </Inline>
  );
}

/** A requested top-up is taken in hand; one asked for or in hand is reset once done (#634). Nothing with none asked for. */
function TopUpButtons({ player, onTopUp }: { player: SeatedPlayer; onTopUp: (inProgress: boolean) => void }) {
  if (player.topUp === null) return null;
  return (
    <>
      {player.topUp === 'requested' ? (
        <Button variant="text" aria-label={t('console.liveFloor.startTopUpName', { name: player.fullName })} onClick={() => onTopUp(true)}>
          {t('console.liveFloor.startTopUp')}
        </Button>
      ) : null}
      <Button variant="text" aria-label={t('console.liveFloor.resetTopUpName', { name: player.fullName })} onClick={() => onTopUp(false)}>
        {t('console.liveFloor.resetTopUp')}
      </Button>
    </>
  );
}

interface SeatButtonsProps {
  player: SeatedPlayer;
  /** This player's leave is being sent. */
  isLeaveBusy: boolean;
  canLetGoEarly: boolean;
  onMove: () => void;
  onLeave: () => void;
  onLeaveEarly: () => void;
  onLeaving: (isLeaving: boolean) => void;
  onAway: (isAway: boolean) => void;
  onTopUp: (inProgress: boolean) => void;
  onCallTime: () => void;
}

/**
 * The floor's buttons on a seated player's row: mark them leaving or take it back (decision 0163), away from
 * the table or back (#630: as the tablet does), the top-up (#634), the call time (#638), move, leave, and for admins, leave early
 * while call time is owed (#79).
 */
function SeatButtons({ player, isLeaveBusy, canLetGoEarly, onMove, onLeave, onLeaveEarly, onLeaving, onAway, onTopUp, onCallTime }: SeatButtonsProps) {
  const isLeaving = player.leavingAt !== null;
  return (
    <Inline gap={2}>
      <Button variant="text" aria-label={t(isLeaving ? 'console.liveFloor.notLeavingName' : 'console.liveFloor.markLeavingName', { name: player.fullName })}
        onClick={() => onLeaving(!isLeaving)}>
        {t(isLeaving ? 'console.liveFloor.notLeaving' : 'console.liveFloor.markLeaving')}
      </Button>
      <Button variant="text" aria-label={t(player.isAway ? 'console.liveFloor.markBackName' : 'console.liveFloor.markAwayName', { name: player.fullName })}
        onClick={() => onAway(!player.isAway)}>
        {t(player.isAway ? 'console.liveFloor.markBack' : 'console.liveFloor.markAway')}
      </Button>
      <TopUpButtons player={player} onTopUp={onTopUp} />
      <Button variant="text" aria-label={t('console.liveFloor.changeCallTimeName', { name: player.fullName })} onClick={onCallTime}>
        {t('console.liveFloor.changeCallTime')}
      </Button>
      <Button variant="text" aria-label={t('console.liveFloor.moveName', { name: player.fullName })} onClick={onMove}>{t('console.liveFloor.move')}</Button>
      <ConfirmButton label={t('console.liveFloor.leave')} name={t('console.liveFloor.leaveName', { name: player.fullName })}
        confirm={t('console.liveFloor.confirmLeave', { name: player.fullName })} isBusy={isLeaveBusy} onConfirm={onLeave} />
      {canLetGoEarly && (player.callTimeLeft ?? 0) > 0 ? (
        <Button variant="text" aria-label={t('console.liveFloor.leaveEarlyName', { name: player.fullName })} onClick={onLeaveEarly}>
          {t('console.liveFloor.leaveEarly')}
        </Button>
      ) : null}
    </Inline>
  );
}

type Report = (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;
/** What a refusal came from: the seats' buttons and the table's controls above, or a form below. */
type FailureFrom = 'table' | 'move' | 'leaveEarly' | 'callTime' | 'seat';

interface SeatRowsProps {
  venueId: string;
  table: FloorTable;
  seats: readonly SeatedPlayer[];
  held: readonly HeldSeat[];
  permissions: readonly string[];
  report: Report;
  /** The forms below the seats: a move, an early leave, a call time. */
  onForm: (form: 'move' | 'leaveEarly' | 'callTime', player: SeatedPlayer) => void;
}

/** Each seat's row, with the floor's buttons beside a seated player (waitlist.manage). */
function SeatRows({ venueId, table, seats, held, permissions, report, onForm }: SeatRowsProps) {
  const { leave, setLeaving, setAway } = useSeatActions(venueId);
  const setTopUp = useSetTopUp(venueId);
  const isFloor = permissions.includes('waitlist.manage');
  return (
    <Stack gap={2} divided>
      {Array.from({ length: table.seats }, (_, index) => {
        const player = seats.find((seat) => seat.seat === index + 1);
        return (
          <Inline key={index} justify="between" align="center">
            <SeatLine number={index + 1} player={player} heldFor={held.find((seat) => seat.seat === index + 1)} isOpen={table.isOpen} />
            {isFloor && player !== undefined ? (
              <SeatButtons player={player} isLeaveBusy={leave.isPending && leave.variables === player.sessionId} canLetGoEarly={permissions.includes('call_time.override')} onMove={() => onForm('move', player)}
                onLeave={() => void leave.mutateAsync(player.sessionId).then(report)} onLeaveEarly={() => onForm('leaveEarly', player)}
                onLeaving={(isLeaving) => void setLeaving.mutateAsync({ sessionId: player.sessionId, isLeaving }).then(report)}
                onAway={(isAway) => void setAway.mutateAsync({ sessionId: player.sessionId, isAway }).then(report)}
                onTopUp={(inProgress) => void setTopUp.mutateAsync({ sessionId: player.sessionId, inProgress }).then(report)}
                onCallTime={() => onForm('callTime', player)} />
            ) : null}
          </Inline>
        );
      })}
    </Stack>
  );
}

/**
 * The chosen table (#77, #81): its rules and night so far, its seats and its recent hands. The floor
 * seats a player, moves one (the same session, so call time runs on) or lets one leave; admins let one
 * leave before call time, with a reason (#79); floor managers open or close the table and set it to
 * feed a main table.
 */
export function TableDetail({ venueId, table, tables, seats, held, permissions, night }: TableDetailProps) {
  const [moving, setMoving] = useState<SeatedPlayer | null>(null);
  const [leavingEarly, setLeavingEarly] = useState<SeatedPlayer | null>(null);
  const [changing, setChanging] = useState<SeatedPlayer | null>(null);
  // Where a refusal came from, so it shows beside what caused it: the seats and table above, or one of the forms below (F2-29).
  const [failure, setFailure] = useState<{ error: SeatFailure; from: FailureFrom } | null>(null);
  const reportFrom = (from: FailureFrom): Report => (outcome) => setFailure(outcome.ok ? null : { error: outcome.error, from });
  const reports = { table: reportFrom('table'), move: reportFrom('move'), leaveEarly: reportFrom('leaveEarly'), callTime: reportFrom('callTime'), seat: reportFrom('seat') };
  const report = reports.table;
  const errorFrom = (from: FailureFrom) => (failure?.from === from ? <ErrorMessage>{t(SEAT_FAILURE_COPY[failure.error])}</ErrorMessage> : null);
  const errors = { table: errorFrom('table'), move: errorFrom('move'), leaveEarly: errorFrom('leaveEarly'), callTime: errorFrom('callTime'), seat: errorFrom('seat') };
  // A form opened clears a refusal from before, which would sit beside a form that did not cause it.
  const opening = (open: (player: SeatedPlayer) => void) => (player: SeatedPlayer) => { setFailure(null); open(player); };
  const forms = { move: opening(setMoving), leaveEarly: opening(setLeavingEarly), callTime: opening(setChanging) };
  return (
    <Stack gap={4}>
      <TableHeader table={table} night={night} canSeeNight={permissions.includes('members.read')} />
      {permissions.includes('floor.manage') ? <TableControls venueId={venueId} table={table} tables={tables} isEmpty={seats.length === 0} onResult={report} /> : null}
      {errors.table}
      {permissions.includes('members.read') ? (
        <SeatRows venueId={venueId} table={table} seats={seats} held={held} permissions={permissions} report={report}
          onForm={(form, player) => forms[form](player)} />
      ) : <Text tone="muted">{t('console.liveFloor.noSeatMap')}</Text>}
      {moving === null ? null : <MoveForm key={moving.sessionId} venueId={venueId} player={moving} tables={tables} onDone={(outcome) => { reports.move(outcome); if (outcome.ok) setMoving(null); }} onCancel={() => setMoving(null)} />}
      {errors.move}
      {leavingEarly === null ? null : (
        <EarlyLeaveForm key={leavingEarly.sessionId} venueId={venueId} onDone={reports.leaveEarly} onCancel={() => setLeavingEarly(null)}
          member={{ memberId: leavingEarly.memberId, fullName: leavingEarly.fullName, owed: leavingEarly.callTimeLeft ?? 0 }} />
      )}
      {errors.leaveEarly}
      {changing === null ? null : (
        <CallTimeForm key={changing.sessionId} venueId={venueId} player={changing} onCancel={() => setChanging(null)}
          onDone={(outcome) => { reports.callTime(outcome); if (outcome.ok) setChanging(null); }} />
      )}
      {errors.callTime}
      {permissions.includes('waitlist.manage') && table.isOpen ? <SeatForm venueId={venueId} table={table} seats={seats} held={held} onResult={reports.seat} /> : null}
      {errors.seat}
    </Stack>
  );
}
