import { Heading } from '../Heading/Heading.tsx';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';
import { TvStage } from '../TvStage/TvStage.tsx';

/** Where a slide sits in the rotation: the 2nd of 3, and that said in words for a screen reader. */
export interface TvSlidePager {
  current: number;
  count: number;
  label: string;
}

export interface TvPromotionSlideProps {
  /** The board's title, in the stage's header: "Promotions". */
  board: string;
  /** The board title's heading level: 1 on the TV, 2 where the slide is a preview inside another screen. The promotion's title is one below. */
  level?: 1 | 2;
  /** Letter-spaced in gold above the title: "Offer". */
  label: string;
  /** The promotion, as published: "Friday four-hour bonus". */
  title: string;
  /** What it gives: "1,000 Bonus after 4 hours". */
  detail?: string | undefined;
  /** When it runs, in IST: "Every night", "Thursday, 14:00 to 20:00". */
  when?: string | undefined;
  /** The quiet pager under a slide in a rotation of more than one. */
  pager?: TvSlidePager | undefined;
}

function Pager({ current, count, label }: TvSlidePager) {
  return (
    <div role="img" aria-label={label} className="flex items-center justify-center gap-4">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={cx('h-4 rounded-full', index + 1 === current ? 'w-12 bg-accent' : 'w-4 bg-content opacity-hairline')} />
      ))}
    </div>
  );
}

/**
 * A promotion on the TV (#64; redesign RD-28), on the Promotions board: the label in gold capitals, the title large in the
 * display face, what it gives, when it runs, and a quiet pager when it is one of several, the current one a gold pill. It
 * holds no state: the TV's rotation passes the slide and its place.
 */
export function TvPromotionSlide({ board, label, title, detail, when, pager, level = 1 }: TvPromotionSlideProps) {
  return (
    <TvStage title={board} level={level}>
      <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
        <p className="font-text text-28 font-medium uppercase leading-snug tracking-tv text-accent">{label}</p>
        <Heading level={level === 1 ? 2 : 3} variant="poster" align="center">{title}</Heading>
        {detail === undefined ? null : <p className="font-text text-48 leading-tight text-content">{detail}</p>}
        {when === undefined ? null : <Text variant="tvBody" tone="muted" align="center">{when}</Text>}
        {pager === undefined || pager.count < 2 ? null : <Pager {...pager} />}
      </div>
    </TvStage>
  );
}
