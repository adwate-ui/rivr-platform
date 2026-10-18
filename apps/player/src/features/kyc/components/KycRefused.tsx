import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/**
 * A check the club refused: under 18, or an identity another member already holds. The member is
 * not told which, and staff at the front desk take it from there.
 */
export function KycRefused() {
  const navigate = useNavigate();
  return (
    <StepScreen
      title={t('player.kyc.refusedTitle')}
      footer={
        <Button variant="primary" fullWidth onClick={() => void navigate({ to: '/', replace: true })}>
          {t('player.kyc.continue')}
        </Button>
      }
    >
      <Text>{t('player.kyc.refused')}</Text>
    </StepScreen>
  );
}
