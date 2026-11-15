import { t } from '@rivr/i18n';
import { Text, TvStage } from '@rivr/ui';
import { useSkipWhenEmpty } from './useSkipWhenEmpty.ts';

/**
 * The High hand bonus board (redesign RD-28, render tv-boards-05). The board itself, the hands that pay and tonight's
 * payouts, comes with the high hand bonus (#968) and is joined here: its component stands on TvStage with this title,
 * and its read says when there is nothing to show. Until then the board has nothing to show: in a rotation it passes its
 * turn on, and alone it says so.
 */
export function HighHandMode({ onEmpty }: { onEmpty?: (() => void) | undefined }) {
  useSkipWhenEmpty(true, onEmpty);
  return (
    <TvStage title={t('tv.highHand.title')}>
      <Text variant="tvBody" tone="muted">{t('tv.highHand.empty')}</Text>
    </TvStage>
  );
}
