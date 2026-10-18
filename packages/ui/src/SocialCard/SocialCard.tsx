import { tokens } from '@rivr/tokens';
import { Heading } from '../Heading/Heading.tsx';
import { Money } from '../Money/Money.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

/** `feed`: a post, 1080 by 1350 (4:5). `story`: a story or reel cover, 1080 by 1920 (9:16). */
export type SocialFormat = 'feed' | 'story';

export interface SocialCardProps {
  format: SocialFormat;
  /** Letter-spaced above the title: what the card announces (Tournament, Winner). */
  label: string;
  /** The display line: the tournament, the promotion, the winner, the hand. */
  title: string;
  /** The figure in gold, when the card has one: a guarantee, a prize. */
  amountPaise?: bigint | undefined;
  /** Short lines beneath: when, the buy-in, the table. */
  details: readonly string[];
  /** The foot: where the club is. */
  venue: string;
}

/**
 * A social post drawn at its exact size for @rivr/render: the wordmark, then what it announces, its
 * figure and details, and the club's address at the foot. Flat green, one gold figure, no imagery.
 */
export function SocialCard({ format, label, title, amountPaise, details, venue }: SocialCardProps) {
  const { width, height } = tokens.viewport[format];
  return (
    <article className="flex flex-col justify-between bg-surface px-24 py-24 text-content" style={{ width, height }}>
      <Wordmark size="lg" withTagline />
      <Stack gap={8}>
        <Text variant="tvLabel" tone="muted">
          {label}
        </Text>
        <Heading level={1} variant="display">
          {title}
        </Heading>
        {amountPaise === undefined ? null : <Money paise={amountPaise} size="jackpot" tone="player" />}
        <Stack gap={2}>
          {details.map((detail, position) => (
            <Text key={`${String(position)}-${detail}`} variant="tvBody">
              {detail}
            </Text>
          ))}
        </Stack>
      </Stack>
      <Text variant="tvLabel" tone="muted">
        {venue}
      </Text>
    </article>
  );
}
