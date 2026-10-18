import { useKycRecord, type KycStatus } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, Heading, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

const KYC_LINE: Readonly<Record<KycStatus | 'none', MessageKey>> = {
  none: 'player.profile.kycIncomplete',
  started: 'player.profile.kycIncomplete',
  needs_pan: 'player.profile.kycIncomplete',
  needs_review: 'player.profile.kycReview',
  verified: 'player.profile.kycVerified',
  refused: 'player.profile.kycRefused',
};

/** The identity check: where it stands, and the way to finish it while the member still can. */
export function IdentitySection() {
  const record = useKycRecord();
  const navigate = useNavigate();
  const status = record.data?.status ?? 'none';
  const canFinish = status === 'none' || status === 'started' || status === 'needs_pan';
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.profile.identity')}</Heading>
      {record.isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {record.isError ? <Text>{t('common.loadFailed')}</Text> : null}
      {record.isSuccess ? <Text>{t(KYC_LINE[status])}</Text> : null}
      {record.isSuccess && canFinish ? (
        <Button variant="secondary" onClick={() => void navigate({ to: '/kyc' })}>
          {t('player.profile.finishKyc')}
        </Button>
      ) : null}
    </Stack>
  );
}
