import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';

/** Identity while the member's record loads. */
export function KycLoading() {
  return (
    <StepScreen title={t('player.kyc.title')} footer={null}>
      <Text tone="muted">{t('common.loading')}</Text>
    </StepScreen>
  );
}

/** Identity when the member's record could not be read: nothing else is offered until it is. */
export function KycLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <StepScreen
      title={t('player.kyc.title')}
      footer={
        <Button variant="primary" fullWidth onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    >
      <Text>{t('player.kyc.unavailable')}</Text>
    </StepScreen>
  );
}
