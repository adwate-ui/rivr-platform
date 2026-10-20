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
}

/**
 * The digital membership card: an ID-1 card on green-black, the wordmark above the member's name, tier and
 * number, and beside them a cream square, as large as the card allows, for the QR the door scans. It fills
 * its container up to `tokens.viewport.card` wide; @rivr/render draws it at that size.
 */
export function MembershipCard({ name, tier, memberNumber, qr }: MembershipCardProps) {
  return (
    <article
      aria-label={t('ui.membershipCard.label')}
      className="flex aspect-card w-full max-w-card items-center gap-4 rounded-lg border border-hairline bg-raised p-4 text-content"
    >
      {/* As narrow as the wordmark, so the QR square takes the rest; a long name wraps beneath it. */}
      <div className="flex h-full w-min shrink-0 flex-col justify-between">
        <Wordmark />
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
      <div className="flex aspect-square min-w-0 flex-1 items-center justify-center rounded-md bg-cream p-2">{qr}</div>
    </article>
  );
}
