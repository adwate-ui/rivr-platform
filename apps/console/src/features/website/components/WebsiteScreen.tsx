import { useStaffVenue } from '@rivr/db';
import { useSitePages, type EditorPage } from '@rivr/db/siteEditor';
import { t } from '@rivr/i18n';
import { Box, Heading, Input, PickList, Screen, SplitView, Stack } from '@rivr/ui';
import { useState } from 'react';
import { PageEditor } from './PageEditor.tsx';
import { pageGroups, pageLabel } from './pagePicker.ts';

/** The page open: the one chosen, or the first in the list as shown, which a phone leaves out until one is chosen. */
function openPage(pages: readonly EditorPage[], chosenId: string | null, firstShown: string | undefined) {
  const chosen = pages.find((page) => page.pageId === chosenId);
  return { chosen, open: chosen ?? pages.find((page) => page.pageId === firstShown) };
}

/** The pages, found by name and grouped Club, Guides and Legal, beside the open page's editor (console v3). */
function Pages({ venueId, pages }: { venueId: string; pages: readonly EditorPage[] }) {
  const [query, setQuery] = useState('');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const groups = pageGroups(pages, query);
  const { chosen, open } = openPage(pages, chosenId, groups[0]?.items[0]?.id);
  return (
    <SplitView layout="even" isChosen={chosen !== undefined} backLabel={t('console.website.back')} onBack={() => setChosenId(null)}
      list={<PickList label={t('console.website.list')} groups={groups} current={open?.pageId ?? null} onPick={setChosenId}
        emptyText={t('console.website.noMatch')}
        search={<Input type="search" label={t('console.website.find')} value={query} autoComplete="off" onChange={(event) => setQuery(event.target.value)} />} />}
      detail={open === undefined ? null : (
        <Box surface="raised" radius="md" padding={5}>
          <Stack gap={6}>
            <Heading level={2} variant="section">{pageLabel(open)}</Heading>
            <PageEditor key={open.pageId} venueId={venueId} page={open} />
          </Stack>
        </Box>
      )} />
  );
}

/** The website's pages beside the open page's editor, or the list's loading, empty or error state. */
export function Website({ venueId }: { venueId: string }) {
  const pages = useSitePages(venueId);
  const title = t('console.website.title');
  if (pages.data === undefined) {
    return pages.isError
      ? <Screen title={title} status="error" onRetry={() => void pages.refetch()} />
      : <Screen title={title} status="loading" loadingLook="rows" />;
  }
  if (pages.data.length === 0) return <Screen title={title} status="empty" emptyText={t('console.website.noPages')} />;
  return (
    <Screen title={title}>
      <Pages venueId={venueId} pages={pages.data} />
    </Screen>
  );
}

/**
 * The website editor (#129; features "Website editing"; decision 0270), Content's first tab (console v3), for super
 * admins and marketing (website.edit): a page's words changed in place, saved as a draft, previewed as the website draws
 * it, and published now or at a time; every version kept, and any earlier one published again in one click.
 */
export function WebsiteScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('website.edit')) {
    return <Screen title={t('console.website.title')} status="error" errorText={t('console.website.notAllowed')} />;
  }
  return <Website venueId={staff.venue.venueId} />;
}
