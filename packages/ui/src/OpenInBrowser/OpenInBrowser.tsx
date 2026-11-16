import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { StepScreen } from '../StepScreen/StepScreen.tsx';
import { Text } from '../Text/Text.tsx';
import { useToast } from '../Toast/Toast.tsx';
import { chromeIntentOf, type InAppBrowser } from './inAppBrowser.ts';

export interface OpenInBrowserProps {
  /** The in-app browser the page is open in, from `inAppBrowserOf`. */
  browser: InAppBrowser;
  /** The address to carry on at in Safari or Chrome. */
  url: string;
  /** Why to go, in the app's words: to stay signed in, or a camera this browser refuses. */
  why: string;
  /** Continue here, for a wrong guess. */
  onContinue: () => void;
}

/**
 * Inside Instagram's or Facebook's own browser (the owner, 15 Nov): one screen that sends the person to Safari or Chrome.
 * Why, how to get there, the link to copy, on Android a link that opens Chrome itself, and Continue here for a wrong guess.
 * Sign-in shows it first; the selfie step shows it when the camera is refused there (#1050).
 */
export function OpenInBrowser({ browser, url, why, onContinue }: OpenInBrowserProps) {
  const toast = useToast();
  const isAndroid = browser.platform === 'android';
  const copy = () => {
    void navigator.clipboard.writeText(url).then(
      () => toast(t('ui.openInBrowser.copied')),
      () => toast(t('ui.openInBrowser.copyFailed')),
    );
  };
  return (
    <StepScreen title={t(`ui.openInBrowser.title.${browser.platform}`)} align="center"
      footer={
        <Stack gap={3}>
          {isAndroid ? <Button variant="primary" size="large" fullWidth href={chromeIntentOf(url)}>{t('ui.openInBrowser.openChrome')}</Button> : null}
          <Button variant={isAndroid ? 'outline' : 'primary'} size="large" fullWidth onClick={copy}>{t('ui.openInBrowser.copyLink')}</Button>
          <Button variant="text" onClick={onContinue}>{t('ui.openInBrowser.continueHere')}</Button>
        </Stack>
      }>
      <Stack gap={3}>
        <Text>{why}</Text>
        <Text tone="muted">{t('ui.openInBrowser.how')}</Text>
      </Stack>
    </StepScreen>
  );
}
