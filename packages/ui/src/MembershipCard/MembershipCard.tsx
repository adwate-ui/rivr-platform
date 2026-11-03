import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { Text } from '../Text/Text.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export interface MembershipCardProps {
  /** The member's name, as on their KYC. */
  name: string;
  /** Their tier: `Black card`. */
  tier: string;
  /** Their membership number, as the club writes it. */
  memberNumber: string;
  /** What the door scans, drawn in the cream square: the member's QR. The square stays empty without it. */
  qr?: ReactNode;
  /** The member's photo between the wordmark and their name: a filling `KycPhoto` (decision 0300). None without one. */
  photo?: ReactNode;
  /**
   * `redesign`, the player app's card tab (decision 0320): gold-edged, the wordmark and "No. 73" along the top, the 64 × 80
   * selfie, the name in the display face and the tier in gold along the foot; the QR goes under it on its own panel.
   */
  look?: 'classic' | 'redesign';
}

/**
 * The digital membership card: an ID-1 card on green-black, the wordmark above the member's name, tier and
 * number, any photo between, and beside them a cream square, as large as the card allows, for the QR the door scans. It fills
 * its container up to `tokens.viewport.card` wide; @rivr/render draws it at that size.
 */
export function MembershipCard({ name, tier, memberNumber, qr, photo, look = 'classic' }: MembershipCardProps) {
  if (look === 'redesign') return <RedesignCard name={name} tier={tier} memberNumber={memberNumber} photo={photo} />;
  return (
    <article
      aria-label={t('ui.membershipCard.label')}
      className="flex aspect-card w-full max-w-card items-center gap-4 rounded-lg border border-hairline bg-raised p-4 text-content"
    >
      {/* As narrow as the wordmark, so the QR square takes the rest; a long name wraps beneath it. */}
      <div className="flex h-full w-min shrink-0 flex-col justify-between gap-2">
        <Wordmark />
        {/* The photo takes the height left, so a long name that wraps shrinks it rather than the card growing. */}
        {photo === undefined ? null : <div className="min-h-0 flex-1">{photo}</div>}
        <div className="flex flex-col gap-1">
          <Text variant="lead" weight="semibold">
            {name}
          </Text>
          <Text variant="label" tone="muted">
            {tier}
          </Text>
          <Text variant="caption" tone="muted">
            {t('ui.membershipCard.number', { number: memberNumber })}
          </Text>
        </div>
      </div>
      {/* The cream around the QR is its quiet zone: about three modules, so a scanner finds its edges. */}
      <div className="flex aspect-square min-w-0 flex-1 items-center justify-center rounded-md bg-cream p-3">{qr}</div>
    </article>
  );
}

/**
 * The player app's card (decision 0320): no QR on it; the screen sets the QR under it. It spans a phone's column, as in the
 * prototype, no wider than a phone: capped at the classic card's 342 px it sat 8 px short of a 390 px phone's 350 px column,
 * flush left while the QR's panel under it is centred.
 */
function RedesignCard({ name, tier, memberNumber, photo }: Pick<MembershipCardProps, 'name' | 'tier' | 'memberNumber' | 'photo'>) {
  return (
    <article aria-label={t('ui.membershipCard.label')}
      className="flex aspect-card w-full max-w-phone flex-col justify-between rounded-card border border-gold bg-raised p-5 text-content">
      <div className="flex items-start justify-between">
        <Wordmark />
        <span className="font-text text-12 font-medium tracking-wide text-accent uppercase">{t('ui.membershipCard.number', { number: memberNumber })}</span>
      </div>
      <div className="flex items-end gap-4">
        {photo === undefined ? null : <div className="h-20 w-16 shrink-0 overflow-hidden rounded-md border border-gold-edge">{photo}</div>}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-28 leading-tight">{name}</span>
          <span className="font-text text-13 text-accent">{tier}</span>
        </div>
      </div>
    </article>
  );
}
