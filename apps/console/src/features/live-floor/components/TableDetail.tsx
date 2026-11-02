import { useSeatActions, useSetTopUp, type FloorTable, type HeldSeat, type SeatedPlayer, type SeatFailure, type TableNight } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, CallTimeTimer, ConfirmButton, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CallTimeForm } from './CallTimeForm.tsx';
import { EarlyLeaveForm } from './EarlyLeaveForm.tsx';
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
 * One seat's row, as in the prototype: who sits there and their tier, since when they play and their call time left or none
 * (decision 0299), their must-move turn, away, leaving, their top-up (#634); or held for a waitlist call, or Open.
 */
function SeatLine({ number, player, heldFor, isOpen }: { number: number; player: SeatedPlayer | undefined; heldFor: HeldSeat | undefined; isOpen: boolean }) {
  if (player === undefined) {
    const free = isOpen ? t('console.liveFloor.seatOpen') : t('console.liveFloor.seatFree');
    const state = heldFor === undefined ? free : t('console.liveFloor.heldFor', { name: heldFor.fullName });
    return <Inline gap={4}><Text tone="muted">{number}</Text><Text tone="muted">{state}</Text></Inline>;
  }
  return (
    <Inline gap={4} align="center" wrap>
      <Text tone="muted">{number}</Text>
      <Text>{player.fullName}</Text>
      <Text tone="muted">{player.tierName}</Text>
      <Text variant="small" tone="muted">{t('console.liveFloor.playingSince', { time: formatTime(new Date(player.startedAt)) })}</Text>
      {player.callTimeLeft === null ? <Text variant="small" tone="muted">{t('console.liveFloor.noCallTime')}</Text>
        : <CallTimeTimer secondsLeft={player.callTimeLeft} isPaused={player.isAway} />}
      {player.mustMoveOrder === null ? null : <Text variant="small" tone="muted">{t('console.liveFloor.mustMove', { order: player.mustMoveOrder })}</Text>}
      {player.isAway ? <Text variant="small" tone="muted">{t('console.liveFloor.away')}</Text> : null}
      {player.leavingAt === null ? null : <Text variant="small" weight="semibold">{t('console.liveFloor.leaving')}</Text>}
      {player.topUp === null ? null
        : <Text variant="small" weight="semibold">{t(player.topUp === 'requested' ? 'console.liveFloor.topUpRequested' : 'console.liveFloor.topUpInProgress')}</Text>}
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
  onLeave: () => void;
  onLeaveEarly: () => void;
  onTopUp: (inProgress: boolean) => void;
  onCallTime: () => void;
}

/**
 * The floor's buttons on a seated player's row, on a line of their own under who sits there (#712): one Leave (decision
 * 0299), the top-up (#634) and the call time (#638). Away, Move and Mark leaving are not here (the owner: the floor gives
 * more call time, or assigns the player again from the waitlist). Leave asks "Yes, … leaves"; a player who still owes call
 * time is let go early by an admin, with a reason, the seat freed with it (#79), and anyone else's leaves as before, owing.
 */
function SeatButtons({ player, isLeaveBusy, canLetGoEarly, onLeave, onLeaveEarly, onTopUp, onCallTime }: SeatButtonsProps) {
  const isOwing = (player.callTimeLeft ?? 0) > 0;
  return (
    <Inline gap={2} wrap>
      {canLetGoEarly && isOwing ? (
        <Button variant="text" aria-label={t('console.liveFloor.leaveName', { name: player.fullName })} onClick={onLeaveEarly}>{t('console.liveFloor.leave')}</Button>
      ) : (
        <ConfirmButton label={t('console.liveFloor.leave')} name={t('console.liveFloor.leaveName', { name: player.fullName })}
          confirm={t('console.liveFloor.confirmLeave', { name: player.fullName })} isBusy={isLeaveBusy} onConfirm={onLeave} />
      )}
      <TopUpButtons player={player} onTopUp={onTopUp} />
      <Button variant="text" aria-label={t('console.liveFloor.changeCallTimeName', { name: player.fullName })} onClick={onCallTime}>
        {t('console.liveFloor.changeCallTime')}
      </Button>
    </Inline>
  );
}

type Report = (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;
/** What a refusal came from: the seats' buttons and the table's controls above, or a form below. */
type FailureFrom = 'table' | 'leaveEarly' | 'callTime' | 'seat';

interface SeatRowsProps {
  venueId: string;
  table: FloorTable;
  seats: readonly SeatedPlayer[];
  held: readonly HeldSeat[];
  permissions: readonly string[];
  report: Report;
  /** The forms below the seats: an early leave, a call time. */
  onForm: (form: 'leaveEarly' | 'callTime', player: SeatedPlayer) => void;
}

/** Each seat's row; under a seated player, the floor's buttons on a line of their own (waitlist.manage), so neither crowds the other (#712). */
function SeatRows({ venueId, table, seats, held, permissions, report, onForm }: SeatRowsProps) {
  const { leave } = useSeatActions(venueId);
  const setTopUp = useSetTopUp(venueId);
  const isFloor = permissions.includes('waitlist.manage');
  return (
    <Stack gap={2} divided>
      {Array.from({ length: table.seats }, (_, index) => {
        const player = seats.find((seat) => seat.seat === index + 1);
        return (
          <Stack key={index} gap={1}>
            <SeatLine number={index + 1} player={player} heldFor={held.find((seat) => seat.seat === index + 1)} isOpen={table.isOpen} />
            {isFloor && player !== undefined ? (
              <SeatButtons player={player} isLeaveBusy={leave.isPending && leave.variables === player.sessionId} canLetGoEarly={permissions.includes('call_time.override')}
                onLeave={() => void leave.mutateAsync(player.sessionId).then(report)} onLeaveEarly={() => onForm('leaveEarly', player)}
                onTopUp={(inProgress) => void setTopUp.mutateAsync({ sessionId: player.sessionId, inProgress }).then(report)}
                onCallTime={() => onForm('callTime', player)} />
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}

/**
 * The chosen table (#77, #81): its rules and night so far, its seats and its recent hands. The floor
 * seats a player or lets one leave; admins let one leave before call time, with a reason (#79); floor managers open or
 * close the table and set it to feed a main table.
 */
export function TableDetail({ venueId, table, tables, seats, held, permissions, night }: TableDetailProps) {
  const [leavingEarly, setLeavingEarly] = useState<SeatedPlayer | null>(null);
  const [changing, setChanging] = useState<SeatedPlayer | null>(null);
  // Where a refusal came from, so it shows beside what caused it: the seats and table above, or one of the forms below (F2-29).
  const [failure, setFailure] = useState<{ error: SeatFailure; from: FailureFrom } | null>(null);
  const reportFrom = (from: FailureFrom): Report => (outcome) => setFailure(outcome.ok ? null : { error: outcome.error, from });
  const reports = { table: reportFrom('table'), leaveEarly: reportFrom('leaveEarly'), callTime: reportFrom('callTime'), seat: reportFrom('seat') };
  const report = reports.table;
  const errorFrom = (from: FailureFrom) => (failure?.from === from ? <ErrorMessage>{t(SEAT_FAILURE_COPY[failure.error])}</ErrorMessage> : null);
  const errors = { table: errorFrom('table'), leaveEarly: errorFrom('leaveEarly'), callTime: errorFrom('callTime'), seat: errorFrom('seat') };
  // A form opened clears a refusal from before, which would sit beside a form that did not cause it.
  const opening = (open: (player: SeatedPlayer) => void) => (player: SeatedPlayer) => { setFailure(null); open(player); };
  const forms = { leaveEarly: opening(setLeavingEarly), callTime: opening(setChanging) };
  return (
    <Stack gap={4}>
      <TableHeader table={table} players={seats} night={night} canSeeNight={permissions.includes('members.read')} />
      {permissions.includes('floor.manage') ? <TableControls venueId={venueId} table={table} tables={tables} isEmpty={seats.length === 0} onResult={report} /> : null}
      {errors.table}
      {permissions.includes('members.read') ? (
        <SeatRows venueId={venueId} table={table} seats={seats} held={held} permissions={permissions} report={report}
          onForm={(form, player) => forms[form](player)} />
      ) : <Text tone="muted">{t('console.liveFloor.noSeatMap')}</Text>}
      {leavingEarly === null ? null : (
        <EarlyLeaveForm key={leavingEarly.sessionId} venueId={venueId} onDone={reports.leaveEarly} onCancel={() => setLeavingEarly(null)}
          member={{ memberId: leavingEarly.memberId, fullName: leavingEarly.fullName, owed: leavingEarly.callTimeLeft ?? 0, sessionId: leavingEarly.sessionId }} />
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
