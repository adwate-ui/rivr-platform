import { t } from '@rivr/i18n';
import { Button, Skeleton, StepScreen, Text } from '@rivr/ui';

/** Identity while the member's record loads: faint blocks, never the word (decision 0320). */
export function KycLoading() {
  return (
    <StepScreen footer={null}>
      <Skeleton />
    </StepScreen>
  );
}

/** Identity when the member's record could not be read: nothing else is offered until it is. */
export function KycLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <StepScreen
      title={t('player.kyc.title')}
      footer={
        <Button variant="primary" size="tall" fullWidth onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    >
      <Text>{t('player.kyc.unavailable')}</Text>
    </StepScreen>
  );
}
