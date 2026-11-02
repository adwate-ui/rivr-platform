import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { OpenChevron } from '../internal/OpenChevron.tsx';
import { Text } from '../Text/Text.tsx';

export interface CookieBannerProps {
  /** Open from the start: the stories. On the website the page's script opens it while no choice is stored. */
  isOpen?: boolean;
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
 * The website's cookie choices (#616), as grandpokerarena.com asks them: essential storage is always on and maps are the
 * visitor's choice. A line and two buttons, the choices themselves behind Choose, so it covers little of a phone (W-02). The website runs no analytics or marketing tools, so it offers no choice of them. It is drawn on the
 * server, hidden; the page's own script opens it while no choice is stored, keeps the choice a button gives
 * (data-consent-choice: all, essential or the boxes ticked) and loads what was allowed.
 */
export function CookieBanner({ isOpen = false }: CookieBannerProps) {
  return (
    <section data-cookie-banner="" hidden={!isOpen} aria-labelledby="cookie-banner-title" className="fixed inset-x-0 bottom-0 z-banner max-h-dvh overflow-y-auto border-t border-hairline bg-raised">
      <form className="mx-auto flex max-w-console flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
        <div className="flex max-w-text flex-col gap-1">
          <Heading level={2} variant="subsection" id="cookie-banner-title">{t('ui.web.cookies.title')}</Heading>
          <Text variant="small" tone="muted">{t('ui.web.cookies.text')}</Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Both secondary: refusing is as easy as accepting, and the page's own gold action stays its one (ui.md). */}
          <Button variant="secondary" data-consent-choice="all">{t('ui.web.cookies.acceptAll')}</Button>
          <Button variant="secondary" data-consent-choice="essential">{t('ui.web.cookies.essentialOnly')}</Button>
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
              <Choice name="maps" label={t('ui.web.cookies.maps')} help={t('ui.web.cookies.mapsHelp')} />
            </fieldset>
            <div><Button variant="secondary" data-consent-choice="ticked">{t('ui.web.cookies.save')}</Button></div>
          </div>
        </details>
      </form>
    </section>
  );
}
