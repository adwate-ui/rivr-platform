import { useFloorTables, useMySeat, useMyUpcomingTournaments, useMyWaitlist, type FloorTable, type MySeat, type WaitlistPlace } from '@rivr/db';
import { useMyNotices } from '@rivr/db/notices';
import { t } from '@rivr/i18n';
import { Box, haptic, PeekBar, PlayerDock, Screen, Sheet, SheetPanel, Stack, useToast } from '@rivr/ui';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { isCallTimeEnding, minutesLeftToSay } from '@rivr/domain/callTime';
import { useNow } from '../hooks/useNow.ts';
import { usePushAction, type PushTarget } from '../hooks/usePushAction.ts';
import { JoinSheet } from './JoinSheet.tsx';
import { RateVisit } from './RateVisit.tsx';
import { callSecondsLeft, SeatedView } from './SeatedView.tsx';
import type { SeatSheet } from './SeatSheets.tsx';
import { SeatReadyView } from './SeatReadyView.tsx';
import { runningLine, TablesList } from './TablesList.tsx';
import { TonightBanners } from './TonightBanners.tsx';
import { TonightHeader } from './TonightHeader.tsx';
import { TonightOffers } from './TonightOffers.tsx';
import { WaitingView } from './WaitingView.tsx';

/** Where the member stands tonight, which fills the screen (decision 0320). */
type Standing =
  | { kind: 'browsing' }
  | { kind: 'waiting'; place: WaitlistPlace }
  | { kind: 'ready'; place: WaitlistPlace & { holdUntil: string } }
  | { kind: 'seated'; seat: MySeat };

function standingOf(seat: MySeat | null, places: readonly WaitlistPlace[]): Standing {
  if (seat !== null) return { kind: 'seated', seat };
  const [place] = places;
  if (place === undefined) return { kind: 'browsing' };
  return place.holdUntil === null ? { kind: 'waiting', place } : { kind: 'ready', place: { ...place, holdUntil: place.holdUntil } };
}

/** What a push's button may act on (usePushAction): the place called, or a seat whose call time still runs. */
function pushTargetOf(standing: Standing, isReady: boolean): PushTarget {
  return {
    isReady,
    calledEntryId: standing.kind === 'ready' ? standing.place.entryId : null,
    canAddTime: standing.kind === 'seated' && standing.seat.hasCallTime && (standing.seat.callTimeLeft ?? 0) > 0,
  };
}

/** The phone buzzes as the seat is called and as the member sits (brief 2.5), and a toast says where they sat. */
function useArrivals(standing: Standing) {
  const toast = useToast();
  const last = useRef(standing.kind);
  useEffect(() => {
    const before = last.current;
    last.current = standing.kind;
    if (before === standing.kind || before === 'seated') return;
    if (standing.kind === 'ready') haptic();
    if (standing.kind === 'seated' && before !== 'browsing') {
      haptic();
      toast(t('player.live.seated.seatedToast', { table: standing.seat.tableName, seat: standing.seat.seat }));
    }
  }, [standing, toast]);
}

/** What the member's standing shows: offers and the tables while browsing, else their place, their seat call or their seat. */
function StandingView({ standing, now, offer, onJoin, tables, sheet }: {
  standing: Standing; now: Date; offer: ReactNode; onJoin: (table: FloorTable) => void; tables: readonly FloorTable[];
  sheet: { open: SeatSheet | null; set: (sheet: SeatSheet | null) => void };
}) {
  switch (standing.kind) {
    case 'waiting': return <WaitingView place={standing.place} offer={offer} />;
    case 'ready': return <SeatReadyView place={standing.place} now={now} />;
    case 'seated': return <SeatedView seat={standing.seat} now={now} sheet={sheet.open} onSheet={sheet.set} />;
    default: return (
      <Stack gap={4}>
        <RateVisit />
        <TonightOffers />
        <SheetPanel title={t('player.live.allTables')} aside={runningLine(tables, 0)}><TablesList tables={tables} onOpen={onJoin} /></SheetPanel>
      </Stack>
    );
  }
}

