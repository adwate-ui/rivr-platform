import { t } from '@rivr/i18n';
import { useRef } from 'react';
import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { OpenChevron } from '../internal/OpenChevron.tsx';
import { Text } from '../Text/Text.tsx';
import type { CookieChoice } from './cookieChoice.ts';

export interface CookieBannerProps {
  /** Open from the start: the stories, and the app while no choice is stored. On the website the page's script opens it. */
  isOpen?: boolean;
  /** The website asks about its map and analytics; the app, which has no map, about analytics alone. */
  place?: 'website' | 'app';
  /** In the app, the choice a button made. The website's page script reads the buttons itself. */
  onChoose?: ((choice: CookieChoice) => void) | undefined;
}

/** One kind of storage the visitor chooses: its name and what it is for; essential storage cannot be turned off. */
function Choice({ name, label, help, isFixed }: { name: string; label: string; help: string; isFixed?: boolean }) {
  return (
    <label className="flex min-h-touch items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={isFixed} disabled={isFixed} className="mt-1 size-5 shrink-0 accent-action" />
      <span className="flex flex-col">
        <Text as="span" variant="label">{label}</Text>
        <Text as="span" variant="small" tone="muted">{help}</Text>
      </span>
    </label>
  );
}

/**
 * The cookie choices (#616), as grandpokerarena.com asks them: essential storage is always on; maps (on the website)
 * and analytics, Google Tag Manager with Google Analytics and the Meta pixel (decision 0298), are the visitor's choice.
 * A line and two buttons, the choices themselves behind Choose, so it covers little of a phone (W-02). On the website
 * it is drawn on the server, hidden; the page's own script opens it while no choice is stored, keeps the choice a
 * button gives (data-consent-choice: all, essential or the boxes ticked) and loads what was allowed. In the app,
 * `onChoose` hears the choice.
 */
export function CookieBanner({ isOpen = false, place = 'website', onChoose }: CookieBannerProps) {
  const form = useRef<HTMLFormElement>(null);
  const isWebsite = place === 'website';
  const ticked = (name: string) => form.current?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.checked === true;
  const choose = (kind: 'all' | 'essential' | 'ticked') => {
    if (!onChoose) return;
    if (kind === 'ticked') onChoose({ maps: isWebsite && ticked('maps'), analytics: ticked('analytics') });
    else onChoose({ maps: isWebsite && kind === 'all', analytics: kind === 'all' });
  };
  return (
    <section data-cookie-banner="" hidden={!isOpen} aria-labelledby="cookie-banner-title" className="fixed inset-x-0 bottom-0 z-banner max-h-dvh overflow-y-auto border-t border-hairline bg-raised">
      <form ref={form} className="mx-auto flex max-w-console flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
        <div className="flex max-w-text flex-col gap-1">
          <Heading level={2} variant="subsection" id="cookie-banner-title">{t(isWebsite ? 'ui.web.cookies.title' : 'ui.web.cookies.appTitle')}</Heading>
          <Text variant="small" tone="muted">{t(isWebsite ? 'ui.web.cookies.text' : 'ui.web.cookies.appText')}</Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Both secondary: refusing is as easy as accepting, and the page's own gold action stays its one (ui.md). */}
          <Button variant="secondary" data-consent-choice="all" onClick={() => choose('all')}>{t('ui.web.cookies.acceptAll')}</Button>
          <Button variant="secondary" data-consent-choice="essential" onClick={() => choose('essential')}>{t('ui.web.cookies.essentialOnly')}</Button>
        </div>
        <details className="group w-full">
          <summary className="flex min-h-touch w-fit cursor-pointer items-center gap-2 font-text text-14 font-medium text-content">
            {t('ui.web.cookies.choose')}
            <OpenChevron />
          </summary>
          <div className="flex flex-col gap-3 pt-2">
            <fieldset className="flex flex-col gap-2 tablet:flex-row tablet:gap-8">
              <legend className="sr-only">{t('ui.web.cookies.choices')}</legend>
              <Choice name="essential" label={t('ui.web.cookies.essential')} help={t('ui.web.cookies.essentialHelp')} isFixed />
              {isWebsite ? <Choice name="maps" label={t('ui.web.cookies.maps')} help={t('ui.web.cookies.mapsHelp')} /> : null}
              <Choice name="analytics" label={t('ui.web.cookies.analytics')} help={t('ui.web.cookies.analyticsHelp')} />
            </fieldset>
            <div><Button variant="secondary" data-consent-choice="ticked" onClick={() => choose('ticked')}>{t('ui.web.cookies.save')}</Button></div>
          </div>
        </details>
      </form>
    </section>
  );
}
