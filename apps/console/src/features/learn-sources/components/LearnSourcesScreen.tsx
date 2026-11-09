import { useStaffVenue } from '@rivr/db';
import { useLearnSources } from '@rivr/db/learnSources';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { useState } from 'react';
import { SourceTable } from './SourceTable.tsx';
import { SourceUpload } from './SourceUpload.tsx';

/**
 * The venue's sources and adding one; with none yet, the screen's one line and its one action, which opens the adding
 * (console v3). The upload is the screen's one primary.
 */
export function LearnSources({ venueId }: { venueId: string }) {
  const sources = useLearnSources(venueId);
  const [isAdding, setAdding] = useState(false);
  // The table's Export stands in the title row (audit F-207).
  const [exportIn, setExportIn] = useState<HTMLElement | null>(null);
  const title = t('console.learnSources.title');
  if (sources.data === undefined) {
    return sources.isError
      ? <Screen title={title} status="error" onRetry={() => void sources.refetch()} />
      : <Screen title={title} status="loading" loadingLook="rows" />;
  }
  if (sources.data.length === 0 && !isAdding) {
    return <Screen title={title} status="empty" emptyText={t('console.learnSources.none')}
      emptyAction={{ label: t('console.learnSources.addTitle'), onClick: () => setAdding(true) }} />;
  }
  return (
    <Screen title={title} onActionsSlot={setExportIn}>
      <Stack gap={8}>
        {sources.data.length === 0 ? null : <SourceTable rows={sources.data} exportIn={exportIn} />}
        <SourceUpload venueId={venueId} />
      </Stack>
    </Screen>
  );
}

/**
 * Learn content (#131; decision 0016), Content's second tab (console v3): the venue's licensed encodings and their
 * licences, and adding one once it passes the drill engine's checks. The staff's tool alone: Learn stays off for members
 * at launch (decision 0284).
 */
export function LearnSourcesScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('learn.manage_sources')) {
    return <Screen title={t('console.learnSources.title')} status="error" errorText={t('console.learnSources.notAllowed')} />;
  }
  return <LearnSources venueId={staff.venue.venueId} />;
}
