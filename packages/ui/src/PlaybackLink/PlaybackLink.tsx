import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Text } from '../Text/Text.tsx';

/** Where a recording's playback link is: not asked for yet, being asked for, ready, or not to be had. */
export type PlaybackState =
  | { readonly status: 'idle' }
  | { readonly status: 'asking' }
  | { readonly status: 'ready'; readonly url: string; readonly camera: string }
  | { readonly status: 'failed'; readonly reason: 'no_camera' | 'not_allowed' | 'unavailable' };

export interface PlaybackLinkProps {
  readonly state: PlaybackState;
  /** Asks for the link: at first, and again after it did not come. */
  readonly onAsk: () => void;
  /** A fuller name for a screen reader where several are on one screen: `Playback: Table 2, 21:00`. It starts with "Playback". */
  readonly label?: string;
}

/**
 * The recording of what a CCTV camera saw (#122): Playback asks for the recorder's link, which then opens the
 * recording at that moment in a new tab. When no camera saw it, or the viewer may not see it, it says so; when the link
 * did not come, Playback is offered again.
 */
export function PlaybackLink({ state, onAsk, label }: PlaybackLinkProps) {
  if (state.status === 'ready') return <Button href={state.url} opensNewTab>{t('ui.playback.open', { camera: state.camera })}</Button>;
  if (state.status === 'failed' && state.reason !== 'unavailable') {
    return <Text variant="small" tone="muted">{t(`ui.playback.failures.${state.reason}`)}</Text>;
  }
  return (
    <Inline gap={2}>
      <Button isLoading={state.status === 'asking'} onClick={onAsk} {...(label === undefined ? {} : { 'aria-label': label })}>{t('ui.playback.label')}</Button>
      {state.status === 'failed' ? <Text variant="small" tone="muted">{t('ui.playback.failures.unavailable')}</Text> : null}
    </Inline>
  );
}
