import { useTvSocialWall, type TvWallPost } from '@rivr/db/social';
import { t } from '@rivr/i18n';
import { Heading, Stack, Text, TvPromotionSlide, type TvPromotionSlideProps } from '@rivr/ui';
import { useSlides } from './PromotionsMode.tsx';

/** A post as its slide: the poster's handle over the caption, with the pager's place. */
export function wallSlide(post: TvWallPost, current: number, count: number): TvPromotionSlideProps {
  const position = { current, count };
  return {
    label: t('tv.socialWall.label'), title: t('tv.socialWall.handle', { handle: post.handle }), detail: post.caption === '' ? undefined : post.caption,
    pager: { ...position, label: t('tv.socialWall.pager', position) },
  };
}

/**
 * The TV's social wall (#158; decision 0267): the club's approved Instagram posts, one every 12 seconds with a quiet
 * pager beneath, as the promotions turn. In a TV's rotation, `onDone` once each has shown, or at once when there are none.
 */
export function SocialWallMode({ onDone }: { onDone?: (() => void) | undefined }) {
  const wall = useTvSocialWall();
  const shown = useSlides(wall.data?.length ?? (wall.isError ? 0 : undefined), onDone);
  if (wall.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(wall.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  const post = wall.data[shown];
  if (post === undefined) {
    return (
      <Stack gap={4}>
        <Heading level={1} variant="display">{t('tv.modes.social_wall')}</Heading>
        <Text variant="tvBody" tone="muted">{t('tv.socialWall.none')}</Text>
      </Stack>
    );
  }
  return <TvPromotionSlide {...wallSlide(post, shown + 1, wall.data.length)} />;
}
