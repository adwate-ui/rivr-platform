import { t } from '@rivr/i18n';
import { useId } from 'react';
import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Text } from '../Text/Text.tsx';

export interface InstallOfferProps {
  /**
   * `prompt`: the browser can install the app, so Install asks it to. `ios`: an iPhone, where only
   * Safari's Share menu adds it to the home screen, so the offer says how.
   */
  kind: 'prompt' | 'ios';
  /** Opens the browser's install dialog (`prompt` only). */
  onInstall?: (() => void) | undefined;
  onDismiss: () => void;
}

/** The offer to add the player app to the home screen, once, on a member's second visit. */
export function InstallOffer({ kind, onInstall, onDismiss }: InstallOfferProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mb-6 flex flex-col gap-3 border-b border-hairline pb-6">
      <Heading level={2} id={headingId}>
        {t('ui.installOffer.title')}
      </Heading>
      <Text tone="muted">{t(kind === 'ios' ? 'ui.installOffer.ios' : 'ui.installOffer.prompt')}</Text>
      <Inline gap={2}>
        {kind === 'prompt' && onInstall ? (
          <Button variant="secondary" onClick={onInstall}>
            {t('ui.installOffer.install')}
          </Button>
        ) : null}
        <Button variant="text" onClick={onDismiss}>
          {t('ui.installOffer.notNow')}
        </Button>
      </Inline>
    </section>
  );
}
