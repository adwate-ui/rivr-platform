import { useModerateWallPost, useWallPosts, type WallPost, type WallStatus } from '@rivr/db/social';
import { formatWaitingSince, t } from '@rivr/i18n';
import { Box, Button, DotStatus, ErrorMessage, Inline, LoadState, Skeleton, Stack, Text, type DotStatusTone } from '@rivr/ui';
import { useState } from 'react';

type Moderate = (post: WallPost, isApproved: boolean) => void;

// Waiting needs someone (gold); on the wall it is live; not shown, faint.
const TONE: Readonly<Record<WallStatus, DotStatusTone>> = { pending: 'needsYou', approved: 'active', rejected: 'inactive' };

/** A post that tags the club: who and what, its status, and the moderation it can still take. */
function PostRow({ post, moderate }: { post: WallPost; moderate: Moderate }) {
  return (
    <Box as="article" paddingX={4} paddingY={3}>
      <Inline gap={4} justify="between" align="center" wrap>
        <Stack gap={1}>
          <Text variant="small" weight="medium">{t('console.social.wall.handleValue', { handle: post.handle })}</Text>
          <Text variant="caption" tone="muted">{t('console.social.wall.line', { caption: post.caption, posted: formatWaitingSince(new Date(post.postedAt)) })}</Text>
        </Stack>
        <Inline gap={2} align="center" wrap>
          <DotStatus tone={TONE[post.status]} label={t(`console.social.wall.statuses.${post.status}`)} />
          <Button variant="text" size="small" href={post.permalink} opensNewTab aria-label={t('console.social.wall.openName', { handle: post.handle })}>
            {t('console.social.wall.open')}
          </Button>
          {post.status === 'approved' ? null : (
            <Button variant="subtle" size="small" onClick={() => moderate(post, true)} aria-label={t('console.social.wall.approveName', { handle: post.handle })}>
              {t('console.social.wall.approve')}
            </Button>
          )}
          {post.status === 'rejected' ? null : (
            <Button variant="text" size="small" onClick={() => moderate(post, false)} aria-label={t('console.social.wall.rejectName', { handle: post.handle })}>
              {t('console.social.wall.reject')}
            </Button>
          )}
        </Inline>
      </Inline>
    </Box>
  );
}

/** The social wall's queue (#157): posts that tag the club, newest first; approved ones rotate on the TVs and the website. */
export function WallQueue({ venueId }: { venueId: string }) {
  const posts = useWallPosts(venueId);
  const moderateWall = useModerateWallPost(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const moderate: Moderate = (post, isApproved) => void moderateWall.mutateAsync({ postId: post.postId, isApproved }).then((done) => {
    setFailure(done.ok ? null : t(`console.social.wall.failures.${done.error}`));
  });
  if (posts.data === undefined) return posts.isError ? <LoadState isError onRetry={() => void posts.refetch()} /> : <Skeleton look="rows" rows={3} />;
  if (posts.data.length === 0) return <Text tone="muted">{t('console.social.wall.none')}</Text>;
  return (
    <Stack gap={3}>
      <Box as="section" aria-label={t('console.social.wall.table')} surface="raised" radius="md">
        <Stack gap={0}>{posts.data.map((post) => <PostRow key={post.postId} post={post} moderate={moderate} />)}</Stack>
      </Box>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}
