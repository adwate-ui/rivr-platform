import { t } from '@rivr/i18n';
import { useId } from 'react';
import { Button } from '../Button/Button.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { cx } from '../internal/classes.ts';
import { usePlayerFrame } from '../internal/playerFrame.ts';
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

/**
 * The offer to add the player app to the home screen, once, on a member's second visit. On a screen that runs edge to edge,
 * as Home, it keeps the screen's 20 px column itself (F-202); Not now alone has its words, not its button, on that column.
 */
export function InstallOffer({ kind, onInstall, onDismiss }: InstallOfferProps) {
  const headingId = useId();
  const isFullBleed = usePlayerFrame()?.isFullBleed === true;
  const hasInstall = kind === 'prompt' && onInstall !== undefined;
  return (
    <section aria-labelledby={headingId} className={cx('mb-6 flex flex-col gap-3 border-b border-hairline pb-6', isFullBleed && 'px-5')}>
      {/* Not a heading: the offer sits above the screen's h1, and must not come first in its outline. */}
      <Text id={headingId} weight="semibold">
        {t('ui.installOffer.title')}
      </Text>
      <Text tone="muted">{t(kind === 'ios' ? 'ui.installOffer.ios' : 'ui.installOffer.prompt')}</Text>
      <div className={cx('self-start', !hasInstall && '-ml-3')}>
      <Inline gap={2}>
        {hasInstall ? (
          <Button variant="secondary" onClick={onInstall}>
            {t('ui.installOffer.install')}
          </Button>
        ) : null}
        <Button variant="text" onClick={onDismiss}>
          {t('ui.installOffer.notNow')}
        </Button>
      </Inline>
      </div>
    </section>
  );
}
