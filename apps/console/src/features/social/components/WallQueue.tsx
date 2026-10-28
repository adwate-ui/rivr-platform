import { useModerateWallPost, useWallPosts, type WallPost } from '@rivr/db/social';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Heading, Inline, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

type Moderate = (post: WallPost, isApproved: boolean) => void;

function columnsFor(moderate: Moderate): readonly DataTableColumn<WallPost>[] {
  return [
    { key: 'handle', header: t('console.social.wall.handle'), cell: (row) => t('console.social.wall.handleValue', { handle: row.handle }) },
    { key: 'caption', header: t('console.social.wall.caption'), cell: (row) => row.caption },
    { key: 'posted', header: t('console.social.wall.posted'), cell: (row) => formatDayTime(new Date(row.postedAt)) },
    { key: 'status', header: t('console.social.wall.status'), cell: (row) => t(`console.social.wall.statuses.${row.status}`) },
    { key: 'actions', header: t('console.social.wall.actions'), align: 'end', cell: (row) => (
      <Inline gap={2}>
        <Button variant="text" href={row.permalink} opensNewTab aria-label={t('console.social.wall.openName', { handle: row.handle })}>
          {t('console.social.wall.open')}
        </Button>
        <Button variant="secondary" isDisabled={row.status === 'approved'} onClick={() => moderate(row, true)}
          aria-label={t('console.social.wall.approveName', { handle: row.handle })}>{t('console.social.wall.approve')}</Button>
        <Button variant="text" isDisabled={row.status === 'rejected'} onClick={() => moderate(row, false)}
          aria-label={t('console.social.wall.rejectName', { handle: row.handle })}>{t('console.social.wall.reject')}</Button>
      </Inline>
    ) },
  ];
}

/** The social wall's queue (#157): posts that tag the club, newest first; approved ones rotate on the TVs and the website. */
export function WallQueue({ venueId }: { venueId: string }) {
  const posts = useWallPosts(venueId);
  const moderateWall = useModerateWallPost(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const moderate: Moderate = (post, isApproved) => void moderateWall.mutateAsync({ postId: post.postId, isApproved }).then((done) => {
    setFailure(done.ok ? null : t(`console.social.wall.failures.${done.error}`));
  });
  const base = { label: t('console.social.wall.table'), columns: columnsFor(moderate), rowKey: (row: WallPost) => row.postId };
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.social.wall.title')}</Heading>
      <Text variant="small" tone="muted">{t('console.social.wall.hint')}</Text>
      {posts.data === undefined && posts.isError ? <DataTable {...base} status="error" onRetry={() => void posts.refetch()} /> : null}
      {posts.data === undefined && !posts.isError ? <DataTable {...base} status="loading" /> : null}
      {posts.data === undefined ? null : <DataTable {...base} rows={posts.data} emptyText={t('console.social.wall.none')} />}
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}
