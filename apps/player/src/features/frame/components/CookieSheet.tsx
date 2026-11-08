import { t } from '@rivr/i18n';
import { Button, Grid, Sheet, Text, type CookieChoice } from '@rivr/ui';

const ESSENTIAL: CookieChoice = { maps: false, analytics: false };
const ANALYTICS: CookieChoice = { maps: false, analytics: true };

/**
 * The first launch's cookie sheet (decision 0320): Essential only, or Allow analytics, of equal weight, so refusing is as
 * easy as accepting, as on the website (F-180). Closing it without a choice keeps essential storage only. Loaded only on a
 * phone that has not chosen, so the app's first load carries no sheet.
 */
export default function CookieSheet({ onChoose }: { onChoose: (choice: CookieChoice) => void }) {
  return (
    <Sheet isOpen onClose={() => onChoose(ESSENTIAL)} title={t('player.signIn.cookies.title')} titleLook="plain">
      <Text tone="muted">{t('player.signIn.cookies.text')}</Text>
      <Grid columns={2} gap={2}>
        <Button variant="outline" size="large" fullWidth onClick={() => onChoose(ESSENTIAL)}>{t('player.signIn.cookies.essential')}</Button>
        <Button variant="outline" size="large" fullWidth onClick={() => onChoose(ANALYTICS)}>{t('player.signIn.cookies.allow')}</Button>
      </Grid>
    </Sheet>
  );
}
