import { useSocialPosts, type PostChannelStatus, type SocialPost } from '@rivr/db/social';
import { formatDayTime, t, type MessageKey } from '@rivr/i18n';
import { Button, DataTable, Heading, Inline, Stack, Text, type DataTableColumn } from '@rivr/ui';

/** A caption as a file to download: its text, as a data link. */
const captionLink = (caption: string) => `data:text/plain;charset=utf-8,${encodeURIComponent(caption)}`;

const STATUS_COPY: Readonly<Record<PostChannelStatus, MessageKey>> = {
  download: 'console.social.posts.toDownload',
  sending: 'console.social.posts.sending',
  published: 'console.social.posts.published',
};

/** Where a post went: each channel to download and post, being sent, or published with a link to the post (#586). */
function channelsOf(post: SocialPost) {
  return (
    <Inline gap={2}>
      {post.channels.map(({ channel, status, postUrl }) => {
        const label = t(STATUS_COPY[status], { channel: t(`console.social.channels.${channel}`) });
        return postUrl === null ? <Text key={channel}>{label}</Text> : <Button key={channel} variant="text" href={postUrl}>{label}</Button>;
      })}
    </Inline>
  );
}

const COLUMNS: readonly DataTableColumn<SocialPost>[] = [
  { key: 'when', header: t('console.social.posts.when'), cell: (row) => formatDayTime(new Date(row.createdAt)) },
  { key: 'caption', header: t('console.social.posts.caption'), cell: (row) => row.caption },
  { key: 'channels', header: t('console.social.posts.channels'), cell: (row) => channelsOf(row) },
  { key: 'download', header: t('console.social.posts.download'), align: 'end', cell: (row) => (
    <Inline gap={2}>
      <Button variant="text" href={row.imageUrl}>{t('console.social.posts.image')}</Button>
      <Button variant="text" href={captionLink(row.caption)} download="caption.txt">{t('console.social.posts.captionFile')}</Button>
    </Inline>
  ) },
];

/** The last posts (#154) and where each went; a channel without the club's credentials offers the image and caption to download. */
export function RecentPosts({ venueId }: { venueId: string }) {
  const posts = useSocialPosts(venueId);
  const base = { label: t('console.social.posts.table'), columns: COLUMNS, rowKey: (row: SocialPost) => row.postId };
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.social.posts.title')}</Heading>
      {posts.data === undefined && posts.isError ? <DataTable {...base} status="error" onRetry={() => void posts.refetch()} /> : null}
      {posts.data === undefined && !posts.isError ? <DataTable {...base} status="loading" /> : null}
      {posts.data === undefined ? null : <DataTable {...base} rows={posts.data} emptyText={t('console.social.posts.none')} />}
    </Stack>
  );
}
