import { t } from '@rivr/i18n';
import { useEffect, useRef } from 'react';

export interface UrgentChimeProps {
  /** How many wait in each urgent queue, by queue; null until the first read, which sounds nothing. */
  counts: Readonly<Record<string, number>> | null;
}

/** A short rising two-note chime, made in the browser so no sound file ships. Silent where the browser refuses sound. */
function playChime(): void {
  try {
    const audio = new AudioContext();
    void audio.resume().catch(() => undefined);
    const start = audio.currentTime;
    [880, 1320].forEach((frequency, index) => {
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      const at = start + index * 0.18;
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, at);
      volume.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      tone.connect(volume).connect(audio.destination);
      tone.start(at);
      tone.stop(at + 0.32);
    });
    window.setTimeout(() => void audio.close(), 800);
  } catch {
    // No Web Audio here: the count and the announcement still say it.
  }
}

/** Whether any queue holds more than it did at the last read. */
const hasGrown = (counts: Readonly<Record<string, number>>, last: Readonly<Record<string, number>>) =>
  Object.entries(counts).some(([queue, count]) => count > (last[queue] ?? 0));

/**
 * New urgent work, such as a top-up asked for (decision 0301): when any urgent queue grows from one read to the next, a
 * short chime made in the browser and, for a screen reader, how many urgent items wait. The first read sounds nothing.
 * A browser plays sound only once the page has been clicked or typed in since it loaded; until then the chime is silent.
 */
export function UrgentChime({ counts }: UrgentChimeProps) {
  const last = useRef<Readonly<Record<string, number>> | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (counts === null) return;
    if (last.current !== null && hasGrown(counts, last.current)) {
      playChime();
      const waiting = Object.values(counts).reduce((sum, count) => sum + count, 0);
      if (status.current !== null) status.current.textContent = t('ui.urgentChime.waiting', { count: waiting });
    }
    last.current = counts;
  }, [counts]);
  return <p ref={status} role="status" className="sr-only" />;
}
