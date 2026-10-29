import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface CookieBannerProps {
  /** Open from the start: the stories. On the website the page's script opens it while no choice is stored. */
  isOpen?: boolean;
}

/** One kind of storage the visitor chooses: its name and what it is for; essential storage cannot be turned off. */
function Choice({ name, label, help, isFixed }: { name: string; label: string; help: string; isFixed?: boolean }) {
  return (
    <label className="flex min-h-touch items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={isFixed} disabled={isFixed} className="mt-1" />
      <span className="flex flex-col">
        <Text as="span" variant="label">{label}</Text>
        <Text as="span" variant="small" tone="muted">{help}</Text>
      </span>
    </label>
  );
}

/**
 * The website's cookie choices (#616), as grandpokerarena.com asks them: essential storage is always on and maps are the
 * visitor's choice. The website runs no analytics or marketing tools, so it offers no choice of them. It is drawn on the
 * server, hidden; the page's own script opens it while no choice is stored, keeps the choice a button gives
 * (data-consent-choice: all, essential or the boxes ticked) and loads what was allowed.
 */
export function CookieBanner({ isOpen = false }: CookieBannerProps) {
  return (
    <section data-cookie-banner="" hidden={!isOpen} aria-labelledby="cookie-banner-title" className="fixed inset-x-0 bottom-0 z-banner max-h-dvh overflow-y-auto border-t border-hairline bg-raised">
      <form className="mx-auto flex max-w-console flex-col gap-4 px-6 py-6">
        <Heading level={2} variant="subsection" id="cookie-banner-title">{t('ui.web.cookies.title')}</Heading>
        <Text tone="muted">{t('ui.web.cookies.text')}</Text>
        <fieldset className="flex flex-col gap-2 tablet:flex-row tablet:gap-8">
          <legend className="sr-only">{t('ui.web.cookies.choices')}</legend>
          <Choice name="essential" label={t('ui.web.cookies.essential')} help={t('ui.web.cookies.essentialHelp')} isFixed />
          <Choice name="maps" label={t('ui.web.cookies.maps')} help={t('ui.web.cookies.mapsHelp')} />
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" data-consent-choice="all">{t('ui.web.cookies.acceptAll')}</Button>
          <Button variant="secondary" data-consent-choice="essential">{t('ui.web.cookies.essentialOnly')}</Button>
          <Button variant="text" data-consent-choice="ticked">{t('ui.web.cookies.save')}</Button>
        </div>
      </form>
    </section>
  );
}
