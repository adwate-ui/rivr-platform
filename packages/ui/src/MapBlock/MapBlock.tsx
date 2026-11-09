import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface MapBlockProps {
  heading?: string | undefined;
  /** The club's address, as a visitor would give it to a driver. */
  address: string;
  /** Opening hours, in a line. */
  hours?: string | undefined;
  /** Directions in a maps app. */
  directionsUrl: string;
  /**
   * A map to embed (#616). It loads only once the visitor allows maps in the cookie banner: until then the frame has no
   * address, and the page's own script gives it this one (data-consent-src). Without it, no map is embedded at all.
   */
  embedUrl?: string | undefined;
  /** The club's number, `+919000000000`: a button that shows it as `+91 90000 00000` and calls it (decision 0166, F-197). */
  phone?: string | undefined;
  /** A WhatsApp chat with the club (F-197). */
  whatsappHref?: string | undefined;
  email?: string | undefined;
}

/** `+919000000000` as it is read out: `+91 90000 00000`. */
function spokenPhone(phone: string): string {
  return `${phone.slice(0, 3)} ${phone.slice(3, 8)} ${phone.slice(8)}`;
}

/** A map that waits for the visitor's consent: a note and a button to allow maps, then the map in their place, the same size from a tablet up (F-197). */
function ConsentedMap({ embedUrl }: { embedUrl: string }) {
  return (
    <div data-consent="maps" className="w-full max-w-text tablet:max-w-none tablet:flex-1">
      <iframe data-consent-src={embedUrl} title={t('ui.web.mapTitle')} hidden loading="lazy" className="aspect-photo w-full rounded-sm border-0" />
      <div data-consent-ask="" className="flex w-full flex-col items-start justify-center gap-4 rounded-sm border border-hairline p-6 tablet:aspect-photo">
        <Text tone="muted">{t('ui.web.mapConsent')}</Text>
        <Button variant="secondary" data-consent-allow="maps">{t('ui.web.allowMaps')}</Button>
      </div>
    </div>
  );
}

/** A website block for finding the club: the address, the hours and how to reach it, and beside them from a tablet up a map once allowed (F-197). */
export function MapBlock({ heading, address, hours, directionsUrl, embedUrl, phone, whatsappHref, email }: MapBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-8 px-6 py-16 tablet:flex-row tablet:py-24">
      <div className="flex flex-col items-start gap-4 tablet:flex-1">
        {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
        <address className="flex max-w-text flex-col gap-2 not-italic">
          <Text variant="lead">{address}</Text>
          {hours ? <Text tone="muted">{hours}</Text> : null}
          {email ? <a className="font-text text-16 text-content underline underline-offset-4" href={`mailto:${email}`}>{email}</a> : null}
        </address>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" href={directionsUrl}>{t('ui.web.directions')}</Button>
          {phone ? <Button variant="secondary" href={`tel:${phone}`}>{t('ui.web.call', { number: spokenPhone(phone) })}</Button> : null}
          {whatsappHref ? <Button variant="secondary" href={whatsappHref}>{t('ui.web.whatsapp')}</Button> : null}
        </div>
      </div>
      {embedUrl ? <ConsentedMap embedUrl={embedUrl} /> : null}
    </section>
  );
}
