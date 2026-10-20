import { Heading } from '../Heading/Heading.tsx';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';

/** Where a slide sits in the rotation: the 2nd of 3, and that said in words for a screen reader. */
export interface TvSlidePager {
  current: number;
  count: number;
  label: string;
}

export interface TvPromotionSlideProps {
  /** Letter-spaced above the title: "Promotion". */
  label: string;
  /** The promotion, as published: "High hands". */
  title: string;
  /** What it gives: "Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000". */
  detail?: string | undefined;
  /** When it runs, in IST: "Every night", "Thursday, 14:00 to 20:00". */
  when?: string | undefined;
  /** The quiet pager under a slide in a rotation of more than one. */
  pager?: TvSlidePager | undefined;
}

function Pager({ current, count, label }: TvSlidePager) {
  return (
    <div role="img" aria-label={label} className="flex justify-center gap-4 pt-12">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={cx('size-3 bg-content', index + 1 === current ? '' : 'opacity-hairline')} />
      ))}
    </div>
  );
}

/**
 * A promotion on the TV (#64), as in the prototype's Promotions mode: the label, the title large in
 * the display face, what it gives, when it runs, and a quiet pager when it is one of several. It
 * holds no state: the TV's rotation passes the slide and its place.
 */
export function TvPromotionSlide({ label, title, detail, when, pager }: TvPromotionSlideProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <Text variant="tvLabel" tone="muted" align="center">{label}</Text>
      <Heading level={1} variant="poster" align="center">{title}</Heading>
      {detail === undefined ? null : <p className="font-text text-48 leading-tight text-content">{detail}</p>}
      {when === undefined ? null : <Text variant="tvBody" tone="muted" align="center">{when}</Text>}
      {pager === undefined || pager.count < 2 ? null : <Pager {...pager} />}
    </div>
  );
}
