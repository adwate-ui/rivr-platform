import type { KycRecord } from '@rivr/db';
import { formatDate, t } from '@rivr/i18n';
import { Button, Inline, Stack, StepScreen, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** The return state once the check is done: what was verified, the Aadhaar masked as stored. */
export function KycVerified({ record }: { record: KycRecord }) {
  const navigate = useNavigate();
  const rows = [
    { label: t('player.kyc.dateOfBirthLabel'), value: record.dateOfBirth ? formatDate(new Date(`${record.dateOfBirth}T12:00:00Z`)) : null },
    { label: t('player.kyc.aadhaarLabel'), value: record.maskedAadhaar },
    { label: t('player.kyc.panLabel'), value: record.pan },
  ].filter((row) => row.value !== null);
  return (
    <StepScreen
      title={t('player.kyc.verifiedTitle')}
      footer={
        <Button variant="primary" fullWidth onClick={() => void navigate({ to: '/', replace: true })}>
          {t('player.kyc.continue')}
        </Button>
      }
    >
      <Stack divided>
        {rows.map((row) => (
          <Inline key={row.label} justify="between">
            <Text tone="muted">{row.label}</Text>
            <Text>{row.value}</Text>
          </Inline>
        ))}
      </Stack>
    </StepScreen>
  );
}
