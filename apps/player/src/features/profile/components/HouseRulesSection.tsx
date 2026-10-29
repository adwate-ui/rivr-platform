import { t } from '@rivr/i18n';
import { Button, Heading, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** The way to the house rules and the legal standing (#637), in Profile for every member. */
export function HouseRulesSection() {
  const navigate = useNavigate();
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.houseRules.title')}</Heading>
      <Text tone="muted">{t('player.houseRules.intro')}</Text>
      <Button variant="secondary" onClick={() => void navigate({ to: '/profile/rules' })}>{t('player.houseRules.open')}</Button>
    </Stack>
  );
}
