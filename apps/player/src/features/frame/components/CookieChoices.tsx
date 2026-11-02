import { CookieBanner, keepCookieChoice, loadTagManager, storedCookieChoice, type CookieChoice } from '@rivr/ui';
import { useEffect, useState } from 'react';

/**
 * The app's cookie banner (decision 0298), on every screen from sign-in on, while this phone holds no choice. Google Tag
 * Manager, with Google Analytics and the Meta pixel inside it, loads only once analytics is allowed, here or in Profile.
 */
export function CookieChoices() {
  const [choice, setChoice] = useState<CookieChoice | null>(storedCookieChoice);
  useEffect(() => {
    if (choice?.analytics === true) loadTagManager();
  }, [choice]);
  if (choice !== null) return null;
  return (
    <CookieBanner isOpen place="app" onChoose={(chosen) => {
      keepCookieChoice(chosen);
      setChoice(chosen);
    }} />
  );
}
