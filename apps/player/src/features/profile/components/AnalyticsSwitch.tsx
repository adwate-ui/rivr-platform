import { t } from '@rivr/i18n';
import { keepCookieChoice, loadTagManager, stopAnalytics, storedCookieChoice, Switch } from '@rivr/ui';
import { useState } from 'react';

/** The cookie banner's analytics choice (decision 0298), changed later: kept on this phone, as the banner keeps it. Turned off, it stops at once. */
export function AnalyticsSwitch() {
  const [isOn, setIsOn] = useState(() => storedCookieChoice()?.analytics === true);
  return (
    <Switch label={t('player.profile.analytics')} hint={t('player.profile.analyticsHint')} isOn={isOn} onChange={(next) => {
      keepCookieChoice({ maps: storedCookieChoice()?.maps === true, analytics: next });
      setIsOn(next);
      if (next) loadTagManager();
      else stopAnalytics();
    }} />
  );
}
