import { usePlayback, type CctvKind } from '@rivr/db/cctv';
import { PlaybackLink } from '@rivr/ui';

/** The recording of what a camera saw (#122): @rivr/ui's PlaybackLink with @rivr/db's link. */
export function Playback({ kind, id, label }: { kind: CctvKind; id: string; label?: string }) {
  const { state, ask } = usePlayback(kind, id);
  return <PlaybackLink state={state} onAsk={ask} {...(label === undefined ? {} : { label })} />;
}
