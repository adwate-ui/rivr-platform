import { t } from '@rivr/i18n';
import { SocialCard, type SocialFormat } from '@rivr/ui';

export interface PromoCardProps {
  format: SocialFormat;
  /** The promotion, as published: `Double points`. */
  title: string;
  /** When it runs, as the promotion builder words it: `Thursday, 14:00 to 20:00`. */
  runs: string;
  /** Who it is for: `100/200`, `Black card`. */
  who: string;
  /** The club's address, from venue configuration. */
  venue: string;
}

/** A promotion card: what it is, when it runs and who it is for. No figure. */
export function PromoCard({ format, title, runs, who, venue }: PromoCardProps) {
  return <SocialCard format={format} label={t('social.promotion.label')} title={title} details={[runs, who]} venue={venue} />;
}
