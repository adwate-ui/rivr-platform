import { useMember } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, DoneMark, Heading, Stack, StepScreen, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/**
 * The selfie is in while the club checks identity at the desk (decision 0502): a gold tick, "Registered", a welcome
 * by first name, what to bring on the first visit, and on into the app, as KycVerified does.
 */
export function KycRegistered() {
  const navigate = useNavigate();
  const firstName = useMember().data?.fullName.split(' ')[0] ?? '';
  return (
    <StepScreen pageTitle={t('player.kyc.registeredTitle')}
      align="center"
      footer={
        <Button variant="primary" size="tall" fullWidth onClick={() => void navigate({ to: '/', replace: true })}>
          {t('player.kyc.toTonight')}
        </Button>
      }
    >
      <Stack gap={4} align="center">
        <DoneMark />
        <Heading level={1} variant="serif" serifSize={44} align="center">{t('player.kyc.registeredTitle')}</Heading>
        {firstName ? <Text tone="muted" align="center">{t('player.kyc.welcome', { name: firstName })}</Text> : null}
        <Text align="center">{t('player.kyc.atTheDesk')}</Text>
      </Stack>
    </StepScreen>
  );
}
