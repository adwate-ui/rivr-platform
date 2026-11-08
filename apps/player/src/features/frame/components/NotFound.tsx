import { t } from '@rivr/i18n';
import { Button, Figure, Heading, Stack, Text, usePageTitle } from '@rivr/ui';

/** Shown for an address the app does not have (decision 0320): 404 in gold, what happened, and the way back to Tonight. */
export function NotFound() {
  usePageTitle(t('player.notFound.title'));
  return (
    <Stack gap={3} justify="center" align="start" grow>
      <Figure size="jackpot" tone="money">{t('player.notFound.code')}</Figure>
      <Heading level={1} variant="serif" serifSize={32}>{t('player.notFound.title')}</Heading>
      <Text tone="muted">{t('player.notFound.body')}</Text>
      <Button variant="primary" href="/">{t('player.notFound.home')}</Button>
    </Stack>
  );
}
