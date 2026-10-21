import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { cx } from '../internal/classes.ts';
import { LoopingVideo } from '../internal/webMedia.tsx';
import { Text } from '../Text/Text.tsx';

export interface HeroBlockProps {
  /** A line above the heading: `RIVR Poker Club · Gurugram`. */
  eyebrow?: string | undefined;
  /** The page's one h1. */
  heading: string;
  text?: string | undefined;
  /** The page's one gold action, a link: on the website, the hand-off to the player app. */
  action?: { readonly label: string; readonly href: string } | undefined;
  /** A muted loop of the room beside the heading, and its first frame (decision 0118). */
  video?: { readonly src: string; readonly poster: string } | undefined;
  /** Beside the video, as the teaser says it: `Concept visualisation`. */
  note?: string | undefined;
}

/**
 * A website page's opening block: an eyebrow, the heading set large, a line or two and the action; on the
 * front page, the room's loop beside them (#441), above them on a phone.
 */
export function HeroBlock({ eyebrow, heading, text, action, video, note }: HeroBlockProps) {
  return (
    <section className={cx('mx-auto grid max-w-console items-center gap-10 px-6 py-16 tablet:py-24', video && 'tablet:grid-cols-2 tablet:gap-16')}>
      <div className="flex flex-col items-start gap-6">
        {eyebrow ? <Text variant="eyebrow" tone="accent">{eyebrow}</Text> : null}
        <Heading level={1} variant="hero">
          {heading}
        </Heading>
        {text ? (
          <div className="max-w-text">
            <Text variant="lead" tone="muted">{text}</Text>
          </div>
        ) : null}
        {action ? (
          <Button variant="primary" size="large" href={action.href}>
            {action.label}
          </Button>
        ) : null}
      </div>
      {video ? (
        <div className="order-first tablet:order-last">
          <LoopingVideo src={video.src} poster={video.poster} note={note} />
        </div>
      ) : null}
    </section>
  );
}
