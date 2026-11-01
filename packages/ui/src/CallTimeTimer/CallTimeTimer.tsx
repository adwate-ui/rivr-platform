import { formatDuration, t } from '@rivr/i18n';
import { figureClasses } from '../internal/tone.ts';
import { Text } from '../Text/Text.tsx';

export interface CallTimeTimerProps {
  /** Whole seconds left, as the database gives them; 0 when call time is done. */
  secondsLeft: number;
  /** Away from the table: the clock stands still. */
  isPaused?: boolean;
  /** `line`, one small line, on the dealer tablet and the live floor; `figure`, the time set large under its name, as the member's seat card shows it. */
  size?: 'line' | 'figure';
}

/**
 * A seated player's call time (#78): the time left before they may leave the game, paused while they
 * are away, or done. One line on the dealer tablet and the live floor; the seat card's figure on the player's Home
 * (UI polish audit A-08).
 */
export function CallTimeTimer({ secondsLeft, isPaused = false, size = 'line' }: CallTimeTimerProps) {
  if (secondsLeft <= 0) return <Text variant="small" tone="muted">{t('ui.callTime.done')}</Text>;
  const time = formatDuration(secondsLeft);
  if (size === 'figure') {
    return (
      <div className="flex flex-col gap-1">
        <Text variant="eyebrow" tone="muted">{isPaused ? t('ui.callTime.figurePaused') : t('ui.callTime.figureLeft')}</Text>
        <span className={figureClasses('title', 'default')}>{time}</span>
      </div>
    );
  }
  return <Text variant="small">{isPaused ? t('ui.callTime.paused', { time }) : t('ui.callTime.left', { time })}</Text>;
}
