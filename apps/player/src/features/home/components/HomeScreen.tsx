import { useFeature, useFloorTables, useMyWaitlist, type FloorTable, type WaitlistPlace } from '@rivr/db';
import { t } from '@rivr/i18n';
import { FeatureGate, Screen, Stack } from '@rivr/ui';
import type { ReactNode } from 'react';
import { BreakNotice } from './BreakNotice.tsx';
import { HomePromotions } from './HomePromotions.tsx';
import { RateVisit } from './RateVisit.tsx';
import { SeatNotice } from './SeatNotice.tsx';
import { UpcomingTournaments } from './UpcomingTournaments.tsx';

/**
 * Home: tonight's floor (design prompt, "Home"). The member's waitlist places first, then each table
 * with its stakes and how many wait, and Join (#38). The floor shows with feature floor.live_view.
 * During a break (#56), Home says until when tables are closed to the member, as in the prototype.
 * Seated, Home says where, and the call time left (#78). The live promotions page beneath (#86). The
 * club's upcoming tournaments above the tables, to register interest in (#636), and each table's open seats.
 * After a visit, Home asks how it was (#160, decision 0165). The tournament card and satellite tickets
 * (TonightHighlights, TournamentTickets) are hidden with the tournament module (decision 0284).
 * The waitlist's parts come from features/waitlist, through the route (#273), so no feature imports another.
 */
interface HomeScreenProps {
  /** The member's waitlist places, from features/waitlist (#273). */
  yourWaitlist: (places: readonly WaitlistPlace[]) => ReactNode;
  /** Tonight's tables with Join, from features/waitlist. */
  floor: (tables: readonly FloorTable[], places: readonly WaitlistPlace[]) => ReactNode;
}

export function HomeScreen({ yourWaitlist, floor }: HomeScreenProps) {
  const liveView = useFeature('floor.live_view');
  const tables = useFloorTables();
  const places = useMyWaitlist();
  const title = t('player.tonight.title');
  if (tables.isPending || places.isPending) return <Screen title={title} status="loading" />;
  if (tables.isError || places.isError) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([tables.refetch(), places.refetch()])} />;
  }
  // Without the live floor the member reads no tables: the gate below says so, not the empty state.
  const isEmpty = liveView.state === 'enabled' && tables.data.length === 0 && places.data.length === 0;
  if (isEmpty) return <Screen title={title} status="empty" emptyText={t('player.tonight.empty')} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <BreakNotice />
        <SeatNotice />
        <RateVisit />
        {yourWaitlist(places.data)}
        <UpcomingTournaments />
        <FeatureGate access={liveView}>
          {floor(tables.data, places.data)}
        </FeatureGate>
        <HomePromotions />
      </Stack>
    </Screen>
  );
}
