import { t } from '@rivr/i18n';
import { SocialCard } from '@rivr/ui';

export interface PromoCardProps {
  /** The promotion, as published: `Double points`, `Referral bonus`. */
  title: string;
  /** The reward in gold, when it is an amount: `₹1,000` each side of a referral. */
  rewardPaise?: bigint | undefined;
  /** When it runs, as the promotion builder words it in IST: `Thursday, 14:00 to 20:00`. */
  runs: string;
  /** Who it is for: `100/200`, `Black card`. */
  who: string;
  /** The club's address, from venue configuration. */
  venue: string;
}

/** A promotion card: what it is, its reward when that is an amount, when it runs and who it is for. */
export function PromoCard({ title, rewardPaise, runs, who, venue }: PromoCardProps) {
  return <SocialCard label={t('social.promotion.label')} title={title} amountPaise={rewardPaise} details={[runs, who]} venue={venue} />;
}
