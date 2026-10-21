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
}

/** A website block for finding the club: the address, the hours and a link to directions. */
export function MapBlock({ heading, address, hours, directionsUrl }: MapBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col items-start gap-4 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      <address className="flex max-w-text flex-col gap-2 not-italic">
        <Text variant="lead">{address}</Text>
        {hours ? <Text tone="muted">{hours}</Text> : null}
      </address>
      <Button variant="secondary" href={directionsUrl}>
        {t('ui.web.directions')}
      </Button>
    </section>
  );
}
