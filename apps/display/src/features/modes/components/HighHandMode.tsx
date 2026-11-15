import { useTvHighHand } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Text, TvHighHandBoard, TvStage } from '@rivr/ui';
import { BoardStatus } from './BoardStatus.tsx';
import { toHighHandBoard } from './highHandBoard.ts';
import { useSkipWhenEmpty } from './useSkipWhenEmpty.ts';

/**
 * The High hand bonus board (redesign RD-28 and RD-25, render tv-boards-05): on the stage, the hands that pay with their
 * Bonus, the rules, and tonight's payouts, read again when one is paid and every half minute. With no high hand running,
 * or one not shown on the TVs, the board has nothing to show: in a rotation it passes its turn on, and alone it says so.
 */
export function HighHandMode({ onEmpty }: { onEmpty?: (() => void) | undefined }) {
  const board = useTvHighHand();
  useSkipWhenEmpty(board.data === null, onEmpty);
  if (board.data === undefined) return <BoardStatus isError={board.isError} />;
  return (
    <TvStage title={t('tv.highHand.title')}>
      {board.data === null
        ? <Text variant="tvBody" tone="muted">{t('tv.highHand.empty')}</Text>
        : <TvHighHandBoard {...toHighHandBoard(board.data, new Date(board.dataUpdatedAt))} />}
    </TvStage>
  );
}
