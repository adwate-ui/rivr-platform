import { formatMoney, t } from '@rivr/i18n';
import { SocialCard, type SocialFormat } from '@rivr/ui';
import { when } from './when.ts';

export interface TournamentPosterProps {
  format: SocialFormat;
  /** The tournament: `RIVR Sunday`. */
  name: string;
  /** When it starts, an ISO timestamp. */
  startsAt: string;
  buyInPaise: bigint;
  /** The guaranteed prize pool, the figure in gold. */
  guaranteePaise: bigint;
  /** The club's address, from venue configuration. */
  venue: string;
}

/** A tournament poster: its name, the guarantee, when it starts and the buy-in. */
export function TournamentPoster({ format, name, startsAt, buyInPaise, guaranteePaise, venue }: TournamentPosterProps) {
  const details = [t('social.tournament.guaranteed'), when(startsAt), t('social.tournament.buyIn', { amount: formatMoney(buyInPaise) })];
  return <SocialCard format={format} label={t('social.tournament.label')} title={name} amountPaise={guaranteePaise} details={details} venue={venue} />;
}
