import { useContentBonusLine, useSaveContentBonusLine, useStaffVenue, type BonusLineFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Screen, Stack, StatusMessage } from '@rivr/ui';
import { useState } from 'react';

/** The Bonus card's line, as typed: the club's own, or blank for the app's (#1065). */
function BonusLineForm({ venueId, saved }: { venueId: string; saved: string | null }) {
  const save = useSaveContentBonusLine(venueId);
  const [line, setLine] = useState(saved ?? '');
  const [outcome, setOutcome] = useState<BonusLineFailure | 'saved' | null>(null);
  const submit = async () => {
    const done = await save.mutateAsync(line);
    setOutcome(done.ok ? 'saved' : done.error);
  };
  return (
    <Stack gap={4}>
      <Input label={t('console.website.app.bonusLine')} hint={t('console.website.app.bonusLineHint', { line: t('common.bonusLineDefault') })}
        value={line} maxLength={120} autoComplete="off" onChange={(event) => {
          setLine(event.target.value);
          setOutcome(null);
        }} />
      <Inline gap={4}>
        <Button variant="subtle" isLoading={save.isPending} onClick={() => void submit()}>{t('console.website.app.save')}</Button>
        <StatusMessage>{outcome === 'saved' ? t('console.website.app.saved') : null}</StatusMessage>
      </Inline>
      {outcome !== null && outcome !== 'saved' ? <ErrorMessage>{t(`console.website.app.failures.${outcome}`)}</ErrorMessage> : null}
    </Stack>
  );
}

/** The App tab for a venue: the line once read, or loading, or failed with a retry. */
export function AppContent({ venueId }: { venueId: string }) {
  const line = useContentBonusLine(venueId);
  const title = t('console.website.app.title');
  if (line.isPending) return <Screen title={title} status="loading" />;
  if (line.isError) return <Screen title={title} status="error" onRetry={() => void line.refetch()} />;
  return <Screen title={title}><BonusLineForm venueId={venueId} saved={line.data} /></Screen>;
}

/**
 * Content's App tab (#1065, the owner, 17 Nov), for those who edit Content (website.edit): the words the player app shows
 * that the club writes, today the Bonus card's line. The expiry sentence after it stays automatic from Settings.
 */
export function AppContentScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('website.edit')) {
    return <Screen title={t('console.website.app.title')} status="error" errorText={t('console.website.notAllowed')} />;
  }
  return <AppContent venueId={staff.venue.venueId} />;
}
