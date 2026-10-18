import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** A check staff finish at the club: a PAN alone, with no DigiLocker photo, or a DigiLocker record in another name. */
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
