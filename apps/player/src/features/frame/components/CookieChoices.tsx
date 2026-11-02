import { keepCookieChoice, loadTagManager, storedCookieChoice, type CookieChoice } from '@rivr/ui';
import { lazy, Suspense, useEffect, useState } from 'react';

// The sheet, with its dialog, loads only on a phone that has not chosen: most launches never fetch it (the bundle budget).
const CookieSheet = lazy(() => import('./CookieSheet.tsx'));

/**
 * The app's cookie choice (decisions 0298, 0320): a sheet on first launch, while this phone holds no choice. Google Tag
 * Manager, with Google Analytics and the Meta pixel inside it, loads only once analytics is allowed, here or in Profile.
 */
export function CookieChoices() {
  const [choice, setChoice] = useState<CookieChoice | null>(storedCookieChoice);
  useEffect(() => {
    if (choice?.analytics === true) loadTagManager();
  }, [choice]);
  if (choice !== null) return null;
  const choose = (chosen: CookieChoice) => {
    keepCookieChoice(chosen);
    setChoice(chosen);
  };
  return <Suspense fallback={null}><CookieSheet onChoose={choose} /></Suspense>;
}
