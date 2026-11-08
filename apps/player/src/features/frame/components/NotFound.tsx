import { t } from '@rivr/i18n';
import { Button, Heading, Stack, Text, usePageTitle } from '@rivr/ui';

/** Shown for an address the app does not have (decision 0320): what happened, and the way back to Home. No status code. */
export function NotFound() {
  usePageTitle(t('player.notFound.title'));
  return (
    <Stack gap={3} justify="center" align="start" grow>
      <Heading level={1} variant="serif" serifSize={32}>{t('player.notFound.title')}</Heading>
      <Text tone="muted">{t('player.notFound.body')}</Text>
      <Button variant="primary" href="/">{t('player.notFound.home')}</Button>
    </Stack>
  );
}