/** While the member waits or plays, all the tables peek above the tab bar and open in a sheet. */
function TablesPeek({ tables }: { tables: readonly FloorTable[] }) {
  const [isOpen, setOpen] = useState(false);
  const tournaments = useMyUpcomingTournaments().data?.length ?? 0;
  return (
    <>
      <PlayerDock><PeekBar title={t('player.live.allTables')} aside={runningLine(tables, tournaments)} onOpen={() => setOpen(true)} /></PlayerDock>
      <Sheet isOpen={isOpen} onClose={() => setOpen(false)} title={t('player.live.allTables')} titleLook="plain"><TablesList tables={tables} /></Sheet>
    </>
  );
}

/** The header and the banners under it, at the top of every standing. */
function TonightTop({ seat, now, isBrowsing, shownAt, hasRefreshFailed, onRetry, onAddTime }: {
  seat: MySeat | null; now: Date; isBrowsing: boolean; shownAt: number; hasRefreshFailed: boolean; onRetry: () => void; onAddTime: () => void;
}) {
  const notices = useMyNotices().data ?? [];
  const left = seat === null || !seat.hasCallTime ? 0 : callSecondsLeft(seat, now);
  return (
    <Stack gap={2}>
      <TonightHeader seat={seat} now={now} />
      <Box paddingX={5}>
        <TonightBanners notices={notices} isBrowsing={isBrowsing} shownAt={shownAt} hasRefreshFailed={hasRefreshFailed} onRetry={onRetry}
          callEnding={isCallTimeEnding(left) ? { minutes: minutesLeftToSay(left), onAddTime } : undefined} />
      </Box>
    </Stack>
  );
}

/** Tonight's three reads together: the tables, the member's places and their seat, with one retry for all. */
function useTonight() {
  const tables = useFloorTables();
  const places = useMyWaitlist();
  const seat = useMySeat();
  return {
    tables, places, seat,
    isPending: tables.isPending || places.isPending || seat.isPending,
    hasFailed: tables.isError || places.isError || seat.isError,
    retry: () => void Promise.all([tables.refetch(), places.refetch(), seat.refetch()]),
  };
}

/**
 * Tonight (decision 0320, "Live night"): the member's own state fills the screen and the floor sits in a sheet. Browsing,
 * the offers and the tables, a table opening its join sheet; on a list, their place; called, the seat held for them; seated,
 * the call-time ring and what they do from the seat. Banners under the header. A first load is a skeleton; a refresh that
 * fails keeps what was shown, under a banner. `offer` is Profile's offer of seat-ready push, through the route.
 */
export function HomeScreen({ offer }: { offer: ReactNode }) {
  const tonight = useTonight();
  const [joining, setJoining] = useState<FloorTable | null>(null);
  const [seatSheet, setSeatSheet] = useState<SeatSheet | null>(null);
  const seat = tonight.seat.data ?? null;
  const standing = standingOf(seat, tonight.places.data ?? []);
  const now = useNow(standing.kind === 'ready' || standing.kind === 'seated');
  useArrivals(standing);
  const openAddTime = useCallback(() => setSeatSheet('addTime'), []);
  usePushAction(pushTargetOf(standing, !tonight.isPending), openAddTime);
  const title = t('player.live.title');
  const tables = tonight.tables.data;
  if (tonight.isPending) return <Screen title={title} isTitleHidden status="loading" loadingLook="skeleton" />;
  if (tables === undefined || tonight.places.data === undefined) return <Screen title={title} status="error" onRetry={tonight.retry} />;
  return (
    <Screen title={title} isTitleHidden>
      <TonightTop seat={seat} now={now} isBrowsing={standing.kind === 'browsing'} shownAt={tonight.tables.dataUpdatedAt}
        hasRefreshFailed={tonight.hasFailed} onRetry={tonight.retry} onAddTime={openAddTime} />
      <StandingView standing={standing} now={now} offer={offer} onJoin={setJoining} tables={tables} sheet={{ open: seatSheet, set: setSeatSheet }} />
      {standing.kind === 'browsing' ? null : <TablesPeek tables={tables} />}
      <JoinSheet table={joining} onClose={() => setJoining(null)} />
    </Screen>
  );
}
