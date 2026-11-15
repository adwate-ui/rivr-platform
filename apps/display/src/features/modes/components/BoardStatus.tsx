import { t } from '@rivr/i18n';
import { LoadState, TvStage } from '@rivr/ui';

/** A board still reading, or unable to, in TV type (F-141), on the stage; the board's title comes with the board. */
export function BoardStatus({ isError }: { isError: boolean }) {
  return (
    <TvStage>
      <LoadState size="tv" isError={isError} errorText={t('display.screen.unavailable')} />
    </TvStage>
  );
}
