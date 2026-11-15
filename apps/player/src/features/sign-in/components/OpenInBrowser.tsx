import { t } from '@rivr/i18n';
import { Button, Stack, StepScreen, Text, useToast } from '@rivr/ui';
import { chromeIntentOf, type InAppBrowser } from '../inAppBrowser.ts';

/**
 * Before sign-in, inside Instagram's or Facebook's own browser (the owner, 15 Nov): one screen that sends the visitor to
 * Safari or Chrome, where they will use RIVR and stay signed in. How to get there, the link to copy, on Android a link
 * that opens Chrome itself, and Continue here for a wrong guess.
 */
export function OpenInBrowser({ browser, url, onContinue }: { browser: InAppBrowser; url: string; onContinue: () => void }) {
  const toast = useToast();
  const isAndroid = browser.platform === 'android';
  const copy = () => {
    void navigator.clipboard.writeText(url).then(
      () => toast(t('player.signIn.inAppBrowser.copied')),
      () => toast(t('player.signIn.inAppBrowser.copyFailed')),
    );
  };
  return (
    <StepScreen title={t(`player.signIn.inAppBrowser.title.${browser.platform}`)} align="center"
      footer={
        <Stack gap={3}>
          {isAndroid ? <Button variant="primary" size="large" fullWidth href={chromeIntentOf(url)}>{t('player.signIn.inAppBrowser.openChrome')}</Button> : null}
          <Button variant={isAndroid ? 'outline' : 'primary'} size="large" fullWidth onClick={copy}>{t('player.signIn.inAppBrowser.copyLink')}</Button>
          <Button variant="text" onClick={onContinue}>{t('player.signIn.inAppBrowser.continueHere')}</Button>
        </Stack>
      }>
      <Stack gap={3}>
        <Text>{t('player.signIn.inAppBrowser.why')}</Text>
        <Text tone="muted">{t('player.signIn.inAppBrowser.how')}</Text>
      </Stack>
    </StepScreen>
  );
}
