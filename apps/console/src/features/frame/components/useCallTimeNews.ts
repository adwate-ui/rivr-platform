import type { SeatedPlayer } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { useToast } from '@rivr/ui';
import { useEffect, useRef } from 'react';

/** What the floor is told of one seat's change: set (none was before) or extended, with when they leave. */
function newsOf(player: SeatedPlayer, before: SeatedPlayer): string {
  const words = { name: player.fullName, time: player.callTimeEndsAt === null ? '' : formatTime(new Date(player.callTimeEndsAt)) };
  if (before.callTimeSetAt === null) return t(player.callTimeEndsAt === null ? 'console.floor.toast.callTimeSetAway' : 'console.floor.toast.callTimeSet', words);
  return t(player.callTimeEndsAt === null ? 'console.floor.toast.callTimeExtendedAway' : 'console.floor.toast.callTimeExtended', words);
}

/** The changes seen of each seat: a change read again, or one undone back to an earlier one, tells nothing. */
type Seen = ReadonlyMap<string, { readonly player: SeatedPlayer; readonly changes: ReadonlySet<string> }>;

/** The seats a read finds a member's new change on, and what was seen of each now. */
function readOf(seats: readonly SeatedPlayer[], seen: Seen | null): { fresh: { player: SeatedPlayer; before: SeatedPlayer }[]; next: Seen } {
  const fresh: { player: SeatedPlayer; before: SeatedPlayer }[] = [];
  const next = new Map(seats.map((player) => {
    const was = seen?.get(player.sessionId);
    const id = player.callTimeChangeId;
    const isNew = was !== undefined && id !== null && !was.changes.has(id);
    if (isNew && player.isCallTimeSetByMember) fresh.push({ player, before: was.player });
    const changes = new Set(was?.changes ?? []);
    if (id !== null) changes.add(id);
    return [player.sessionId, { player, changes }];
  }));
  return { fresh, next };
}

/**
 * Tells the floor, on any screen, when a member sets or extends their call time from the app (#1076, the owner, 18 Nov): a
 * toast with when they now leave, one for each read (the names together when more than one); the rail's chime rings for it
 * too (the callTimeSet count). Each change once, from the seats the header already reads: nothing on the first read, for
 * the floor's own Set or Extend, or for an Undo that brings back an earlier change.
 */
export function useCallTimeNews(seats: readonly SeatedPlayer[] | undefined) {
  const toast = useToast();
  const seen = useRef<Seen | null>(null);
  useEffect(() => {
    if (seats === undefined) return;
    const { fresh, next } = readOf(seats, seen.current);
    const isFirst = seen.current === null;
    seen.current = next;
    if (isFirst || fresh.length === 0) return;
    const [one] = fresh;
    toast(fresh.length === 1 && one !== undefined ? newsOf(one.player, one.before)
      : t('console.floor.toast.callTimeMany', { names: fresh.map(({ player }) => player.fullName).join(', ') }));
  }, [seats, toast]);
}
