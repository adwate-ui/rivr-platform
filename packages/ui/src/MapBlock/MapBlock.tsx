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
  /** The club's number, `+919000000000`, shown as `+91 90000 00000` and called with a tap (decision 0166). */
  phone?: string | undefined;
  email?: string | undefined;
}

/** `+919000000000` as it is read out: `+91 90000 00000`. */
function spokenPhone(phone: string): string {
  return `${phone.slice(0, 3)} ${phone.slice(3, 8)} ${phone.slice(8)}`;
}

/** A map that waits for the visitor's consent: a note and a button to allow maps, then the map in their place. */
function ConsentedMap({ embedUrl }: { embedUrl: string }) {
  return (
    <div data-consent="maps" className="w-full">
      <iframe data-consent-src={embedUrl} title={t('ui.web.mapTitle')} hidden loading="lazy" className="aspect-photo w-full rounded-sm border-0" />
      <div data-consent-ask="" className="flex aspect-photo w-full flex-col items-center justify-center gap-4 rounded-sm border border-hairline p-6">
        <Text tone="muted" align="center">{t('ui.web.mapConsent')}</Text>
        <Button variant="secondary" data-consent-allow="maps">{t('ui.web.allowMaps')}</Button>
      </div>
    </div>
  );
}

/** A website block for finding the club: the address, the hours, how to reach it, a link to directions, and a map once allowed. */
export function MapBlock({ heading, address, hours, directionsUrl, embedUrl, phone, email }: MapBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col items-start gap-4 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      <address className="flex max-w-text flex-col gap-2 not-italic">
        <Text variant="lead">{address}</Text>
        {hours ? <Text tone="muted">{hours}</Text> : null}
        {phone ? <a className="font-text text-16 text-content underline underline-offset-4" href={`tel:${phone}`}>{spokenPhone(phone)}</a> : null}
        {email ? <a className="font-text text-16 text-content underline underline-offset-4" href={`mailto:${email}`}>{email}</a> : null}
      </address>
      <Button variant="secondary" href={directionsUrl}>
        {t('ui.web.directions')}
      </Button>
      {embedUrl ? <ConsentedMap embedUrl={embedUrl} /> : null}
    </section>
  );
}
