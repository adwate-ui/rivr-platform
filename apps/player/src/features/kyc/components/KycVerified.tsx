import { useMember } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, DoneMark, Heading, Stack, StepScreen, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** The check is done (decision 0320): a gold tick, "Verified", a welcome by first name, and on to the tables. */
export function KycVerified() {
  const navigate = useNavigate();
  const firstName = useMember().data?.fullName.split(' ')[0] ?? '';
  return (
    <StepScreen
      align="center"
      footer={
        <Button variant="primary" size="tall" fullWidth onClick={() => void navigate({ to: '/', replace: true })}>
          {t('player.kyc.toTonight')}
        </Button>
      }
    >
      <Stack gap={4} align="start">
        <DoneMark />
        <Heading level={1} variant="serif" serifSize={44}>{t('player.kyc.verifiedTitle')}</Heading>
        {firstName ? <Text tone="muted">{t('player.kyc.welcome', { name: firstName })}</Text> : null}
      </Stack>
    </StepScreen>
  );
}
