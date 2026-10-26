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
  /** Directions in a maps app. No map is embedded, so the page loads nothing from a maps service. */
  directionsUrl: string;
  /** The club's number, `+919000000000`, shown as `+91 90000 00000` and called with a tap (decision 0166). */
  phone?: string | undefined;
  email?: string | undefined;
}

/** `+919000000000` as it is read out: `+91 90000 00000`. */
function spokenPhone(phone: string): string {
  return `${phone.slice(0, 3)} ${phone.slice(3, 8)} ${phone.slice(8)}`;
}

/** A website block for finding the club: the address, the hours, how to reach it, and a link to directions. */
export function MapBlock({ heading, address, hours, directionsUrl, phone, email }: MapBlockProps) {
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
    </section>
  );
}
