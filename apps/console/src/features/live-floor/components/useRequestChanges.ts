import {
  useApproveWaitlistRequest, useFloorActions, useFloorUndo, useMarkCallTimeSeen, useSeatActions, useSetTopUp,
  type FloorRequest,
} from '@rivr/db';
import { t } from '@rivr/i18n';
import { useChangeToast } from './useChangeToast.ts';

type Join = Extract<FloorRequest, { kind: 'join' }>;
type TopUp = Extract<FloorRequest, { kind: 'top_up' }>;
type CallTimeSet = Extract<FloorRequest, { kind: 'call_time_set' }>;

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

/** A top-up started or done (decision 0299), with its undo; a member's own call time seen (#1090), which has none. */
function useSeatRequestChanges(venueId: string) {
  const say = useChangeToast();
  const undo = useFloorUndo(venueId);
  const setTopUp = useSetTopUp(venueId);
  const markSeen = useMarkCallTimeSeen(venueId);
  return {
    seeCallTime: async (item: CallTimeSet) => say(await markSeen.mutateAsync(item.id), t('console.floor.toast.callTimeSeen', { name: item.fullName })),
    stepTopUp: async (topUp: TopUp) => {
      const outcome = await setTopUp.mutateAsync({ sessionId: topUp.sessionId, inProgress: !topUp.isStarted });
      const text = t(topUp.isStarted ? 'console.floor.toast.topUpDone' : 'console.floor.toast.topUpStarted', { name: topUp.fullName });
      say(outcome, text, () => undo.mutateAsync({ kind: 'topUp', requestId: topUp.id }));
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
