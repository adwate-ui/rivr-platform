import {
  useApproveWaitlistRequest, useDecideCallTime, useFloorActions, useFloorUndo, useSeatActions, useSetTopUp,
  type FloorRequest,
} from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { useChangeToast } from './useChangeToast.ts';

type Join = Extract<FloorRequest, { kind: 'join' }>;
type TopUp = Extract<FloorRequest, { kind: 'top_up' }>;
type Time = Extract<FloorRequest, { kind: 'time' }>;

/**
 * A join approved (true when it went through) or declined (#633), each undone by the database's own undo (decision 0480);
 * and an approved player called to a seat held for them, seated there (decision 0302).
 */
function useJoinChanges(venueId: string) {
  const say = useChangeToast();
  const undo = useFloorUndo(venueId);
  const approve = useApproveWaitlistRequest();
  const { declineJoin } = useFloorActions(venueId);
  const undoJoin = (join: Join) => () => undo.mutateAsync({ kind: 'join', entryId: join.id });
  return {
    approveJoin: async (join: Join, table: string) => {
      const outcome = await approve.mutateAsync(join.id);
      say(outcome, t('console.floor.toast.joinApproved', { name: join.fullName, table }), undoJoin(join));
      return outcome.ok;
    },
    declineJoin: async (join: Join) => say(await declineJoin.mutateAsync(join.id), t('console.floor.toast.joinDeclined', { name: join.fullName }), undoJoin(join)),
  };
}

/** A top-up started or done (decision 0299), more time approved or declined (decision 0305), each with its undo. */
function useSeatRequestChanges(venueId: string) {
  const say = useChangeToast();
  const undo = useFloorUndo(venueId);
  const setTopUp = useSetTopUp(venueId);
  const decide = useDecideCallTime(venueId);
  return {
    stepTopUp: async (topUp: TopUp) => {
      const outcome = await setTopUp.mutateAsync({ sessionId: topUp.sessionId, inProgress: !topUp.isStarted });
      const text = t(topUp.isStarted ? 'console.floor.toast.topUpDone' : 'console.floor.toast.topUpStarted', { name: topUp.fullName });
      say(outcome, text, () => undo.mutateAsync({ kind: 'topUp', requestId: topUp.id }));
    },
    decideTime: async (time: Time, isApproved: boolean) => {
      const outcome = await decide.mutateAsync({ requestId: time.id, isApproved });
      const text = isApproved
        ? t('console.floor.toast.timeApproved', { name: time.fullName, time: formatDuration(time.minutes * 60) })
        : t('console.floor.toast.timeDeclined', { name: time.fullName });
      say(outcome, text, () => undo.mutateAsync({ kind: 'callTime', requestId: time.id }));
    },
  };
}

/**
 * The requests panel's changes, and the same asks in a player's sheet: each says how it went, with Undo for five seconds.
 * Not leaving is undone by marking the player leaving again.
 */
export function useRequestChanges(venueId: string) {
  const say = useChangeToast();
  const { setLeaving } = useSeatActions(venueId);
  return {
    ...useJoinChanges(venueId),
    ...useSeatRequestChanges(venueId),
    notLeaving: async ({ sessionId, fullName }: { sessionId: string; fullName: string }) =>
      say(await setLeaving.mutateAsync({ sessionId, isLeaving: false }), t('console.floor.toast.staying', { name: fullName }),
        () => setLeaving.mutateAsync({ sessionId, isLeaving: true })),
  };
}

export type RequestChanges = ReturnType<typeof useRequestChanges>;
