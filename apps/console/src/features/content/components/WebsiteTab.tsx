import { useSitePages, type EditorPage } from '@rivr/db/siteEditor';
import { t } from '@rivr/i18n';
import { Box, Heading, Input, LoadState, PickList, Skeleton, SplitView, Stack, Text } from '@rivr/ui';
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

/**
 * The website editor (#129; features "Website editing"; decision 0270): a page's words changed in place, saved as a draft,
 * previewed as the website draws it, and published now or at a time; every version kept, and any earlier one published
 * again in one click.
 */
export function WebsiteTab({ venueId }: { venueId: string }) {
  const pages = useSitePages(venueId);
  if (pages.data === undefined) return pages.isError ? <LoadState isError onRetry={() => void pages.refetch()} /> : <Skeleton look="rows" rows={6} />;
  if (pages.data.length === 0) return <Text tone="muted">{t('console.website.noPages')}</Text>;
  return <Pages venueId={venueId} pages={pages.data} />;
}
