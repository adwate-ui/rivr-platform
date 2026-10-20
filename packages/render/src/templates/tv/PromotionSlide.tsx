import { t } from '@rivr/i18n';
import { DisplayShell, TvPromotionSlide } from '@rivr/ui';

export interface PromotionSlideProps {
  /** The promotion, as published: "High hands". */
  title: string;
  /** What it gives, as published: "Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000". */
  detail?: string | undefined;
  /** When it runs, as the promotion builder words it in IST: "Every night". */
  when?: string | undefined;
  /** Its place in the rotation, from 1, and how many are live; the pager shows only with more than one. */
  position?: { current: number; count: number } | undefined;
}

/** TV slide, 1920 by 1080: one promotion in the TV's rotation, with a quiet pager. */
export function PromotionSlide({ title, detail, when, position }: PromotionSlideProps) {
  const pager = position === undefined ? undefined : { ...position, label: t('tv.promotion.pager', position) };
  return (
    <DisplayShell>
      <TvPromotionSlide label={t('tv.promotion.label')} title={title} detail={detail} when={when} pager={pager} />
    </DisplayShell>
  );
}
