import { useFeature, useFloorTables, useMyWaitlist } from '@rivr/db';
import { t } from '@rivr/i18n';
import { FeatureGate, Screen, Stack } from '@rivr/ui';
import { BreakNotice } from './BreakNotice.tsx';
import { FloorList } from './FloorList.tsx';
import { YourWaitlist } from './YourWaitlist.tsx';

/**
 * Home: tonight's floor (design prompt, "Home"). The member's waitlist places first, then each table
 * with its stakes and how many wait, and Join (#38). The floor shows with feature floor.live_view.
 * During a break (#56), Home says until when tables are closed to the member, as in the prototype.
 */
export function HomeScreen() {
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
        <YourWaitlist places={places.data} />
        <FeatureGate access={liveView}>
          <FloorList tables={tables.data} places={places.data} />
        </FeatureGate>
      </Stack>
    </Screen>
  );
}
