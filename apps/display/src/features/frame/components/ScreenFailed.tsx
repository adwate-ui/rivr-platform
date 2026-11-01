import { t } from '@rivr/i18n';
import { Text } from '@rivr/ui';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useEffect } from 'react';

// How often a TV that failed to draw a screen tries it again: no one is there to press anything.
const TRY_AGAIN_EVERY_MS = 30_000;

/**
 * A screen that failed to draw, on a TV no one touches: the TV's line, and the screen tried again every 30 seconds, in
 * place of the router's unstyled default. On the stream's overlay (`isOverlay`) nothing shows in the broadcast.
 */
export function ScreenFailed({ reset, isOverlay = false }: ErrorComponentProps & { isOverlay?: boolean }) {
  useEffect(() => {
    const timer = setInterval(reset, TRY_AGAIN_EVERY_MS);
    return () => clearInterval(timer);
  }, [reset]);
  return isOverlay ? null : <Text variant="tvBody">{t('display.screen.unavailable')}</Text>;
}

/** The stream overlay's: nothing in the broadcast, tried again every 30 seconds. */
export function OverlayFailed(props: ErrorComponentProps) {
  return <ScreenFailed {...props} isOverlay />;
}
