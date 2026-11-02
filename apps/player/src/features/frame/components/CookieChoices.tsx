import { t } from '@rivr/i18n';
import { Button, Grid, keepCookieChoice, loadTagManager, Sheet, storedCookieChoice, Text, type CookieChoice } from '@rivr/ui';
import { useEffect, useState } from 'react';

const ESSENTIAL: CookieChoice = { maps: false, analytics: false };
const ANALYTICS: CookieChoice = { maps: false, analytics: true };

/**
 * The app's cookie choice (decisions 0298, 0320): a sheet on first launch, while this phone holds no choice. Google Tag
 * Manager, with Google Analytics and the Meta pixel inside it, loads only once analytics is allowed, here or in Profile.
 * Closing the sheet without a choice keeps essential storage only.
 */
export function CookieChoices() {
  const [choice, setChoice] = useState<CookieChoice | null>(storedCookieChoice);
  useEffect(() => {
    if (choice?.analytics === true) loadTagManager();
  }, [choice]);
  const choose = (chosen: CookieChoice) => {
    keepCookieChoice(chosen);
    setChoice(chosen);
  };
  return (
    <Sheet isOpen={choice === null} onClose={() => choose(ESSENTIAL)} title={t('player.signIn.cookies.title')} titleLook="plain">
      <Text tone="muted">{t('player.signIn.cookies.text')}</Text>
      <Grid columns={2} gap={2}>
        <Button variant="outline" fullWidth onClick={() => choose(ESSENTIAL)}>{t('player.signIn.cookies.essential')}</Button>
        <Button variant="primary" fullWidth onClick={() => choose(ANALYTICS)}>{t('player.signIn.cookies.allow')}</Button>
      </Grid>
    </Sheet>
  );
}
