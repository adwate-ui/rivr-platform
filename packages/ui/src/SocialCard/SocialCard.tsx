import { Heading } from '../Heading/Heading.tsx';
import { Money } from '../Money/Money.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export interface SocialCardProps {
  /** Letter-spaced above the title: what the card announces (Tournament, Winner). */
  label: string;
  /** The display line: the tournament, the promotion, the winner, the hand. */
  title: string;
  /** The figure in gold, when the card has one: a guarantee, a prize. */
  amountPaise?: bigint | undefined;
  /** Directly beneath the figure, what it is: `Guaranteed`. */
  amountLabel?: string | undefined;
  /** Short lines beneath: when, the buy-in, the table. */
  details: readonly string[];
  /** The foot: where the club is. */
  venue: string;
}

/**
 * A social post for @rivr/render. It fills the page it is drawn on: a feed post at
 * `tokens.viewport.feed` (1080 by 1350) or a story at `tokens.viewport.story` (1080 by 1920), so the
 * size is set once, by the render request. The wordmark at the head; what it announces anchored above
 * the club's address at the foot. The figure, when there is one, is the hero in gold; without one,
 * the title is. Flat green, no imagery. Unlike DisplayShell, nothing is scaled.
 */
export function SocialCard({ label, title, amountPaise, amountLabel, details, venue }: SocialCardProps) {
  return (
    <article className="flex h-dvh w-full flex-col gap-16 bg-surface p-24 text-content">
      <Wordmark size="lg" withTagline />
      <Stack grow justify="end" gap={8}>
        <Text variant="posterLabel" tone="muted">
          {label}
        </Text>
        <Heading level={1} variant={amountPaise === undefined ? 'poster' : 'display'}>
          {title}
        </Heading>
        {amountPaise === undefined ? null : (
          <Stack gap={2}>
            <Money paise={amountPaise} size="jackpot" tone="player" />
            {amountLabel ? <Text variant="posterLabel">{amountLabel}</Text> : null}
          </Stack>
        )}
        <Stack gap={2}>
          {details.map((detail, position) => (
            <Text key={`${String(position)}-${detail}`} variant="tvBody">
              {detail}
            </Text>
          ))}
        </Stack>
      </Stack>
      <Text variant="tvBody" tone="muted">
        {venue}
      </Text>
    </article>
  );
}
