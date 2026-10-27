import { useKycRecord } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/**
 * Above tonight's tables while the member's identity check is not done: Join waits for it (#87). As in
 * Profile, Finish identity check is offered only while the check is the member's to finish, not while
 * staff hold it or once it was refused.
 */
export function KycJoinNotice() {
  const navigate = useNavigate();
  const status = useKycRecord().data?.status;
  const canFinish = status === undefined || status === 'started' || status === 'needs_pan';
  return (
    <Stack gap={2} align="start">
      <Text>{t('player.tonight.kycIncomplete')}</Text>
      {canFinish ? <Button variant="secondary" onClick={() => void navigate({ to: '/kyc' })}>{t('player.tonight.finishKyc')}</Button> : null}
    </Stack>
  );
}
