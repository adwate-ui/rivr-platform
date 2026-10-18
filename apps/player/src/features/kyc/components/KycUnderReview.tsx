import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** A PAN alone, with no DigiLocker photo, waits for staff to see the member's documents at the club. */
export function KycUnderReview() {
  const navigate = useNavigate();
  return (
    <StepScreen
      title={t('player.kyc.reviewTitle')}
      footer={
        <Button variant="primary" fullWidth onClick={() => void navigate({ to: '/', replace: true })}>
          {t('player.kyc.continue')}
        </Button>
      }
    >
      <Text>{t('player.kyc.review')}</Text>
    </StepScreen>
  );
}
