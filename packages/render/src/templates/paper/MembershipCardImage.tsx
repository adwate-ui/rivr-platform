import { MembershipCard } from '@rivr/ui';

export interface MembershipCardImageProps {
  name: string;
  tier: string;
  memberNumber: string;
}

/**
 * The membership card as an image, at `tokens.viewport.card` and scale 3. Its QR square is left empty: the
 * QR rotates (#71), so the app draws it live and an image never carries one that could be replayed.
 */
export function MembershipCardImage({ name, tier, memberNumber }: MembershipCardImageProps) {
  return <MembershipCard name={name} tier={tier} memberNumber={memberNumber} />;
}
