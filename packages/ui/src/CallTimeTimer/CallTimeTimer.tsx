import { formatDuration, t } from '@rivr/i18n';
import { Text } from '../Text/Text.tsx';

export interface CallTimeTimerProps {
  /** Whole seconds left, as the database gives them; 0 when call time is done. */
  secondsLeft: number;
  /** Away from the table: the clock stands still. */
  isPaused?: boolean;
}

/**
 * A seated player's call time (#78): the time left before they may leave the game, paused while they
 * are away, or done. The same line on the player's Home, the dealer tablet and the live floor.
 */
export function CallTimeTimer({ secondsLeft, isPaused = false }: CallTimeTimerProps) {
  if (secondsLeft <= 0) return <Text variant="small" tone="muted">{t('ui.callTime.done')}</Text>;
  const time = formatDuration(secondsLeft);
  return <Text variant="small">{isPaused ? t('ui.callTime.paused', { time }) : t('ui.callTime.left', { time })}</Text>;
}
