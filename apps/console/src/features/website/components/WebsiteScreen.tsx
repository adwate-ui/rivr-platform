import { useStaffVenue } from '@rivr/db';
import { useSitePages } from '@rivr/db/siteEditor';
import { t } from '@rivr/i18n';
import { ChoiceChips, LoadState, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { PageEditor } from './PageEditor.tsx';

/** The pages to choose from, and the chosen one's editor. */
function Pages({ venueId }: { venueId: string }) {
  const pages = useSitePages(venueId);
  const [pageId, setPageId] = useState<string | null>(null);
  if (pages.data === undefined) return <LoadState isError={pages.isError} onRetry={() => void pages.refetch()} />;
  if (pages.data.length === 0) return <Text tone="muted">{t('console.website.noPages')}</Text>;
  const page = pages.data.find((each) => each.pageId === pageId);
  return (
    <Stack gap={6}>
      <ChoiceChips label={t('console.website.page')} mode="one" selected={pageId === null ? [] : [pageId]}
        options={pages.data.map((each) => ({ value: each.pageId, label: each.title }))} onChange={(picked) => setPageId(picked[0] ?? null)} />
      {page === undefined ? <Text tone="muted">{t('console.website.choosePage')}</Text> : <PageEditor key={page.pageId} venueId={venueId} page={page} />}
    </Stack>
  );
}

/**
 * The website editor (#129; features "Website editing"; decision 0270), for super admins and marketing (website.edit):
 * a page's words changed in place, saved as a draft, previewed as the website draws it, and published now or at a time;
 * every version kept, and any earlier one published again in one click.
 */
export function WebsiteScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('website.edit')) {
    return <Screen title={t('console.website.title')} status="error" errorText={t('console.website.notAllowed')} />;
  }
  return (
    <Screen title={t('console.website.title')}>
      <Stack gap={6}>
        <Text variant="small" tone="muted">{t('console.website.hint')}</Text>
        <Pages venueId={staff.venue.venueId} />
      </Stack>
    </Screen>
  );
}
