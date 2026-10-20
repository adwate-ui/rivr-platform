import { useFeature, useFloorTables, useMyTonight, useMyWaitlist } from '@rivr/db';
import { t } from '@rivr/i18n';
import { FeatureGate, Screen, Stack } from '@rivr/ui';
import { BreakNotice } from './BreakNotice.tsx';
import { FloorList } from './FloorList.tsx';
import { HomePromotions } from './HomePromotions.tsx';
import { SeatNotice } from './SeatNotice.tsx';
import { TonightHighlights } from './TonightHighlights.tsx';
import { YourWaitlist } from './YourWaitlist.tsx';

/**
 * Home: tonight's floor (design prompt, "Home"). The member's waitlist places first, then each table
 * with its stakes and how many wait, and Join (#38). The floor shows with feature floor.live_view.
 * During a break (#56), Home says until when tables are closed to the member, as in the prototype.
 * Seated, Home says where, and the call time left (#78). The live promotions page beneath (#86). The
 * jackpot and the next tournament above the tables, each table's open seats, and Join held until the
 * member's identity check is done (#87); these come quietly, and the database refuses Join without it anyway.
 */
export function HomeScreen() {
  const liveView = useFeature('floor.live_view');
  const tables = useFloorTables();
  const places = useMyWaitlist();
  const tonight = useMyTonight();
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
        <YourWaitlist places={places.data} />
        {tonight.data ? <TonightHighlights tonight={tonight.data} /> : null}
        <FeatureGate access={liveView}>
          <FloorList tables={tables.data} places={places.data} isKycComplete={tonight.data?.isKycComplete ?? true} />
        </FeatureGate>
        <HomePromotions />
      </Stack>
    </Screen>
  );
}
