import { t } from '@rivr/i18n';
import { Button, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** Above tonight's tables while the member's identity check is not done: Join waits for it (#87). */
export function KycJoinNotice() {
  const navigate = useNavigate();
  return (
    <Stack gap={2} align="start">
      <Text>{t('player.tonight.kycIncomplete')}</Text>
      <Button variant="secondary" onClick={() => void navigate({ to: '/kyc' })}>{t('player.tonight.finishKyc')}</Button>
    </Stack>
  );
}
